// Ingestion pipeline (server-only). Called from the Evolution webhook
// and from a debounced re-analysis job. Hashes authors with the org salt,
// inserts raw messages, runs AI analysis, updates topics, raises alerts.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash } from "crypto";
import { analyzeBatch, type VocabularyContext } from "./analysis.server";

export interface EvolutionMessagePayload {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean; participant?: string };
  message?: Record<string, unknown> & {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string; mimetype?: string };
    videoMessage?: { caption?: string; mimetype?: string };
    audioMessage?: { mimetype?: string };
  };
  messageTimestamp?: number | string;
  pushName?: string;
}

function extractContent(payload: EvolutionMessagePayload): { content: string | null; mediaKind: string | null; mime: string | null } {
  const m = payload.message;
  if (!m) return { content: null, mediaKind: null, mime: null };
  if (typeof m.conversation === "string" && m.conversation.trim()) return { content: m.conversation, mediaKind: "text", mime: null };
  if (m.extendedTextMessage?.text) return { content: m.extendedTextMessage.text, mediaKind: "text", mime: null };
  if (m.imageMessage) return { content: m.imageMessage.caption ?? null, mediaKind: "image", mime: m.imageMessage.mimetype ?? null };
  if (m.videoMessage) return { content: m.videoMessage.caption ?? null, mediaKind: "video", mime: m.videoMessage.mimetype ?? null };
  if (m.audioMessage) return { content: null, mediaKind: "audio", mime: m.audioMessage.mimetype ?? null };
  return { content: null, mediaKind: "other", mime: null };
}

function hashAuthor(salt: string, participant: string | undefined): string | null {
  if (!participant) return null;
  return createHash("sha256").update(`${salt}:${participant}`).digest("hex").slice(0, 32);
}

export interface IngestContext {
  orgId: string;
  sourceId: string;
  authorSalt: string;
}

