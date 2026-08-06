// Report generator (server-only). Aggregates analyses + alerts for the period
// and asks the AI to write the executive narrative.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAi, MODEL_PRO, MODEL_FLASH, MODEL_DEEPSEEK } from "./ai-gateway.server";
import { buildFallbackReport } from "./report-fallback";
import { fetchAllPages } from "./pg-paginate";

type Kind = "daily" | "weekly" | "monthly";

/** Linha de amostra. Escrita à mão porque `content_fingerprint` ainda não está nos tipos
 *  gerados (migração `message_dedup_fingerprint`) — e `types.ts` é auto-gerado, não se edita. */
type AmostraBruta = {
  message_id?: string | null;
  topic?: string | null;
  neighborhood?: string | null;
  sentiment?: number | null;
  risk_score?: number | null;
  raw_messages?: RawDaAmostra | RawDaAmostra[] | null;
};
type RawDaAmostra = {
  content?: string | null;
  posted_at?: string | null;
  group_id?: string | null;
  content_fingerprint?: string | null;
  raw_payload?: unknown;
  sources?: { kind?: string | null; label?: string | null } | null;
};

/** Cluster de texto idêntico propagado no período — ver `levantarSinaisCoordenados`. */
type SinalCoordenado = {
  texto: string;
  repeticoes: number;
  grupos_distintos: number;
  janela_horas: number;
  primeira_aparicao: string;
  ultima_aparicao: string;
  densidade_propagacao: number;
};

// Limiares de coordenação. Nenhum é arbitrário — saem da medição na org piloto (14.360 mensagens,
// 8.697 clusters únicos), onde três padrões distintos convivem no mesmo corpus:
//   • 18× em 14 grupos em 2,8h  → disparo coordenado (link de portal, vídeo de vereador)
//   • 29× em  2 grupos em 432h  → rotina de bom-dia, ruído
//   • 23× em  6 grupos em 420h  → spam comercial recorrente
// Repetição sozinha NÃO separa os três — os dois primeiros números são parecidos. O que separa é
// a DENSIDADE: muitos grupos distintos em pouco tempo. Daí os cortes abaixo.
const MIN_REPETICOES = 5; // abaixo disso é coincidência/conversa, não propagação
const MIN_GRUPOS = 3; // 2 grupos é vizinho encaminhando pro vizinho; 3+ já é rede
const MAX_JANELA_HORAS = 24; // o que se espalha por semanas é rotina/spam, não operação
const TOP_SINAIS = 8; // é bloco de destaque no prompt, não inventário

/**
 * Levanta os textos que se propagaram por vários grupos em pouco tempo.
 *
 * Passe próprio, deliberadamente separado do pool de amostras: amostra é limitada a 600 linhas
 * ordenadas por risco/recência, e um disparo coordenado pode ser todo de risco baixo (link de
 * portal, vídeo elogioso) e sumir dessa janela. Aqui o período inteiro entra.
 *
 * Só mensagens com `group_id`: propagação entre grupos é o sinal, e notícia/post sem grupo não
 * tem como participar dele.
 */
