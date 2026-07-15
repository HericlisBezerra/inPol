import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Aggregates message_analyses by neighborhood for the last N days.
 * Returns per-neighborhood counts, avg sentiment, and a heuristic
 * "approval" score derived from sentiment.
 */
export const getTerritoryStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), days: z.number().int().min(1).max(180).default(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_org_access", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!ok) throw new Error("Sem acesso.");
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("message_analyses")
      .select("neighborhood, sentiment")
      .eq("org_id", data.orgId)
      .gte("created_at", since)
      .not("neighborhood", "is", null)
      .limit(20000);
    if (error) throw new Error(error.message);
    const agg = new Map<string, { msgs: number; sent: number }>();
    for (const r of rows ?? []) {
      const key = (r.neighborhood ?? "").trim();
      if (!key) continue;
      const a = agg.get(key) ?? { msgs: 0, sent: 0 };
      a.msgs += 1;
      a.sent += Number(r.sentiment ?? 0);
      agg.set(key, a);
    }
    const items = [...agg.entries()].map(([name, a]) => {
      const avg = a.msgs > 0 ? a.sent / a.msgs : 0;
      const approval = Math.round(50 + avg * 40); // -1..1 → 10..90
      return { name, msgs: a.msgs, sentiment: Number(avg.toFixed(3)), approval };
    });
    items.sort((a, b) => b.approval - a.approval);
    return { items };
  });