type VocabularyRow = {
  kind: string;
  value: string;
  aliases?: string[] | null;
};

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(value: string): string {
  return stripDiacritics(value).toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termAppears(content: string, term: string): boolean {
  const t = normalizeText(term.trim());
  if (t.length < 3) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(t)}([^a-z0-9]|$)`, "i").test(content);
}

function uniq(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const clean = value?.trim();
    if (!clean) continue;
    const key = normalizeText(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function slugTopic(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "outros";
}

function matchVocabulary(content: string, rows: VocabularyRow[]) {
  const normalized = normalizeText(content);
  const matches: Record<string, string[]> = {
    neighborhood: [],
    opponent: [],
    ally: [],
    department: [],
    facility: [],
    sensitive_term: [],
    focus_term: [],
  };

  for (const row of rows) {
    const terms = [row.value, ...(row.aliases ?? [])];
    if (terms.some((term) => termAppears(normalized, term))) {
      const bucket = matches[row.kind] ?? [];
      bucket.push(row.value);
      matches[row.kind] = uniq(bucket);
    }
  }

  return matches;
}

export async function ingestEvolutionMessages(
  ctx: IngestContext,
  groupMap: Map<string, string>, // remoteJid -> whatsapp_groups.id (only monitored)
  payloads: EvolutionMessagePayload[],
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  const insertedIds: string[] = [];

  for (const p of payloads) {
    const jid = p.key?.remoteJid;
    if (!jid || !jid.endsWith("@g.us")) {
      skipped++;
      continue;
    }
    const groupId = groupMap.get(jid);
    if (!groupId) {
      skipped++;
      continue;
    }
    const { content, mediaKind, mime } = extractContent(p);
    if (!content) {
      // For MVP we only analyze text messages
      skipped++;
      continue;
    }
    const externalId = p.key?.id ?? `${jid}:${p.messageTimestamp}`;
    const postedAt = p.messageTimestamp
      ? new Date(Number(p.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString();
    const authorHash = hashAuthor(ctx.authorSalt, p.key?.participant ?? p.pushName);

    const { data, error } = await supabaseAdmin
      .from("raw_messages")
      .insert({
        org_id: ctx.orgId,
        source_id: ctx.sourceId,
        group_id: groupId,
        external_id: externalId,
        author_hash: authorHash,
        content,
        media_kind: mediaKind,
        media_mime: mime,
        posted_at: postedAt,
        raw_payload: null, // we drop the raw payload to minimize PII storage
      })
      .select("id")
      .single();

    if (error) {
      // Likely unique violation (already ingested) — count as skipped
      skipped++;
      continue;
    }
    inserted++;
    insertedIds.push(data.id);
    // LGPD trail: collection + anonymization
    void supabaseAdmin.from("lgpd_events").insert([
      {
        org_id: ctx.orgId,
        event_type: "collection",
        subject_kind: "message",
        subject_id: data.id,
        details: { source: "whatsapp", group_id: groupId },
      },
      ...(authorHash
        ? [{
            org_id: ctx.orgId,
            event_type: "anonymization" as const,
            subject_kind: "author",
            subject_id: authorHash,
            details: { method: "sha256-org-salt" },
          }]
        : []),
    ]);
  }

  if (insertedIds.length > 0) {
    // Fire-and-forget analysis (don't block webhook response)
    void runAnalysisForMessages(ctx.orgId, insertedIds).catch((e) => {
      console.error("Analysis error", e);
    });
  }

  return { inserted, skipped };
}

async function loadVocabulary(orgId: string): Promise<VocabularyContext> {
  const { data } = await supabaseAdmin
    .from("org_vocabulary")
    .select("kind, value")
    .eq("org_id", orgId);
  const ctx: VocabularyContext = {
    neighborhoods: [],
    opponents: [],
    allies: [],
    departments: [],
    facilities: [],
    sensitive_terms: [],
    focus_terms: [],
  };
  for (const row of data ?? []) {
    switch (row.kind) {
      case "neighborhood":
        ctx.neighborhoods.push(row.value);
        break;
      case "opponent":
        ctx.opponents.push(row.value);
        break;
      case "ally":
        ctx.allies.push(row.value);
        break;
      case "department":
        ctx.departments.push(row.value);
        break;
      case "facility":
        ctx.facilities.push(row.value);
        break;
      case "sensitive_term":
        ctx.sensitive_terms.push(row.value);
        break;
      case "focus_term":
        ctx.focus_terms.push(row.value);
        break;
    }
  }
  return ctx;
}

async function loadVocabularyRows(orgId: string): Promise<VocabularyRow[]> {
  const { data } = await supabaseAdmin
    .from("org_vocabulary")
    .select("kind, value, aliases")
    .eq("org_id", orgId);
  return (data ?? []) as VocabularyRow[];
}

export async function runAnalysisForMessages(orgId: string, messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;

  const { data: msgs } = await supabaseAdmin
    .from("raw_messages")
    .select("id, content, group:whatsapp_groups(subject, neighborhood_tag), source:sources(kind, label)")
    .in("id", messageIds);
  if (!msgs || msgs.length === 0) return;

  const [vocab, vocabRows] = await Promise.all([
    loadVocabulary(orgId),
    loadVocabularyRows(orgId),
  ]);

  const inputs = msgs
    .filter((m) => m.content)
    .map((m) => {
      const g = Array.isArray(m.group) ? m.group[0] : m.group;
      return {
        id: m.id,
        content: m.content as string,
        group_label: g?.subject ?? null,
      };
    });
  const msgById = new Map(
    msgs.map((m) => {
      const g = Array.isArray(m.group) ? m.group[0] : m.group;
      const s = Array.isArray(m.source) ? m.source[0] : m.source;
      return [
        m.id,
        {
          content: (m.content ?? "") as string,
          groupNeighborhood: g?.neighborhood_tag ?? null,
          sourceKind: s?.kind ?? null,
        },
      ];
    }),
  );

  // Chunk to avoid overflowing the model's context
  const CHUNK = 12;
  for (let i = 0; i < inputs.length; i += CHUNK) {
    const slice = inputs.slice(i, i + CHUNK);
    try {
      const { results, model } = await analyzeBatch(vocab, slice);
      const rows = results
        .filter((r) => r && r.id)
        .map((r) => {
          const msg = msgById.get(r.id);
          const matches = matchVocabulary(msg?.content ?? "", vocabRows);
          const matchedEntities = uniq([
            ...matches.department,
            ...matches.facility,
            ...matches.sensitive_term,
            ...matches.focus_term,
          ]);
          const fallbackTopic = matches.focus_term[0] ?? matches.sensitive_term[0] ?? matches.facility[0];
          const hasPriorityTerm = matches.focus_term.length > 0 || matches.sensitive_term.length > 0;
          const isExternal = msg?.sourceKind === "news" || msg?.sourceKind === "instagram" || msg?.sourceKind === "facebook" || msg?.sourceKind === "x";

          return {
            org_id: orgId,
            message_id: r.id,
            sentiment: Math.max(-1, Math.min(1, Number(r.sentiment ?? 0))),
            intensity: Math.max(0, Math.min(1, Number(r.intensity ?? 0))),
            topic: r.topic && r.topic !== "outros" ? r.topic : fallbackTopic ? slugTopic(fallbackTopic) : "outros",
            subtopic: r.subtopic ?? fallbackTopic ?? null,
            neighborhood: r.neighborhood ?? matches.neighborhood[0] ?? msg?.groupNeighborhood ?? null,
            mentioned_opponents: uniq([...(r.mentioned_opponents ?? []), ...matches.opponent]),
            mentioned_allies: uniq([...(r.mentioned_allies ?? []), ...matches.ally]),
            mentioned_entities: uniq([...(r.mentioned_entities ?? []), ...matchedEntities]),
            is_actionable: !!r.is_actionable || hasPriorityTerm || isExternal,
            risk_score: Math.max(
              0,
              Math.min(
                100,
                Math.round(Number(r.risk_score ?? 0)) + (hasPriorityTerm ? 8 : 0) + (isExternal ? 5 : 0),
              ),
            ),
            summary: r.summary ?? null,
            model_version: model,
          };
        });
      if (rows.length > 0) {
        await supabaseAdmin
          .from("message_analyses")
          .upsert(rows, { onConflict: "message_id", ignoreDuplicates: false });
        await supabaseAdmin
          .from("raw_messages")
          .update({ analysis_status: "done" })
          .in(
            "id",
            rows.map((r) => r.message_id),
          );
        await rollupTopicsAndAlerts(orgId, rows);
      }
    } catch (e) {
      console.error("analyzeBatch failed", e);
      await supabaseAdmin
        .from("raw_messages")
        .update({ analysis_status: "error" })
        .in(
          "id",
          slice.map((s) => s.id),
        );
    }
  }
}

export async function runAnalysisForPendingMessages(
  orgId: string,
  limit = 60,
): Promise<{ analyzed: number; selected: number }> {
  const { data: pending, error } = await supabaseAdmin
    .from("raw_messages")
    .select("id")
    .eq("org_id", orgId)
    .eq("analysis_status", "pending")
    .not("content", "is", null)
    .order("posted_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  const ids = (pending ?? []).map((m) => m.id);
  if (ids.length === 0) return { analyzed: 0, selected: 0 };

  await runAnalysisForMessages(orgId, ids);

  const { count } = await supabaseAdmin
    .from("message_analyses")
    .select("id", { count: "exact", head: true })
    .in("message_id", ids);

  return { analyzed: count ?? 0, selected: ids.length };
}

export async function runAnalysisForPendingAllOrgs(
  limitPerOrg = 60,
): Promise<Array<{ org_id: string; analyzed?: number; selected?: number; error?: string }>> {
  const { data: orgs, error } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("is_demo", false);
  if (error) throw new Error(error.message);

  const results: Array<{ org_id: string; analyzed?: number; selected?: number; error?: string }> = [];
  for (const org of orgs ?? []) {
    try {
      const result = await runAnalysisForPendingMessages(org.id, limitPerOrg);
      results.push({ org_id: org.id, ...result });
    } catch (e) {
      results.push({ org_id: org.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

async function rollupTopicsAndAlerts(
  orgId: string,
  rows: Array<{ message_id: string; topic: string; neighborhood: string | null; risk_score: number; sentiment: number; summary: string | null }>,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // Group by topic
  const byTopic = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byTopic.get(r.topic) ?? [];
    list.push(r);
    byTopic.set(r.topic, list);
  }

  for (const [topic, items] of byTopic) {
    const { data: existing } = await supabaseAdmin
      .from("topics")
      .select("id, message_count, avg_sentiment, max_risk, sample_message_ids, top_neighborhoods")
      .eq("org_id", orgId)
      .eq("bucket_date", today)
      .eq("label", topic)
      .maybeSingle();

    const prevCount = existing?.message_count ?? 0;
    const prevAvg = Number(existing?.avg_sentiment ?? 0);
    const newCount = prevCount + items.length;
    const newAvg = (prevAvg * prevCount + items.reduce((s, i) => s + Number(i.sentiment ?? 0), 0)) / newCount;
    const maxRisk = Math.max(existing?.max_risk ?? 0, ...items.map((i) => i.risk_score));
    const samples = [...(existing?.sample_message_ids ?? []), ...items.map((i) => i.message_id)].slice(-10);

    // Top neighborhoods rough accumulation
    const neighMap = new Map<string, number>();
    for (const entry of (existing?.top_neighborhoods as Array<{ label: string; count: number }> | null) ?? []) {
      neighMap.set(entry.label, entry.count);
    }
    for (const i of items) {
      if (i.neighborhood) neighMap.set(i.neighborhood, (neighMap.get(i.neighborhood) ?? 0) + 1);
    }
    const topNeigh = [...neighMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

    await supabaseAdmin.from("topics").upsert(
      {
        org_id: orgId,
        bucket_date: today,
        label: topic,
        message_count: newCount,
        avg_sentiment: +newAvg.toFixed(3),
        max_risk: maxRisk,
        top_neighborhoods: topNeigh,
        sample_message_ids: samples,
      },
      { onConflict: "org_id,bucket_date,label" },
    );

    // Alert raising: any single message risk_score >= 70 or burst (>= 6 msgs same topic today)
    const triggers = items.filter((i) => i.risk_score >= 70);
    if (triggers.length > 0 || newCount >= 6) {
      const level = triggers.some((t) => t.risk_score >= 85)
        ? "vermelho"
        : triggers.length > 0 || newCount >= 10
          ? "laranja"
          : "amarelo";

      const trigger = triggers[0] ?? items[items.length - 1];
      // Avoid duplicate alerts for the same topic today still open
      const { data: existingOpen } = await supabaseAdmin
        .from("alerts")
        .select("id")
        .eq("org_id", orgId)
        .eq("topic", topic)
        .gte("created_at", `${today}T00:00:00Z`)
        .is("acknowledged_at", null)
        .maybeSingle();
      if (!existingOpen) {
        await supabaseAdmin.from("alerts").insert({
          org_id: orgId,
          level,
          topic,
          neighborhood: trigger.neighborhood,
          summary: trigger.summary ?? `Movimento em "${topic}" detectado.`,
          recommended_action: "Revisar amostras e avaliar resposta nas próximas 24h.",
          evidence_message_ids: items.slice(0, 5).map((i) => i.message_id),
        });
      }
    }
  }
}
