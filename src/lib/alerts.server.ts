// Alerts detection engine (server-only).
// Aggregates recent analyzed messages into topic × neighborhood buckets and
// upserts open alerts in `public.alerts` with a computed stage and level.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiJson, MODEL_DEEPSEEK, MODEL_FLASH } from "@/lib/ai-gateway.server";
import { fetchAllPages } from "@/lib/pg-paginate";

type Stage = "borbulhando" | "ativo" | "manchete";
type Level = "amarelo" | "laranja" | "vermelho";

interface Bucket {
  topic: string;
  neighborhood: string | null;
  messageIds: string[];
  groupIds: Set<string>;
  sentiments: number[];
  risks: number[];
  hasPressOrSocial: boolean;
  sourceCounts: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
  sampleSummaries: string[];
}

const WINDOW_HOURS = 72;

const STAGE_RANK: Record<Stage, number> = { borbulhando: 0, ativo: 1, manchete: 2 };
const LEVEL_RANK: Record<Level, number> = { amarelo: 0, laranja: 1, vermelho: 2 };

// Depois que o gabinete resolve um assunto, ele só pode virar alerta de novo passado
// esse período. Sem isso o cron (que roda muito mais rápido que a janela de 72h)
// recria em minutos exatamente o que a pessoa acabou de fechar — e o alerta resolvido
// deixa de significar qualquer coisa.
const RESOLVED_COOLDOWN_HOURS = 24;

// Teto de evidências por alerta: a coluna é um array, não uma tabela filha.
const MAX_EVIDENCE = 50;

function stageOf(b: Bucket): Stage {
  if (b.hasPressOrSocial) return "manchete";
  if (b.messageIds.length >= 8) return "ativo";
  return "borbulhando";
}

function levelOf(b: Bucket): Level {
  const avgSent = b.sentiments.reduce((a, c) => a + c, 0) / Math.max(1, b.sentiments.length);
  const maxRisk = b.risks.reduce((a, c) => Math.max(a, c), 0);
  if (b.hasPressOrSocial || (maxRisk >= 70 && avgSent < -0.3)) return "vermelho";
  if (maxRisk >= 55 || avgSent < -0.4) return "laranja";
  return "amarelo";
}

/**
 * Normaliza um pedaço da chave de deduplicação.
 *
 * Tema e bairro vêm da IA em texto livre: "Jardim Morada", "jardim  morada" e
 * "Jardim Morada " são o MESMO assunto, mas `toLowerCase()` sozinho gerava três
 * chaves distintas — e três alertas. Acento idem ("Vianelo"/"Vianêlo"). Aqui a
 * saída é sempre `[a-z0-9_]`, então a chave é estável entre execuções.
 */
