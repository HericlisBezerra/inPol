import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const upsertSchema = z.object({
  orgId: z.string().uuid(),
  id: z.string().uuid().optional(),
  handle: z.string().min(1).max(60),
  label: z.string().max(120).nullable().optional(),
  kind: z.enum(["opponent", "ally", "press", "other"]),
  postsPerScan: z.number().int().min(3).max(50).default(10),
  active: z.boolean().default(true),
});

export const upsertInstagramTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof upsertSchema>) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const handle = data.handle.replace(/^@/, "").trim().toLowerCase();
    const row = {
      org_id: data.orgId,
      handle,
      label: data.label ?? null,
      kind: data.kind,
      posts_per_scan: data.postsPerScan,
      active: data.active,
      created_by: userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("org_instagram_targets")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("org_instagram_targets")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteInstagramTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; id: string }) =>
    z.object({ orgId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("org_instagram_targets")
      .delete()
      .eq("id", data.id)
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const scanInstagramTargetNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; targetId: string }) =>
    z.object({ orgId: z.string().uuid(), targetId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_org_admin", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!isAdmin) throw new Error("Somente admins podem rodar scan manual");
    const { scanInstagramForTarget } = await import("@/lib/instagram.server");
    return await scanInstagramForTarget(data.orgId, data.targetId);
  });
