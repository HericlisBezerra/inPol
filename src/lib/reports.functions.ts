import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("reports")
      .select("id, kind, period_start, period_end, title, generated_at")
      .eq("org_id", data.orgId)
      .order("generated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), reportId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: report, error } = await context.supabase
      .from("reports")
      .select("*")
      .eq("org_id", data.orgId)
      .eq("id", data.reportId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return report;
  });

export const generateReportNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), kind: z.enum(["daily", "weekly", "monthly"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { generateReport } = await import("@/lib/reports.server");
    const id = await generateReport(data.orgId, data.kind);
    return { id };
  });
