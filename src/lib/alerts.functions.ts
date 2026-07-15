import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const runDetectAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Only org members can trigger a scan for that org.
    const { data: ok } = await context.supabase.rpc("has_org_access", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!ok) throw new Error("Sem acesso a esta organização.");
    const { detectAlertsForOrg } = await import("@/lib/alerts.server");
    return detectAlertsForOrg(data.orgId);
  });

export const resolveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ alertId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alerts")
      .update({ resolved_at: new Date().toISOString(), acknowledged_by: context.userId })
      .eq("id", data.alertId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acknowledgeAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ alertId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: context.userId })
      .eq("id", data.alertId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
