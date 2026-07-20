import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient<Database> tem tipo genérico complexo; o helper só usa .rpc
async function assertOrgOwner(supabase: any, userId: string, orgId: string) {
  const { data: ok } = await supabase.rpc("has_org_role", {
    _user_id: userId,
    _org_id: orgId,
    _role: "owner",
  });
  const { data: platAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
  if (!ok && !platAdmin)
    throw new Error("Somente o dono da organização pode alterar a política LGPD.");
}

export const getLgpdPolicy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("org_lgpd_policy")
      .select("*")
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? { org_id: data.orgId, retention_days: 180, allow_export: true, dpo_email: null };
  });

export const saveLgpdPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        retentionDays: z.number().int().min(7).max(3650),
        allowExport: z.boolean(),
        dpoEmail: z.string().email().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgOwner(context.supabase, context.userId, data.orgId);
    const { error } = await context.supabase.from("org_lgpd_policy").upsert(
      {
        org_id: data.orgId,
        retention_days: data.retentionDays,
        allow_export: data.allowExport,
        dpo_email: data.dpoEmail ?? null,
        updated_by: context.userId,
      },
      { onConflict: "org_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runPurgeNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgOwner(context.supabase, context.userId, data.orgId);
    const { purgeRetentionForOrg } = await import("@/lib/lgpd.server");
    return purgeRetentionForOrg(data.orgId);
  });

export const exportSubjectData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), authorHash: z.string().min(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_org_access", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!ok) throw new Error("Sem acesso à organização.");
    const { data: rows } = await context.supabase
      .from("raw_messages")
      .select("id, content, posted_at, group_id")
      .eq("org_id", data.orgId)
      .eq("author_hash", data.authorHash)
      .order("posted_at", { ascending: false })
      .limit(1000);
    await context.supabase.from("lgpd_events").insert({
      org_id: data.orgId,
      event_type: "export_request",
      subject_kind: "author",
      subject_id: data.authorHash,
      details: { requested_by: context.userId, rows: rows?.length ?? 0 },
    });
    return { rows: rows ?? [] };
  });

export const deleteSubjectData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), authorHash: z.string().min(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgOwner(context.supabase, context.userId, data.orgId);
    const { data: deleted } = await context.supabase
      .from("raw_messages")
      .delete()
      .eq("org_id", data.orgId)
      .eq("author_hash", data.authorHash)
      .select("id");
    await context.supabase.from("lgpd_events").insert({
      org_id: data.orgId,
      event_type: "retention_purge",
      subject_kind: "author",
      subject_id: data.authorHash,
      details: { by: "subject_request", deleted: deleted?.length ?? 0 },
    });
    return { deleted: deleted?.length ?? 0 };
  });