function normalizeKeyPart(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Chave determinística do assunto: `tema::bairro`, com `-` quando não há bairro.
 * Nunca retorna vazio/NULL — alerta sem chave é alerta que nunca deduplica, que
 * foi como a org piloto acumulou centenas de linhas do mesmo tema.
 */
function dedupeKey(topic: string, neighborhood: string | null): string {
  const t = normalizeKeyPart(topic) || "sem_tema";
  const n = normalizeKeyPart(neighborhood) || "-";
  return `${t}::${n}`.slice(0, 200);
}

function highestOf<T extends string>(rank: Record<T, number>, a: T, b: T): T {
  return rank[a] >= rank[b] ? a : b;
}

interface OpenAlertRow {
  id: string;
  topic: string | null;
  neighborhood: string | null;
  level: Level;
  stage: Stage;
  max_risk: number | null;
  first_seen_at: string;
  recommended_action: string | null;
  evidence_message_ids: string[] | null;
}

/**
 * Carrega os alertas ABERTOS da org agrupados pela chave **recalculada** a partir
 * de tema+bairro — de propósito não confiamos na coluna `dedupe_key`: é ela que
 * está nula no passivo. Recalcular faz a consolidação funcionar retroativamente
 * (adota o que nasceu sem chave) e ser idempotente se a normalização mudar de novo.
 *
 * Uma query paginada por execução, em vez de um SELECT por bucket dentro do laço.
 */
async function loadOpenAlertsByKey(orgId: string): Promise<Map<string, OpenAlertRow[]>> {
  const rows = (await fetchAllPages((from, to) =>
    supabaseAdmin
      .from("alerts")
      .select(
        "id, topic, neighborhood, level, stage, max_risk, first_seen_at, recommended_action, evidence_message_ids",
      )
      .eq("org_id", orgId)
      .is("resolved_at", null)
      .order("id", { ascending: true })
      .range(from, to),
  )) as unknown as OpenAlertRow[];

  const byKey = new Map<string, OpenAlertRow[]>();
  for (const r of rows) {
    const key = dedupeKey(r.topic ?? "", r.neighborhood);
    const list = byKey.get(key);
    if (list) list.push(r);
    else byKey.set(key, [r]);
  }
  // O sobrevivente de cada chave é o mais antigo: preserva a data real em que o
  // assunto apareceu (e o `recommended_action` que o gabinete já pode ter lido).
  for (const list of byKey.values()) {
    list.sort((a, b) => a.first_seen_at.localeCompare(b.first_seen_at));
  }
  return byKey;
}

/** Chaves cujo ciclo foi encerrado há pouco — ver `RESOLVED_COOLDOWN_HOURS`. */
async function loadCooldownKeys(orgId: string): Promise<Set<string>> {
  const since = new Date(Date.now() - RESOLVED_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
  const rows = (await fetchAllPages((from, to) =>
    supabaseAdmin
      .from("alerts")
      .select("topic, neighborhood")
      .eq("org_id", orgId)
      .gte("resolved_at", since)
      .order("id", { ascending: true })
      .range(from, to),
  )) as unknown as Array<{ topic: string | null; neighborhood: string | null }>;
  return new Set(rows.map((r) => dedupeKey(r.topic ?? "", r.neighborhood)));
}

/**
 * Evidência nova primeiro (é o que justifica o alerta AGORA), histórico preenchendo
 * o resto até o teto — consolidar não pode significar apagar o rastro do início do
 * ciclo nem o das linhas absorvidas.
 */
function mergeEvidence(...lists: Array<string[] | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const id of list ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= MAX_EVIDENCE) return out;
    }
  }
  return out;
}

