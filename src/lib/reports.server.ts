// Report generator (server-only). Aggregates analyses + alerts for the period
// and asks the AI to write the executive narrative.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAi, MODEL_PRO, MODEL_FLASH } from "./ai-gateway.server";
import { buildFallbackReport } from "./report-fallback";

type Kind = "daily" | "weekly" | "monthly";

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

  const [{ data: org }, { data: analyses }, { data: alerts }, { data: vocab }, { data: signals }] =
    await Promise.all([
      supabaseAdmin.from("organizations").select("name, city").eq("id", orgId).maybeSingle(),
      supabaseAdmin
        .from("message_analyses")
        .select(
          "topic, neighborhood, sentiment, risk_score, summary, mentioned_opponents, raw_messages!inner(id, content, posted_at, raw_payload, sources!inner(kind, label))",
        )
        .eq("org_id", orgId)
        .gte("raw_messages.posted_at", start.toISOString())
        .lte("raw_messages.posted_at", end.toISOString())
        .limit(2000),
      supabaseAdmin
        .from("alerts")
        .select("level, topic, neighborhood, summary, created_at")
        .eq("org_id", orgId)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
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
    ]);

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
  }> = [];
  for (const a of analyses ?? []) {
    const raw = Array.isArray(a.raw_messages) ? a.raw_messages[0] : a.raw_messages;
    const sourceKind = raw?.sources?.kind ?? "desconhecida";
    const payload = raw?.raw_payload as { url?: string; title?: string } | null;
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
    if (tc.samples.length < 5 && raw?.content) {
      tc.samples.push({
        text: String(raw.content).slice(0, 260),
        sentiment: Number(a.sentiment ?? 0),
        risk: a.risk_score ?? 0,
        neighborhood: a.neighborhood ?? null,
        source: sourceKind,
        posted_at: raw.posted_at ?? null,
      });
    }
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
    if ((a.risk_score ?? 0) >= 55 && raw?.content) {
      highRiskMessages.push({
        text: String(raw.content).slice(0, 320),
        risk: a.risk_score ?? 0,
        sentiment: Number(a.sentiment ?? 0),
        topic: t,
        neighborhood: a.neighborhood ?? null,
        source: sourceKind,
        posted_at: raw.posted_at ?? null,
        url: payload?.url ?? null,
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
    vermelho: (alerts ?? []).filter((a) => a.level === "vermelho").length,
    laranja: (alerts ?? []).filter((a) => a.level === "laranja").length,
    amarelo: (alerts ?? []).filter((a) => a.level === "amarelo").length,
  };

  const dataBlock = {
    org: org?.name,
    city: org?.city,
    period: { start: start.toISOString(), end: end.toISOString(), kind },
    counts: {
      messages_analyzed: analyses?.length ?? 0,
      alerts: alertsByLevel,
      by_source: bySource,
    },
    top_topics: topTopics,
    top_neighborhoods: topNeighborhoods,
    top_opponents: topOpponents,
    sentiment_trend: trend,
    external_signals: externalSignals,
    high_risk_messages: topHighRisk,
    sample_alerts: (alerts ?? []).slice(0, 20),
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
    sample_alerts: (alerts ?? []).slice(0, 12),
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
      fallbackModels: [MODEL_FLASH],
      temperature: 0.45,
      maxTokens: 8000,
      timeoutMs: 90_000,
      messages: [
        {
          role: "system",
          content:
            'Você é o analista-chefe de inteligência política de um gabinete municipal brasileiro. Escreve relatórios densos, jornalísticos e acionáveis em português do Brasil, em markdown limpo. Nunca inventa dados — só usa o que está no JSON fornecido. Cita trechos reais entre aspas quando ilustram um ponto. Prefere análise causal ("por que isso está acontecendo") a listas rasas. Sempre conecta sinais entre canais (WhatsApp × Instagram × imprensa) e nomeia bairros, temas e adversários quando presentes no vocabulário. Quando o JSON contém `prior_reports`, você DEVE ler esses relatórios anteriores e dialogar com eles: dizer o que evoluiu, o que se confirmou, o que arrefeceu, quais recomendações passadas foram atendidas ou ignoradas, e quais temas persistem. O relatório novo é um capítulo de uma série, não um documento isolado. Tom: sério, técnico, direto ao ponto — como um briefing de gabinete de campanha profissional.',
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