async function levantarSinaisCoordenados(
  orgId: string,
  start: Date,
  end: Date,
): Promise<SinalCoordenado[]> {
  // `string` cru na variável: com literal, o typegen tenta resolver `content_fingerprint` na
  // definição desatualizada e derruba a query inteira num SelectQueryError.
  const colsLeves: string = "content_fingerprint, group_id, posted_at";
  type LinhaLeve = {
    content_fingerprint: string | null;
    group_id: string | null;
    posted_at: string | null;
  };
  const linhas = await fetchAllPages<LinhaLeve>((from, to) =>
    supabaseAdmin
      .from("raw_messages")
      .select(colsLeves)
      .eq("org_id", orgId)
      .gte("posted_at", start.toISOString())
      .lte("posted_at", end.toISOString())
      .not("content_fingerprint", "is", null)
      .not("group_id", "is", null)
      .order("id", { ascending: true }) // ordem estável — sem isso a paginação repete/pula linhas
      .range(from, to)
      .returns<LinhaLeve[]>(),
  );

  const clusters = new Map<string, { total: number; grupos: Set<string>; ts: number[] }>();
  for (const l of linhas) {
    const fp = l.content_fingerprint;
    if (!fp) continue;
    const c = clusters.get(fp) ?? { total: 0, grupos: new Set<string>(), ts: [] };
    c.total += 1;
    if (l.group_id) c.grupos.add(l.group_id);
    const t = l.posted_at ? Date.parse(l.posted_at) : NaN;
    if (Number.isFinite(t)) c.ts.push(t);
    clusters.set(fp, c);
  }

  const candidatos = [...clusters.entries()]
    .map(([fp, c]) => {
      const primeiro = Math.min(...c.ts);
      const ultimo = Math.max(...c.ts);
      const janela = c.ts.length ? (ultimo - primeiro) / 3600_000 : 0;
      return { fp, c, janela, primeiro, ultimo };
    })
    .filter(
      (x) =>
        x.c.total >= MIN_REPETICOES &&
        x.c.grupos.size >= MIN_GRUPOS &&
        x.janela <= MAX_JANELA_HORAS,
    )
    // Piso de meia hora na janela: encaminhamento quase simultâneo é o caso MAIS forte, não pode
    // virar divisão por ~0 e estourar o ranking com base em ruído de timestamp.
    .map((x) => ({ ...x, densidade: x.c.grupos.size / Math.max(x.janela, 0.5) }))
    .sort((a, b) => b.densidade - a.densidade)
    .slice(0, TOP_SINAIS);

  if (candidatos.length === 0) return [];

  // Só agora paga o custo do `content`, e só dos clusters que entraram no top-N.
  // Uma query por cluster com `limit(1)`, em paralelo, em vez de um `.in()` com teto:
  // precisamos de UM representante por fingerprint, e um `.limit(N)` global sobre todas as
  // cópias seria justamente o truncamento silencioso que este projeto acabou de varrer —
  // se os clusters do topo somassem mais que o teto, algum ficaria sem texto, sem aviso.
  const colsTexto: string = "content";
  type LinhaTexto = { content: string | null };
  const textoPorFp = new Map<string, string>();
  await Promise.all(
    candidatos.map(async (x) => {
      const { data } = await supabaseAdmin
        .from("raw_messages")
        .select(colsTexto)
        .eq("org_id", orgId)
        // `.filter()` e não `.eq()`: o typegen ainda não conhece `content_fingerprint`
        // (coluna gerada na migração `message_dedup_fingerprint`) e `.eq()` só aceita
        // nome de coluna já tipado. `types.ts` é auto-gerado — não se edita.
        .filter("content_fingerprint", "eq", x.fp)
        .order("posted_at", { ascending: true }) // o representante é a PRIMEIRA aparição
        .limit(1)
        .returns<LinhaTexto[]>();
      const conteudo = data?.[0]?.content;
      if (conteudo) textoPorFp.set(x.fp, String(conteudo));
    }),
  );

  return candidatos.map((x) => ({
    texto: (textoPorFp.get(x.fp) ?? "").slice(0, 320),
    repeticoes: x.c.total,
    grupos_distintos: x.c.grupos.size,
    janela_horas: +x.janela.toFixed(1),
    primeira_aparicao: new Date(x.primeiro).toISOString(),
    ultima_aparicao: new Date(x.ultimo).toISOString(),
    densidade_propagacao: +x.densidade.toFixed(2),
  }));
}

function periodFor(kind: Kind, now = new Date()): { start: Date; end: Date; title: string } {
  const end = now;
  if (kind === "daily") {
    const start = new Date(end.getTime() - 24 * 3600_000);
    return { start, end, title: `Relatório diário — ${end.toISOString().slice(0, 10)}` };
  }
  if (kind === "weekly") {
    const start = new Date(end.getTime() - 7 * 86400_000);
    return {
      start,
      end,
      title: `Relatório semanal — semana de ${start.toISOString().slice(0, 10)}`,
    };
  }
  const start = new Date(end.getTime() - 30 * 86400_000);
  return { start, end, title: `Análise mensal — ${end.toISOString().slice(0, 7)}` };
}

