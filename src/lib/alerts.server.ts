// Alerts detection engine (server-only).
// Aggregates recent analyzed messages into topic × neighborhood buckets and
// upserts open alerts in `public.alerts` with a computed stage and level.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiJson } from "@/lib/ai-gateway.server";

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

function dedupeKey(topic: string, neighborhood: string | null): string {
  return `${topic}::${neighborhood ?? "-"}`.toLowerCase().slice(0, 200);
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
}> {
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { data: analyses, error } = await supabaseAdmin
    .from("message_analyses")
    .select(
      "message_id, topic, neighborhood, sentiment, risk_score, summary, raw_messages!inner(id, group_id, source_id, posted_at, sources(kind))",
    )
    .eq("org_id", orgId)
    .gte("created_at", since)
    .not("topic", "is", null)
    .limit(5000);

  if (error) throw new Error(error.message);

  const rows = (analyses ?? []) as unknown as Array<{
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

  let upserted = 0;
  for (const [key, b] of buckets) {
    // Minimum viable signal: external press/social can raise an alert with fewer items;
    // group-only signals still need volume or multiple groups.
    if (!b.hasPressOrSocial && b.messageIds.length < 3 && b.groupIds.size < 2) continue;

    const stage = stageOf(b);
    const level = levelOf(b);
    const avgSent = b.sentiments.reduce((a, c) => a + c, 0) / Math.max(1, b.sentiments.length);
    const maxRisk = b.risks.reduce((a, c) => Math.max(a, c), 0);

    // Look for existing OPEN alert with same dedupe key
    const { data: existing } = await supabaseAdmin
      .from("alerts")
      .select("id, recommended_action")
      .eq("org_id", orgId)
      .eq("dedupe_key", key)
      .is("resolved_at", null)
      .maybeSingle();

    const action = existing?.recommended_action ?? (await generateAction(b));

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
      level,
      stage,
      topic: b.topic,
      neighborhood: b.neighborhood,
      summary,
      recommended_action: action,
      evidence_message_ids: b.messageIds.slice(0, 50),
      dedupe_key: key,
      first_seen_at: b.firstSeen,
      last_seen_at: b.lastSeen,
      message_count: b.messageIds.length,
      avg_sentiment: Number(avgSent.toFixed(3)),
      max_risk: maxRisk,
    };

    if (existing) {
      await supabaseAdmin.from("alerts").update(payload).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("alerts").insert(payload);
    }
    upserted++;
  }

  return { scanned: rows.length, buckets: buckets.size, upserted };
}

export async function detectAlertsAllOrgs(): Promise<
  Array<{ org_id: string; scanned?: number; upserted?: number; error?: string }>
> {
  const { data: orgs, error } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("is_demo", false);
  if (error) throw new Error(error.message);

  const results: Array<{ org_id: string; scanned?: number; upserted?: number; error?: string }> =
    [];
  for (const o of orgs ?? []) {
    try {
      const r = await detectAlertsForOrg(o.id);
      results.push({ org_id: o.id, scanned: r.scanned, upserted: r.upserted });
    } catch (e) {
      results.push({ org_id: o.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
