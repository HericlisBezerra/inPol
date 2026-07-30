-- ============================================================================
-- Consolidação do passivo de alertas duplicados (dedupe_key NULL/instável).
--
-- CONTEXTO: `public.alerts` ganhou `dedupe_key` em 20260701183256, mas um segundo
-- caminho de escrita (`raiseAlerts` em src/lib/ingest.server.ts) continuou inserindo
-- alertas SEM a chave. Resultado na org piloto: 329 alertas de "outros" sem bairro,
-- 149 de "lazer", 77 de "outros/Morada". O motor correto (`detectAlertsForOrg`)
-- deduplica; o do ingest não.
--
-- Esta migração NÃO deleta nada. Ela (1) grava a chave normalizada onde falta e
-- (2) encerra as linhas redundantes de cada assunto, movendo as evidências para a
-- linha sobrevivente (a mais antiga de cada chave). `resolved_at` é reversível;
-- DELETE não seria.
--
-- ⚠️ Rodar em transação e conferir os SELECTs de auditoria (no fim) ANTES do commit.
-- ============================================================================

-- Remoção de acento sem depender da extensão `unaccent` (pode não estar instalada e
-- não é IMMUTABLE por padrão, o que a impediria de entrar em índice). Cobre pt-BR.
CREATE OR REPLACE FUNCTION public.alerts_unaccent(_v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    coalesce(_v, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  );
$$;

-- Mesma normalização de src/lib/alerts.server.ts::dedupeKey — sem acento, minúscula,
-- não-alfanumérico colapsado em "_", bairro ausente vira "-". As duas definições
-- PRECISAM andar juntas: se divergirem, o backfill agrupa diferente do runtime.
CREATE OR REPLACE FUNCTION public.alerts_dedupe_key(_topic text, _neighborhood text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT left(
    coalesce(
      nullif(trim(both '_' from regexp_replace(lower(public.alerts_unaccent(_topic)), '[^a-z0-9]+', '_', 'g')), ''),
      'sem_tema'
    )
    || '::' ||
    coalesce(
      nullif(trim(both '_' from regexp_replace(lower(public.alerts_unaccent(_neighborhood)), '[^a-z0-9]+', '_', 'g')), ''),
      '-'
    ),
    200
  );
$$;

-- ---------------------------------------------------------------------------
-- PASSO 1 — snapshot do estado anterior, para poder reverter.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._alerts_dedupe_backfill_20260729 AS
SELECT id, org_id, topic, neighborhood, dedupe_key, resolved_at, evidence_message_ids
FROM public.alerts;

-- Snapshot é dado operacional, não dado de org: fica fechado para `authenticated`
-- (senão seria uma tabela em `public` sem RLS — vazamento cross-tenant pelo PostgREST).
REVOKE ALL ON public._alerts_dedupe_backfill_20260729 FROM anon, authenticated;
ALTER TABLE public._alerts_dedupe_backfill_20260729 ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public._alerts_dedupe_backfill_20260729 TO service_role;
-- Apagar depois de validado: DROP TABLE public._alerts_dedupe_backfill_20260729;

-- ---------------------------------------------------------------------------
-- PASSO 2 — encerra as linhas redundantes. Elas ficam no banco (auditáveis,
-- reversíveis com `resolved_at = NULL`), mas saem da tela de Alertas.
-- Grava a chave nelas também: o índice único é parcial em `resolved_at IS NULL`,
-- então não há conflito.
--
-- ORDEM IMPORTA: este passo vem ANTES de promover o sobrevivente. Promover primeiro
-- violava `alerts_org_dedupe_uidx` — a chave era escrita no sobrevivente enquanto as
-- duplicatas ainda estavam ABERTAS com a mesma chave, e o índice parcial barra isso.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    a.id,
    row_number() OVER (
      PARTITION BY a.org_id, public.alerts_dedupe_key(a.topic, a.neighborhood)
      ORDER BY a.first_seen_at ASC, a.id ASC
    ) AS rn,
    public.alerts_dedupe_key(a.topic, a.neighborhood) AS k
  FROM public.alerts a
  WHERE a.resolved_at IS NULL
)
UPDATE public.alerts a
SET resolved_at = now(),
    dedupe_key  = r.k
FROM ranked r
WHERE a.id = r.id AND r.rn > 1;

-- ---------------------------------------------------------------------------
-- PASSO 3 — elege o sobrevivente de cada (org, chave) entre os ABERTOS:
-- o mais antigo por first_seen_at. Ele herda as evidências dos demais (teto 50,
-- as mais recentes primeiro) e o pior max_risk / maior nível do grupo.
-- ---------------------------------------------------------------------------
WITH open_keyed AS (
  SELECT
    a.id,
    a.org_id,
    public.alerts_dedupe_key(a.topic, a.neighborhood) AS k,
    a.first_seen_at,
    a.evidence_message_ids,
    a.max_risk,
    a.level,
    row_number() OVER (
      PARTITION BY a.org_id, public.alerts_dedupe_key(a.topic, a.neighborhood)
      ORDER BY a.first_seen_at ASC, a.id ASC
    ) AS rn
  FROM public.alerts a
  WHERE a.resolved_at IS NULL
),
evidence AS (  -- evidências do grupo, mais recentes primeiro, sem repetir, teto 50
  SELECT org_id, k, (array_agg(DISTINCT mid))[1:50]::uuid[] AS ids
  FROM (
    SELECT o.org_id, o.k, m.mid
    FROM open_keyed o
    CROSS JOIN LATERAL unnest(coalesce(o.evidence_message_ids, '{}'::uuid[])) AS m(mid)
    ORDER BY o.first_seen_at DESC
  ) s
  GROUP BY org_id, k
),
worst AS (
  SELECT
    org_id,
    k,
    max(coalesce(max_risk, 0)) AS max_risk,
    max(CASE level::text WHEN 'vermelho' THEN 2 WHEN 'laranja' THEN 1 ELSE 0 END) AS level_rank
  FROM open_keyed
  GROUP BY org_id, k
)
UPDATE public.alerts a
SET dedupe_key = o.k,
    evidence_message_ids = coalesce(e.ids, a.evidence_message_ids),
    max_risk = greatest(coalesce(a.max_risk, 0), w.max_risk),
    level = (CASE w.level_rank WHEN 2 THEN 'vermelho' WHEN 1 THEN 'laranja' ELSE 'amarelo' END)::public.alert_level
FROM open_keyed o
JOIN worst w ON w.org_id = o.org_id AND w.k = o.k
LEFT JOIN evidence e ON e.org_id = o.org_id AND e.k = o.k
WHERE a.id = o.id AND o.rn = 1;

-- ---------------------------------------------------------------------------
-- PASSO 4 — o histórico já resolvido só ganha a chave (não muda estado).
-- Serve para relatórios e para o cooldown de 24h enxergar o ciclo anterior.
-- ---------------------------------------------------------------------------
UPDATE public.alerts
SET dedupe_key = public.alerts_dedupe_key(topic, neighborhood)
WHERE resolved_at IS NOT NULL
  AND dedupe_key IS DISTINCT FROM public.alerts_dedupe_key(topic, neighborhood);

-- ---------------------------------------------------------------------------
-- PASSO 5 — trava de banco: daqui pra frente nenhum caminho de escrita pode
-- inserir alerta sem chave. É isso que impede o bug de voltar por outra porta
-- (ex.: um segundo motor de alertas que esqueça a coluna).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alerts_fill_dedupe_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dedupe_key IS NULL OR btrim(NEW.dedupe_key) = '' THEN
    NEW.dedupe_key := public.alerts_dedupe_key(NEW.topic, NEW.neighborhood);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alerts_dedupe_key ON public.alerts;
CREATE TRIGGER trg_alerts_dedupe_key
  BEFORE INSERT OR UPDATE OF topic, neighborhood, dedupe_key ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.alerts_fill_dedupe_key();

-- ---------------------------------------------------------------------------
-- AUDITORIA (rodar antes do COMMIT; devem voltar 0 linhas / 0 duplicatas)
-- ---------------------------------------------------------------------------
-- SELECT count(*) AS sem_chave FROM public.alerts WHERE dedupe_key IS NULL;
-- SELECT org_id, dedupe_key, count(*) FROM public.alerts
--   WHERE resolved_at IS NULL GROUP BY 1,2 HAVING count(*) > 1;
-- SELECT count(*) AS abertos_depois FROM public.alerts WHERE resolved_at IS NULL;
-- Reverter o passo 3:
-- UPDATE public.alerts a SET resolved_at = b.resolved_at
--   FROM public._alerts_dedupe_backfill_20260729 b WHERE a.id = b.id;
