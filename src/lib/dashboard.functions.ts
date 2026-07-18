import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: msg24 },
      { data: alerts },
      { data: topics },
      { data: recent },
      { count: monitored },
      { count: totalGroups },
      { count: analyzed7 },
    ] = await Promise.all([
      context.supabase
        .from("raw_messages")
        .select("id", { count: "exact", head: true })
        .eq("org_id", data.orgId)
        .gte("posted_at", since),
      context.supabase
        .from("alerts")
        .select("id, level, topic, neighborhood, summary, created_at, acknowledged_at")
        .eq("org_id", data.orgId)
        .is("acknowledged_at", null)
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(10),
      context.supabase
        .from("topics")
        .select("label, message_count, avg_sentiment, max_risk, top_neighborhoods, bucket_date")
        .eq("org_id", data.orgId)
        .gte("bucket_date", new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10))
        .order("max_risk", { ascending: false })
        .limit(8),
      context.supabase
        .from("message_analyses")
        .select(
          "id, topic, neighborhood, sentiment, risk_score, summary, created_at, message:raw_messages(posted_at, group:whatsapp_groups(subject, neighborhood_tag))",
        )
        .eq("org_id", data.orgId)
        .order("risk_score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8),
      context.supabase
        .from("whatsapp_groups")
        .select("id", { count: "exact", head: true })
        .eq("org_id", data.orgId)
        .eq("is_monitored", true),
      context.supabase
        .from("whatsapp_groups")
        .select("id", { count: "exact", head: true })
        .eq("org_id", data.orgId),
      context.supabase
        .from("message_analyses")
        .select("id", { count: "exact", head: true })
        .eq("org_id", data.orgId)
        .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString()),
    ]);

    // KPIs derived
    const coverage =
      totalGroups && totalGroups > 0 ? Math.round(((monitored ?? 0) / totalGroups) * 100) : 0;
    // Rough: assume 6s per analyzed message saved from a human analyst.
    const hoursSaved = ((analyzed7 ?? 0) * 6) / 3600 / 7;

    return {
      msg24h: msg24 ?? 0,
      alerts: alerts ?? [],
      topics: topics ?? [],
      recentCritical: recent ?? [],
      kpi: {
        coverage,
        monitored: monitored ?? 0,
        totalGroups: totalGroups ?? 0,
        analyzed7d: analyzed7 ?? 0,
        hoursSavedPerDay: Number(hoursSaved.toFixed(1)),
      },
    };
  });

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        includeAcked: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("alerts")
      .select(
        "id, level, topic, neighborhood, summary, recommended_action, evidence_message_ids, acknowledged_at, acknowledged_by, created_at",
      )
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data.includeAcked) q = q.is("acknowledged_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const acknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), alertId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: context.userId })
      .eq("id", data.alertId)
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_org_access", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!ok) throw new Error("Sem acesso.");
    const { detectAlertsForOrg } = await import("@/lib/alerts.server");
    const r = await detectAlertsForOrg(data.orgId);
    return { ok: true, alerts_upserted: r.upserted, buckets: r.buckets };
  });
