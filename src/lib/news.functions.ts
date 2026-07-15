import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const sourceSchema = z.enum(["all", "news", "instagram", "whatsapp", "facebook", "x"]);

export const getNewsFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: vocab, error } = await context.supabase
      .from("org_vocabulary")
      .select("kind, value")
      .eq("org_id", data.orgId)
      .in("kind", ["neighborhood", "opponent", "ally", "facility", "sensitive_term", "focus_term"])
      .order("kind")
      .order("value");
    if (error) throw new Error(error.message);
    return vocab ?? [];
  });

export const listNewsFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        source: sourceSchema.default("all"),
        neighborhood: z.string().optional().nullable(),
        vocabTerm: z.string().optional().nullable(),
        sentiment: z.enum(["all", "negative", "neutral", "positive"]).default("all"),
        q: z.string().max(120).optional().nullable(),
        days: z.number().min(1).max(90).default(14),
        limit: z.number().min(20).max(200).default(80),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    let query = context.supabase
      .from("raw_messages")
      .select(
        "id, content, posted_at, raw_payload, analysis_status, source:sources!inner(kind, label), group:whatsapp_groups(subject, neighborhood_tag), analysis:message_analyses(topic, subtopic, neighborhood, sentiment, risk_score, summary, mentioned_opponents, mentioned_entities, mentioned_allies, is_actionable)",
      )
      .eq("org_id", data.orgId)
      .gte("posted_at", since)
      .order("posted_at", { ascending: false })
      .limit(data.limit);

    if (data.source !== "all") {
      query = query.eq("source.kind", data.source);
    } else {
      query = query.in("source.kind", ["news", "instagram", "whatsapp", "facebook", "x"]);
    }
    if (data.q?.trim()) query = query.ilike("content", `%${data.q.trim()}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const filtered = (rows ?? []).filter((row) => {
      const analysis = Array.isArray(row.analysis) ? row.analysis[0] : row.analysis;
      const group = Array.isArray(row.group) ? row.group[0] : row.group;
      const content = String(row.content ?? "").toLowerCase();

      if (data.neighborhood) {
        const neighborhood = analysis?.neighborhood ?? group?.neighborhood_tag;
        if (neighborhood !== data.neighborhood) return false;
      }

      if (data.vocabTerm) {
        const term = data.vocabTerm.toLowerCase();
        const buckets = [
          ...(analysis?.mentioned_opponents ?? []),
          ...(analysis?.mentioned_allies ?? []),
          ...(analysis?.mentioned_entities ?? []),
          analysis?.topic,
          analysis?.subtopic,
          analysis?.neighborhood,
        ]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
        if (!buckets.some((v) => v.includes(term)) && !content.includes(term)) return false;
      }

      if (data.sentiment !== "all") {
        const value = Number(analysis?.sentiment ?? 0);
        if (data.sentiment === "negative" && value > -0.15) return false;
        if (data.sentiment === "neutral" && (value < -0.15 || value > 0.15)) return false;
        if (data.sentiment === "positive" && value < 0.15) return false;
      }

      return true;
    });

    return filtered;
  });