async function generateAction(bucket: Bucket): Promise<string> {
  try {
    const prompt = [
      "Você é um consultor político experiente. Com base nas mensagens abaixo,",
      "sugira UMA ação concreta e imediata (máx 160 caracteres) para o gabinete,",
      'no formato de instrução direta. Responda em JSON: {"action": "..."}.',
      "",
      `Tema: ${bucket.topic}`,
      `Bairro: ${bucket.neighborhood ?? "geral"}`,
      `Mensagens (${bucket.sampleSummaries.length}):`,
      ...bucket.sampleSummaries.slice(0, 8).map((s) => `- ${s}`),
    ].join("\n");
    const out = await callAiJson<{ action?: string }>({
      // Explícito, não herdado do default: esta é a chamada de MAIOR volume do sistema
      // (uma por bucket, a cada execução do cron de 30 min). Deixar implícito foi o que
      // fez ~37.900 chamadas irem para o Gemini sem ninguém ter decidido isso.
      model: MODEL_DEEPSEEK,
      fallbackModels: [MODEL_FLASH],
      messages: [
        { role: "system", content: "Responda em JSON puro." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 200,
    });
    return (out.action ?? "").trim() || "Avaliar cenário e responder em 24h.";
  } catch {
    return "Avaliar cenário e responder em 24h.";
  }
}

export async function detectAlertsForOrg(orgId: string): Promise<{
  scanned: number;
  buckets: number;
  upserted: number;
  consolidated: number;
  esfriados: number;
  encerradosPorInatividade: number;
}> {
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  // A detecção só é confiável se enxergar a JANELA INTEIRA: um `.limit()` alto aqui era
  // mentira (o PostgREST corta em 1.000 e não avisa), e bucket truncado = alerta não disparado.
  const rows = (await fetchAllPages((from, to) =>
    supabaseAdmin
      .from("message_analyses")
      .select(
        "message_id, topic, neighborhood, sentiment, risk_score, summary, raw_messages!inner(id, group_id, source_id, posted_at, sources(kind))",
      )
      .eq("org_id", orgId)
      .gte("created_at", since)
      .not("topic", "is", null)
      .order("id", { ascending: true })
      .range(from, to),
  )) as unknown as Array<{
    message_id: string;
    topic: string | null;
    neighborhood: string | null;
    sentiment: number | null;
    risk_score: number | null;
    summary: string | null;
    raw_messages: {
      id: string;
      group_id: string | null;
      source_id: string | null;
      posted_at: string;
      sources: { kind: string } | null;
    } | null;
  }>;

  const buckets = new Map<string, Bucket>();
  for (const r of rows) {
    const topic = r.topic?.trim();
    if (!topic) continue;
    const key = dedupeKey(topic, r.neighborhood);
    let b = buckets.get(key);
    if (!b) {
      b = {
        topic,
        neighborhood: r.neighborhood,
        messageIds: [],
        groupIds: new Set<string>(),
        sentiments: [],
        risks: [],
        hasPressOrSocial: false,
        sourceCounts: {},
        firstSeen: r.raw_messages?.posted_at ?? new Date().toISOString(),
        lastSeen: r.raw_messages?.posted_at ?? new Date().toISOString(),
        sampleSummaries: [],
      };
      buckets.set(key, b);
    }
    b.messageIds.push(r.message_id);
    if (r.raw_messages?.group_id) b.groupIds.add(r.raw_messages.group_id);
    if (typeof r.sentiment === "number") b.sentiments.push(r.sentiment);
    if (typeof r.risk_score === "number") b.risks.push(r.risk_score);
    const kind = r.raw_messages?.sources?.kind;
    if (kind) b.sourceCounts[kind] = (b.sourceCounts[kind] ?? 0) + 1;
    if (
      kind === "news" ||
      kind === "instagram" ||
      kind === "facebook" ||
      kind === "x" ||
      kind === "web_search"
    ) {
      b.hasPressOrSocial = true;
    }
    const ts = r.raw_messages?.posted_at;
    if (ts) {
      if (ts < b.firstSeen) b.firstSeen = ts;
      if (ts > b.lastSeen) b.lastSeen = ts;
    }
    if (r.summary && b.sampleSummaries.length < 12) b.sampleSummaries.push(r.summary);
  }

  // Estado dos alertas já existentes, lido UMA vez por execução (não por bucket).
  const openByKey = await loadOpenAlertsByKey(orgId);
  const cooldownKeys = await loadCooldownKeys(orgId);

  let upserted = 0;
  let consolidated = 0;
  for (const [key, b] of buckets) {
    // Minimum viable signal: external press/social can raise an alert with fewer items;
    // group-only signals still need volume or multiple groups.
    if (!b.hasPressOrSocial && b.messageIds.length < 3 && b.groupIds.size < 2) continue;

    const openForKey = openByKey.get(key) ?? [];
    const primary = openForKey[0];
    const dupes = openForKey.slice(1);

    // REGRA DO CICLO: enquanto houver alerta ABERTO da mesma chave, o assunto é o
    // mesmo evento e o alerta é ATUALIZADO. Depois de resolvido, o assunto voltar é
    // um evento NOVO — cria-se outro alerta em vez de reabrir, porque reabrir apaga o
    // registro de que o gabinete tratou aquilo (some a linha do tempo "resolvemos em X,
    // voltou em Y"). O cooldown evita que "novo ciclo" vire "recriado 20min depois".
    if (!primary && cooldownKeys.has(key)) continue;

    const stage = stageOf(b);
    const level = levelOf(b);
    const avgSent = b.sentiments.reduce((a, c) => a + c, 0) / Math.max(1, b.sentiments.length);
    const maxRisk = b.risks.reduce((a, c) => Math.max(a, c), 0);

    // Passivo: alertas do mesmo assunto que nasceram sem `dedupe_key` e viraram
    // linhas separadas na tela. As evidências vão para o sobrevivente e as demais
    // linhas são encerradas — encerrar, não deletar: `resolved_at` é reversível e
    // preserva o histórico. Gravar a chave junto é seguro porque o índice único é
    // parcial (`WHERE dedupe_key IS NOT NULL AND resolved_at IS NULL`).
    if (dupes.length > 0) {
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from("alerts")
        .update({ resolved_at: nowIso, dedupe_key: key })
        .in(
          "id",
          dupes.map((d) => d.id),
        );
      consolidated += dupes.length;
    }

    const action = primary?.recommended_action ?? (await generateAction(b));

    const sources = Object.entries(b.sourceCounts)
      .sort((a, b2) => b2[1] - a[1])
      .map(([source, count]) => `${source}: ${count}`)
      .join(", ");

    const summary =
      `${b.messageIds.length} sinal(is) em ${b.groupIds.size} grupo(s) sobre "${b.topic}"` +
      (b.neighborhood ? ` (${b.neighborhood})` : "") +
      `. Fontes: ${sources || "grupos"}. Sentimento médio ${avgSent.toFixed(2)}, risco máx ${maxRisk}.`;

    const payload = {
      org_id: orgId,
      // Nível e estágio não DESCEM dentro de um ciclo aberto: o que já foi vermelho e
      // ainda não foi tratado não pode virar amarelo sozinho só porque a janela de 72h
      // esfriou. Para descer, o gabinete resolve — e o próximo ciclo recomeça do zero.
      level: primary ? highestOf(LEVEL_RANK, primary.level, level) : level,
      stage: primary ? highestOf(STAGE_RANK, primary.stage, stage) : stage,
      topic: b.topic,
      neighborhood: b.neighborhood,
      summary,
      recommended_action: action,
      evidence_message_ids: mergeEvidence(
        b.messageIds,
        primary?.evidence_message_ids,
        ...dupes.map((d) => d.evidence_message_ids),
      ),
      dedupe_key: key,
      // `first_seen_at` é o início do ciclo, não o início da janela: sem o `min` o
      // alerta rejuvenescia a cada execução e a idade do problema sumia da tela.
      first_seen_at:
        primary && primary.first_seen_at < b.firstSeen ? primary.first_seen_at : b.firstSeen,
      last_seen_at: b.lastSeen,
      // `message_count` fica sendo o volume da janela (é o "quão quente está agora");
      // `max_risk` é o pior já visto no ciclo, que é o que não pode ser esquecido.
      message_count: b.messageIds.length,
      avg_sentiment: Number(avgSent.toFixed(3)),
      max_risk: Math.max(maxRisk, primary?.max_risk ?? 0),
    };

    if (primary) {
      await supabaseAdmin.from("alerts").update(payload).eq("id", primary.id);
    } else {
      const { error } = await supabaseAdmin.from("alerts").insert(payload);
      // `detectAlertsForOrg` roda pelo cron E pela geração de relatório: duas execuções
      // simultâneas colidem no índice único. O certo aí é atualizar quem chegou primeiro,
      // não estourar a detecção da org inteira por causa de um bucket.
      if (error) {
        await supabaseAdmin
          .from("alerts")
          .update(payload)
          .eq("org_id", orgId)
          .eq("dedupe_key", key)
          .is("resolved_at", null);
      }
    }
    upserted++;
  }

  const esfriados = await esfriarCasosParados(orgId);

  return { scanned: rows.length, buckets: buckets.size, upserted, consolidated, ...esfriados };
}

// Silêncio a partir do qual o caso deixa de ser urgente. A janela de detecção é de 72h,
// então 7 dias sem NENHUM sinal novo é silêncio deliberado, não intervalo entre execuções.
const DIAS_PARA_ESFRIAR = 7;
// Três semanas sem sinal: o assunto morreu. Se voltar, a regra de ciclo cria um caso novo —
// e preservar os dois eventos separados é o que permite dizer "voltou depois de um mês".
const DIAS_PARA_ENCERRAR = 21;

const ESFRIA_PARA: Record<string, string> = { vermelho: "laranja", laranja: "amarelo" };

/**
 * Esfria casos sem sinal novo.
 *
 * A regra "nível não desce dentro de um ciclo aberto" protege o caso EM MOVIMENTO: o que já
 * foi vermelho não vira amarelo só porque a janela de detecção passou. Sem contrapartida,
 * porém, ela nunca solta — o caso fica aberto e vermelho até alguém clicar em resolver. Na
 * org piloto isso deixou metade da tela de triagem marcada como crítica, e tela em que tudo
 * é crítico não tria nada.
 *
 * Aqui a exceção é explícita e só vale para INATIVIDADE: sem sinal novo o caso desce um
 * nível por execução e, persistindo o silêncio, encerra com `closed_reason = 'inatividade'`
 * — nunca confundido com "o gabinete resolveu", que é `closed_reason` nulo.
 */
async function esfriarCasosParados(
  orgId: string,
): Promise<{ esfriados: number; encerradosPorInatividade: number }> {
  const agora = Date.now();
  const corteEsfriar = new Date(agora - DIAS_PARA_ESFRIAR * 86400_000).toISOString();
  const corteEncerrar = new Date(agora - DIAS_PARA_ENCERRAR * 86400_000).toISOString();

  const abertos = await fetchAllPages<{
    id: string;
    level: string | null;
    last_seen_at: string | null;
  }>((from, to) =>
    supabaseAdmin
      .from("alerts")
      .select("id, level, last_seen_at")
      .eq("org_id", orgId)
      .is("resolved_at", null)
      .lte("last_seen_at", corteEsfriar)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (abertos.length === 0) return { esfriados: 0, encerradosPorInatividade: 0 };

  const paraEncerrar = abertos
    .filter((a) => (a.last_seen_at ?? "") <= corteEncerrar)
    .map((a) => a.id);
  const paraEsfriar = abertos.filter(
    (a) => !paraEncerrar.includes(a.id) && a.level && ESFRIA_PARA[a.level],
  );

  if (paraEncerrar.length > 0) {
    const { error } = await supabaseAdmin
      .from("alerts")
      // @ts-expect-error `closed_reason` entra na migração alerts_esfriamento (typegen regenera depois)
      .update({ resolved_at: new Date().toISOString(), closed_reason: "inatividade" })
      .in("id", paraEncerrar);
    if (error) console.error("[alerts] falha ao encerrar por inatividade:", error);
  }

  // Um UPDATE por nível de destino, em vez de um por linha: são dois níveis possíveis.
  let esfriados = 0;
  for (const [de, para] of Object.entries(ESFRIA_PARA)) {
    const ids = paraEsfriar.filter((a) => a.level === de).map((a) => a.id);
    if (ids.length === 0) continue;
    const { error } = await supabaseAdmin
      .from("alerts")
      .update({ level: para as never, updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) console.error(`[alerts] falha ao esfriar ${de}→${para}:`, error);
    else esfriados += ids.length;
  }

  return { esfriados, encerradosPorInatividade: paraEncerrar.length };
}

export async function detectAlertsAllOrgs(): Promise<
  Array<{
    org_id: string;
    scanned?: number;
    upserted?: number;
    consolidated?: number;
    error?: string;
  }>
> {
  // Cron de todas as orgs: paginado porque "todas" tem que ser todas mesmo — uma org
  // fora da primeira página ficaria sem detecção para sempre, e em silêncio.
  const orgs = await fetchAllPages<{ id: string }>((from, to) =>
    supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("is_demo", false)
      .order("id", { ascending: true })
      .range(from, to),
  );

  const results: Array<{
    org_id: string;
    scanned?: number;
    upserted?: number;
    consolidated?: number;
    error?: string;
  }> = [];
  for (const o of orgs) {
    try {
      const r = await detectAlertsForOrg(o.id);
      results.push({
        org_id: o.id,
        scanned: r.scanned,
        upserted: r.upserted,
        consolidated: r.consolidated,
      });
    } catch (e) {
      results.push({ org_id: o.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
