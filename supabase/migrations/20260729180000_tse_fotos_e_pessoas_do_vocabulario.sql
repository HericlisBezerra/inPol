-- Dois buracos encontrados testando com dados reais (2026-07-29).
--
-- PROBLEMA 1 — nenhuma foto do TSE: 283 candidatos importados, 0 com `foto_url`.
-- O importador lê `c.fotoUrl` do endpoint de LISTAGEM (`/candidatura/listar/...`),
-- que não devolve esse campo — ele só existe no DETALHE do candidato. Resultado:
-- `foto_url` sempre nulo, e a ficha da pessoa nunca herdava avatar.
-- A boa notícia: a URL é DETERMINÍSTICA e montável com o que já está no banco —
--   https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/{eleicaoId}/{tse_candidate_id}/{cod_municipio}
-- Verificado contra o TSE: HTTP 200, image/jpeg. Então dá para preencher tudo aqui,
-- sem nenhuma chamada de API candidato a candidato.
--
-- PROBLEMA 2 — o backfill da migração anterior converteu só `org_adversaries` (6).
-- Ficaram de fora as pessoas cadastradas no VOCABULÁRIO (17 opositores + 21 aliados),
-- que são justamente as validadas contra o TSE. Elas não apareciam na aba Pessoas.

-- ── 1. Fotos do TSE ──────────────────────────────────────────────────────────
-- eleicaoId por ano (mesma tabela de `electionIdFor` em elected.functions.ts).
update public.elected_officials
set foto_url = 'https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/'
  || case ano_eleicao
       when 2024 then '2045202024'
       when 2020 then '2030402020'
       when 2016 then '2'
       when 2012 then '1699'
     end
  || '/' || tse_candidate_id || '/' || cod_municipio_tse
where foto_url is null
  and tse_candidate_id is not null
  and cod_municipio_tse is not null
  and ano_eleicao in (2012, 2016, 2020, 2024);

-- ── 2. Pessoas a partir do vocabulário ───────────────────────────────────────
-- `distinct on (lower(value))` porque o vocabulário tem duplicata de caixa
-- ("Pedro Bigardi" e "PEDRO BIGARDI"): criar as duas geraria ficha repetida.
insert into public.org_people (org_id, display_name, stance, vocabulary_id)
select distinct on (v.org_id, lower(v.value))
  v.org_id,
  v.value,
  case v.kind when 'opponent' then 'adversario' else 'aliado' end,
  v.id
from public.org_vocabulary v
where v.kind in ('opponent', 'ally')
  and not exists (
    select 1 from public.org_people p
    where p.org_id = v.org_id and lower(p.display_name) = lower(v.value)
  )
order by v.org_id, lower(v.value), v.id;

-- ── 3. Casar pessoa ↔ TSE e herdar o que o TSE sabe ──────────────────────────
-- Casa por nome de urna OU nome completo (o vocabulário costuma usar o nome de urna).
-- Prefere o mandato mais recente e quem foi de fato eleito.
with match as (
  select distinct on (p.id)
    p.id as person_id, e.id as elected_id, e.partido_sigla, e.cargo_nome, e.foto_url
  from public.org_people p
  join public.elected_officials e
    on e.org_id = p.org_id
   and (upper(btrim(e.nome_urna)) = upper(btrim(p.display_name))
     or upper(btrim(e.nome)) = upper(btrim(p.display_name)))
  where p.elected_official_id is null
  order by p.id, e.is_elected desc, e.ano_eleicao desc
)
update public.org_people p
set elected_official_id = m.elected_id,
    -- Só preenche o que está vazio: o que o usuário digitou à mão sempre vence.
    party = coalesce(p.party, m.partido_sigla),
    role = coalesce(p.role, m.cargo_nome),
    avatar_url = coalesce(p.avatar_url, m.foto_url),
    updated_at = now()
from match m
where p.id = m.person_id;

-- ── 4. Vincular ao vocabulário quem já era pessoa e ainda não tinha o elo ────
-- Sem isto, a sincronização de vocabulário criaria uma entrada NOVA em vez de
-- reaproveitar a que já existe, duplicando o termo que a IA reconhece.
update public.org_people p
set vocabulary_id = v.id
from public.org_vocabulary v
where p.vocabulary_id is null
  and v.org_id = p.org_id
  and v.kind in ('opponent', 'ally')
  and lower(v.value) = lower(p.display_name);