export async function generateReport(orgId: string, kind: Kind): Promise<string> {
  const { start, end, title } = periodFor(kind);

  // Best-effort enrichment: analyzing pending messages and refreshing alerts makes the report
  // richer, but a failure here (e.g. AI hiccup during analysis) must NOT abort the report —
  // we still generate from whatever data already exists.
  try {
    const { runAnalysisForPendingMessages } = await import("@/lib/ingest.server");
    await runAnalysisForPendingMessages(orgId, kind === "daily" ? 120 : 200);
  } catch (e) {
    console.error(
      `[report] análise pré-relatório falhou (org ${orgId}), seguindo com dados existentes:`,
      e,
    );
  }
  try {
    const { detectAlertsForOrg } = await import("@/lib/alerts.server");
    await detectAlertsForOrg(orgId);
  } catch (e) {
    console.error(`[report] detecção de alertas falhou (org ${orgId}), seguindo:`, e);
  }

  const priorLimit = kind === "daily" ? 5 : kind === "weekly" ? 4 : 3;
  const { data: priorSameKind } = await supabaseAdmin
    .from("reports")
    .select("kind, title, period_start, period_end, generated_at, markdown")
    .eq("org_id", orgId)
    .eq("kind", kind)
    .lt("generated_at", end.toISOString())
    .order("generated_at", { ascending: false })
    .limit(priorLimit);
  // For weekly/monthly, also include the most recent broader report for narrative continuity
  const { data: priorBroader } =
    kind === "daily"
      ? { data: [] as typeof priorSameKind }
      : await supabaseAdmin
          .from("reports")
          .select("kind, title, period_start, period_end, generated_at, markdown")
          .eq("org_id", orgId)
          .in("kind", kind === "weekly" ? ["monthly"] : ["weekly", "monthly"])
          .lt("generated_at", end.toISOString())
          .order("generated_at", { ascending: false })
          .limit(2);

  // Dois passes deliberadamente separados:
  //  • LEVE (paginado, período INTEIRO) → todos os números: contagens, tendência, bairros,
  //    opositores, fontes. Sem `content`, que é o que pesa.
  //  • AMOSTRAS (limitado) → só ele carrega o texto das mensagens, que alimenta as citações
  //    e o prompt. Não faz sentido (nem cabe) mandar o período inteiro para a IA.
  const SAMPLE_LIMIT = 300;
  // `string` cru: `content_fingerprint` ainda não existe nos tipos gerados (ver AmostraBruta).
  const sampleCols: string =
    "message_id, topic, neighborhood, sentiment, risk_score, raw_messages!inner(content, posted_at, group_id, content_fingerprint, raw_payload, sources!inner(kind, label))";
  const [
    { data: org },
    analyses,
    alerts,
    { data: vocab },
    { data: signals },
    byRisk,
    byRecent,
    sinaisCoordenados,
  ] = await Promise.all([
    supabaseAdmin.from("organizations").select("name, city").eq("id", orgId).maybeSingle(),
    fetchAllPages((from, to) =>
      supabaseAdmin
        .from("message_analyses")
        .select(
          "topic, neighborhood, sentiment, risk_score, mentioned_opponents, raw_messages!inner(posted_at, sources!inner(kind))",
        )
        .eq("org_id", orgId)
        .gte("raw_messages.posted_at", start.toISOString())
        .lte("raw_messages.posted_at", end.toISOString())
        .order("id", { ascending: true }) // ordem estável: sem isso a paginação repete/pula linhas
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabaseAdmin
        .from("alerts")
        .select("level, topic, neighborhood, summary, created_at")
        .eq("org_id", orgId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    supabaseAdmin.from("org_vocabulary").select("kind, value").eq("org_id", orgId),
    supabaseAdmin
      .from("raw_messages")
      .select(
        "id, content, posted_at, raw_payload, sources!inner(kind, label), analysis:message_analyses(topic, neighborhood, sentiment, risk_score, summary)",
      )
      .eq("org_id", orgId)
      .gte("posted_at", start.toISOString())
      .lte("posted_at", end.toISOString())
      .in("sources.kind", ["news", "instagram", "facebook", "x", "whatsapp"])
      .order("posted_at", { ascending: false })
      .limit(500),
    // Amostras por RISCO (o que importa) …
    supabaseAdmin
      .from("message_analyses")
      .select(sampleCols)
      .eq("org_id", orgId)
      .gte("raw_messages.posted_at", start.toISOString())
      .lte("raw_messages.posted_at", end.toISOString())
      .order("risk_score", { ascending: false })
      .limit(SAMPLE_LIMIT),
    // … e por RECÊNCIA, para temas positivos/tranquilos também renderem citação.
    supabaseAdmin
      .from("message_analyses")
      .select(sampleCols)
      .eq("org_id", orgId)
      .gte("raw_messages.posted_at", start.toISOString())
      .lte("raw_messages.posted_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(SAMPLE_LIMIT),
    // Bloco de sinal próprio: repetição deixa de ser só desperdício de token e vira indício.
    levantarSinaisCoordenados(orgId, start, end).catch((e) => {
      console.error(`[report] levantamento de propagação coordenada falhou (org ${orgId}):`, e);
      return [] as SinalCoordenado[];
    }),
  ]);

  // Pool de amostras: risco + recência, colapsado por CLUSTER de texto (não só por mensagem).
  // WhatsApp de bairro é máquina de forward: sem isso, ~28% do orçamento de 600 amostras ia
  // embora repetindo o mesmo encaminhamento, e a IA via menos assunto DIFERENTE. Mensagem curta
  // não tem fingerprint (o banco deixa NULL de propósito) e conta como cluster próprio.
  const clustersVistos = new Map<string, { repeticoes: number; grupos: Set<string> }>();
  const mensagensVistas = new Set<string>();
  const samplePool: AmostraBruta[] = [];
  for (const s of [
    ...((byRisk.data ?? []) as AmostraBruta[]),
    ...((byRecent.data ?? []) as AmostraBruta[]),
  ]) {
    const raw = Array.isArray(s.raw_messages) ? s.raw_messages[0] : s.raw_messages;
    const messageId = String(s.message_id ?? "");
    if (!messageId || mensagensVistas.has(messageId)) continue;
    // Dedup por mensagem ANTES do cluster: as duas queries se sobrepõem, e a mesma linha vindo
    // por risco e por recência inflaria a multiplicidade sem existir encaminhamento nenhum.
    mensagensVistas.add(messageId);
    const chave = raw?.content_fingerprint ? `fp:${raw.content_fingerprint}` : `msg:${messageId}`;
    const acc = clustersVistos.get(chave);
    if (acc) {
      // Já temos um representante do cluster: a cópia só engorda a multiplicidade.
      acc.repeticoes += 1;
      if (raw?.group_id) acc.grupos.add(raw.group_id);
      continue;
    }
    clustersVistos.set(chave, {
      repeticoes: 1,
      grupos: new Set(raw?.group_id ? [raw.group_id] : []),
    });
    samplePool.push({ ...s, __cluster: chave } as AmostraBruta & { __cluster: string });
  }
  /** Multiplicidade do cluster DENTRO da amostra (o número do período inteiro está em
   *  `coordinated_signals`) — vai junto da citação para a IA não tratar forward como fala isolada. */
  const multiplicidade = (s: AmostraBruta) => {
    const c = clustersVistos.get((s as { __cluster?: string }).__cluster ?? "");
    return { repeticoes: c?.repeticoes ?? 1, grupos: c?.grupos.size ?? 0 };
  };

  // Aggregate
  const topicCounts = new Map<
    string,
    {
      count: number;
      sentSum: number;
      maxRisk: number;
      samples: Array<{
        text: string;
        sentiment: number;
        risk: number;
        neighborhood: string | null;
        source: string;
        posted_at: string | null;
        repeticoes: number;
        grupos: number;
      }>;
    }
  >();
  const neighSent = new Map<
    string,
    { count: number; sentSum: number; topics: Map<string, number> }
  >();
  const oppCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const sentimentTrend = new Map<string, { count: number; sentSum: number }>();
  const highRiskMessages: Array<{
    text: string;
    risk: number;
    sentiment: number;
    topic: string;
    neighborhood: string | null;
    source: string;
    posted_at: string | null;
    url: string | null;
    repeticoes: number;
    grupos: number;
  }> = [];
  // Passe 1 — NÚMEROS sobre o período inteiro (sem texto).
  for (const a of analyses) {
    const raw = Array.isArray(a.raw_messages) ? a.raw_messages[0] : a.raw_messages;
    const sourceKind = raw?.sources?.kind ?? "desconhecida";
    const day = raw?.posted_at ? String(raw.posted_at).slice(5, 10) : "sem data";
    sourceCounts.set(sourceKind, (sourceCounts.get(sourceKind) ?? 0) + 1);
    const dayEntry = sentimentTrend.get(day) ?? { count: 0, sentSum: 0 };
    dayEntry.count += 1;
    dayEntry.sentSum += Number(a.sentiment ?? 0);
    sentimentTrend.set(day, dayEntry);
    const t = a.topic ?? "outros";
    const tc = topicCounts.get(t) ?? { count: 0, sentSum: 0, maxRisk: 0, samples: [] };
    tc.count += 1;
    tc.sentSum += Number(a.sentiment ?? 0);
    tc.maxRisk = Math.max(tc.maxRisk, a.risk_score ?? 0);
    topicCounts.set(t, tc);
    if (a.neighborhood) {
      const nc = neighSent.get(a.neighborhood) ?? {
        count: 0,
        sentSum: 0,
        topics: new Map<string, number>(),
      };
      nc.count += 1;
      nc.sentSum += Number(a.sentiment ?? 0);
      nc.topics.set(t, (nc.topics.get(t) ?? 0) + 1);
      neighSent.set(a.neighborhood, nc);
    }
    for (const o of a.mentioned_opponents ?? []) oppCounts.set(o, (oppCounts.get(o) ?? 0) + 1);
  }

  // Passe 2 — TEXTO: citações por tema e mensagens de alto risco, do pool amostrado.
  for (const s of samplePool) {
    const raw = Array.isArray(s.raw_messages) ? s.raw_messages[0] : s.raw_messages;
    if (!raw?.content) continue;
    const sourceKind = raw.sources?.kind ?? "desconhecida";
    const payload = raw.raw_payload as { url?: string; title?: string } | null;
    const t = s.topic ?? "outros";
    const mult = multiplicidade(s);
    // Só anexa amostra a tema que existe no passe 1 — a contagem vem de lá, nunca daqui.
    const tc = topicCounts.get(t);
    if (tc && tc.samples.length < 5) {
      tc.samples.push({
        text: String(raw.content).slice(0, 260),
        sentiment: Number(s.sentiment ?? 0),
        risk: s.risk_score ?? 0,
        neighborhood: s.neighborhood ?? null,
        source: sourceKind,
        posted_at: raw.posted_at ?? null,
        repeticoes: mult.repeticoes,
        grupos: mult.grupos,
      });
    }
    if ((s.risk_score ?? 0) >= 55) {
      highRiskMessages.push({
        text: String(raw.content).slice(0, 320),
        risk: s.risk_score ?? 0,
        sentiment: Number(s.sentiment ?? 0),
        topic: t,
        neighborhood: s.neighborhood ?? null,
        source: sourceKind,
        posted_at: raw.posted_at ?? null,
        url: payload?.url ?? null,
        repeticoes: mult.repeticoes,
        grupos: mult.grupos,
      });
    }
  }

  const topTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([label, v]) => ({
      label,
      count: v.count,
      avg_sentiment: +(v.sentSum / v.count).toFixed(2),
      max_risk: v.maxRisk,
      samples: v.samples,
    }));
  const topNeighborhoods = [...neighSent.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([label, v]) => ({
      label,
      count: v.count,
      avg_sentiment: +(v.sentSum / v.count).toFixed(2),
      top_topics: [...v.topics.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t, c]) => ({ label: t, count: c })),
    }));
  const topOpponents = [...oppCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const bySource = Object.fromEntries([...sourceCounts.entries()].sort((a, b) => b[1] - a[1]));
  const trend = [...sentimentTrend.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, v]) => ({ d, v: +(v.sentSum / v.count).toFixed(2), count: v.count }));
  const externalSignals = (signals ?? [])
    .map((s) => {
      const source = Array.isArray(s.sources) ? s.sources[0] : s.sources;
      const analysis = Array.isArray(s.analysis) ? s.analysis[0] : s.analysis;
      const payload = s.raw_payload as { url?: string; title?: string } | null;
      return {
        id: s.id,
        source: source?.kind ?? "desconhecida",
        label: source?.label ?? null,
        title: payload?.title ?? analysis?.summary ?? String(s.content ?? "").slice(0, 90),
        url: payload?.url ?? null,
        posted_at: s.posted_at,
        topic: analysis?.topic ?? null,
        neighborhood: analysis?.neighborhood ?? null,
        sentiment: analysis?.sentiment ?? null,
        risk_score: analysis?.risk_score ?? 0,
        summary: analysis?.summary ?? String(s.content ?? "").slice(0, 220),
        excerpt: String(s.content ?? "").slice(0, 400),
      };
    })
    .sort((a, b) => Number(b.risk_score ?? 0) - Number(a.risk_score ?? 0));
  const topExternalForPrompt = externalSignals.slice(0, 25);
  const topHighRisk = highRiskMessages.sort((a, b) => b.risk - a.risk).slice(0, 15);
  const alertsByLevel = {
    vermelho: alerts.filter((a) => a.level === "vermelho").length,
    laranja: alerts.filter((a) => a.level === "laranja").length,
    amarelo: alerts.filter((a) => a.level === "amarelo").length,
  };

  const dataBlock = {
    org: org?.name,
    city: org?.city,
    period: { start: start.toISOString(), end: end.toISOString(), kind },
    counts: {
      // Conta TODAS as mensagens do período, encaminhamentos inclusive — o volume real não
      // diminui porque houve forward. A dedup vale para amostra e sinal, nunca para contagem.
      messages_analyzed: analyses.length,
      alerts: alertsByLevel,
      by_source: bySource,
    },
    top_topics: topTopics,
    top_neighborhoods: topNeighborhoods,
    top_opponents: topOpponents,
    sentiment_trend: trend,
    external_signals: externalSignals,
    high_risk_messages: topHighRisk,
    coordinated_signals: sinaisCoordenados,
    sample_alerts: alerts.slice(0, 20),
  };

  // Prior reports as narrative context (truncated to keep tokens sane)
  const trimMd = (md: string | null | undefined, max: number) => {
    const s = (md ?? "").trim();
    return s.length > max ? s.slice(0, max) + "\n\n[…truncado…]" : s;
  };
  const priorReports = [
    ...(priorSameKind ?? []).map((r) => ({
      kind: r.kind,
      title: r.title,
      period_start: r.period_start,
      period_end: r.period_end,
      generated_at: r.generated_at,
      markdown: trimMd(r.markdown, kind === "daily" ? 2500 : 4000),
    })),
    ...(priorBroader ?? []).map((r) => ({
      kind: r.kind,
      title: r.title,
      period_start: r.period_start,
      period_end: r.period_end,
      generated_at: r.generated_at,
      markdown: trimMd(r.markdown, 5000),
    })),
  ];

  // Reduced payload for the AI prompt (avoid token bloat but keep quotes for citation)
  const promptData = {
    ...dataBlock,
    external_signals: topExternalForPrompt,
    sample_alerts: alerts.slice(0, 12),
    prior_reports: priorReports,
  };

  const kindLabel =
    kind === "daily"
      ? "diário (últimas 24h)"
      : kind === "weekly"
        ? "semanal (últimos 7 dias)"
        : "mensal (últimos 30 dias)";

  // Resilient AI narrative: pro-preview with flash as fallback, retries + timeout built in.
  // If it still fails or comes back too thin, we fall back to a deterministic report built
  // from the aggregated data below — so a period is NEVER left without a report.
  let markdown: string;
  let modelVersion: string;
  let degraded = false;
  try {
    const aiResp = await callAi({
      model: MODEL_PRO,
      fallbackModels: [MODEL_DEEPSEEK, MODEL_FLASH], // PRO → DeepSeek → Flash → determinístico
      temperature: 0.45,
      maxTokens: 8000,
      timeoutMs: 90_000,
      messages: [
        {
          role: "system",
          content:
            'Você é o analista-chefe de inteligência política de um gabinete municipal brasileiro. Escreve relatórios densos, jornalísticos e acionáveis em português do Brasil, em markdown limpo. Nunca inventa dados — só usa o que está no JSON fornecido. Cita trechos reais entre aspas quando ilustram um ponto. Prefere análise causal ("por que isso está acontecendo") a listas rasas. Sempre conecta sinais entre canais (WhatsApp × Instagram × imprensa) e nomeia bairros, temas e adversários quando presentes no vocabulário. Quando o JSON contém `prior_reports`, você DEVE ler esses relatórios anteriores e dialogar com eles: dizer o que evoluiu, o que se confirmou, o que arrefeceu, quais recomendações passadas foram atendidas ou ignoradas, e quais temas persistem. O relatório novo é um capítulo de uma série, não um documento isolado. Quando o JSON traz `coordinated_signals`, trate propagação como evidência de primeira ordem: texto idêntico aparecendo em vários grupos distintos em poucas horas é indício de operação organizada, não de conversa espontânea, e merece destaque analítico. Mas o dado mostra PROPAGAÇÃO, não autoria: descreva o padrão e o efeito, e nunca afirme quem coordenou, com que intenção ou a mando de quem — se especular sobre origem, marque explicitamente como hipótese a verificar. Tom: sério, técnico, direto ao ponto — como um briefing de gabinete de campanha profissional.',
        },
        {
          role: "user",
          content: `Gere um relatório ${kindLabel} para o gabinete usando EXCLUSIVAMENTE os dados abaixo. O relatório precisa ser longo, profundo e útil — não superficial. Sempre que citar um sinal, use aspas com o trecho real do JSON (external_signals[].excerpt, high_risk_messages[].text, top_topics[].samples[].text). Quando dois sinais convergem (ex: mesmo tema aparece em imprensa e WhatsApp), destaque a convergência.

IMPORTANTE — CONTINUIDADE HISTÓRICA: O JSON traz \`prior_reports\` (relatórios anteriores do mesmo gabinete, mais recentes primeiro). Use-os como memória: compare tendências, verifique se temas quentes anteriores esfriaram ou se agravaram, cite explicitamente o que dizia o relatório anterior quando fizer sentido ("no relatório de DD/MM já apontávamos X; agora Y"), e avalie o cumprimento das recomendações passadas. NÃO copie trechos dos relatórios anteriores — sintetize e evolua.

Estruture assim (mantenha exatamente estes títulos):

# ${title}

## 🎯 Resumo executivo
Máximo 4 linhas. Diga: (a) o clima geral do período, (b) o tema mais quente, (c) o risco mais urgente, (d) a oportunidade mais óbvia.

## 📊 Panorama quantitativo
Comente os números de counts (mensagens, alertas por nível, distribuição por canal). Interprete — não apenas repita. Ex: "60% dos sinais vieram da imprensa, indicando que a narrativa ainda está mais na mídia do que nas ruas".

## 🔥 O que esquentou — análise por tema
Para os 4-6 top_topics mais relevantes, escreva um parágrafo denso cada um contendo:
- Volume e evolução (count, avg_sentiment, max_risk)
- **Citação real** de samples[].text entre aspas (obrigatório quando existir)
- Bairros ou canais em que o tema aparece mais
- Por que isso importa politicamente

## 🗺️ Mapa por bairro
Para os top_neighborhoods, cruze bairro × temas dominantes (top_topics por bairro). Aponte bairros com sentimento negativo forte e explique.

## 📰 Sinais externos — imprensa, Instagram e grupos
Análise dos external_signals de maior risco. Para cada um dos 5-8 mais relevantes, um parágrafo com: fonte, título/citação, tema, por que entrou no radar. Cite URLs quando existirem.

## ⚠️ Riscos emergentes (mensagens de maior risco)
Discuta os 3-5 itens de maior risk_score em high_risk_messages. Cite o texto entre aspas. Explique o vetor: adversário, viralização, tema sensível?

## 📡 Propagação coordenada
Analise \`coordinated_signals\` — cada item é um texto IDÊNTICO que circulou em vários grupos no período (\`repeticoes\`, \`grupos_distintos\`, \`janela_horas\`). Já vem filtrado: só entram clusters que atingiram muitos grupos em pouco tempo, ou seja, o padrão de disparo, não o de rotina ou spam. Para os 3-5 mais densos, um parágrafo com: a citação real entre aspas, o alcance (quantos grupos, em quantas horas), o tema que o conteúdo empurra e o efeito prático sobre a narrativa local. Regra dura: o dado prova que o conteúdo se espalhou de forma organizada, NÃO prova quem organizou — não atribua autoria nem intenção a ninguém; se levantar hipótese de origem, escreva que é hipótese a verificar. Se o array estiver vazio, diga em 1 linha que nenhum conteúdo atingiu o padrão de propagação coordenada no período e siga.

## 🎭 Opositores e narrativas
Se top_opponents tem dados, analise quem está mais ativo, em que tema e qual narrativa está tentando emplacar. Se estiver vazio, diga isso explicitamente.

## 🚨 Alertas críticos
Liste os sample_alerts nível vermelho e laranja com contexto — não apenas o nome, mas o que está por trás.

## 🎯 Recomendações acionáveis
Divida em três horizontes:
- **Próximas 24h** (o que fazer amanhã de manhã)
- **Próximos 3-7 dias** (contra-narrativas, comunicação proativa)
- **Monitorar** (sinais fracos que podem virar problema)

## 🔍 Indicadores para acompanhar
2-4 métricas específicas que o gabinete deve olhar de perto no próximo ciclo, com base no que apareceu aqui.

REGRAS:
- Mínimo ~1500 palavras. Densidade > brevidade.
- Nunca escreva "não há dados" para uma seção sem antes ter olhado o JSON.
- Se uma seção realmente estiver vazia (ex: sem opositores mapeados), diga isso em 1 linha e siga.
- Use **negrito** para nomes de bairros, temas e adversários.
- Nada de emojis fora dos títulos.

DADOS:
\`\`\`json
${JSON.stringify(promptData, null, 2)}
\`\`\``,
        },
      ],
    });
    const text = (aiResp.text ?? "").trim();
    // A real report carries the markdown title and meaningful length. Thin/truncated output
    // (maxTokens hit, model stub) counts as a failure → deterministic fallback below.
    if (text.length < 600 || !text.includes("#")) {
      throw new Error(`Saída da IA muito curta/incompleta (${text.length} chars).`);
    }
    markdown = text;
    modelVersion = aiResp.model;
  } catch (e) {
    console.error(
      `[report] narrativa por IA falhou (org ${orgId}, ${kind}) — usando fallback determinístico:`,
      e,
    );
    markdown = buildFallbackReport(title, kindLabel, dataBlock);
    modelVersion = "fallback-deterministico";
    degraded = true;
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("reports")
    .insert({
      org_id: orgId,
      kind,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      title,
      markdown,
      data: dataBlock,
      model_version: modelVersion,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("audit_log").insert({
    org_id: orgId,
    action: `report.${kind}.generated${degraded ? ".degraded" : ""}`,
    target_kind: "report",
    target_id: inserted.id,
  });

  return inserted.id;
}
