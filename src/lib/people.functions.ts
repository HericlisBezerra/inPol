import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient<Database> tem tipo genérico complexo; o helper só usa .rpc
async function assertOrgAdmin(supabase: any, userId: string, orgId: string) {
  const { data: ok } = await supabase.rpc("is_org_admin", { _user_id: userId, _org_id: orgId });
  const { data: platAdmin } = await supabase.rpc("is_platform_admin", { _user_id: userId });
  if (!ok && !platAdmin) throw new Error("Somente owner/analyst pode editar.");
}

/* --------- tracked_members --------- */

export const upsertMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        orgId: z.string().uuid(),
        displayName: z.string().min(1).max(120),
        role: z.string().min(1).max(40),
        neighborhood: z.string().max(80).nullable().optional(),
        tags: z.array(z.string()).max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const payload = {
      org_id: data.orgId,
      display_name: data.displayName,
      role: data.role,
      neighborhood: data.neighborhood ?? null,
      tags: data.tags ?? [],
    };
    const q = data.id
      ? context.supabase.from("tracked_members").update(payload).eq("id", data.id)
      : context.supabase.from("tracked_members").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const { error } = await context.supabase.from("tracked_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------- org_adversaries --------- */

export const upsertAdversary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        orgId: z.string().uuid(),
        displayName: z.string().min(1).max(120),
        handle: z.string().max(60).nullable().optional(),
        role: z.string().max(40).nullable().optional(),
        party: z.string().max(40).nullable().optional(),
        topTopics: z.array(z.string()).max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const payload = {
      org_id: data.orgId,
      display_name: data.displayName,
      handle: data.handle ?? null,
      role: data.role ?? null,
      party: data.party ?? null,
      top_topics: data.topTopics ?? [],
    };
    const q = data.id
      ? context.supabase.from("org_adversaries").update(payload).eq("id", data.id)
      : context.supabase.from("org_adversaries").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdversary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const { error } = await context.supabase.from("org_adversaries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------- author_hash link (para stats) --------- */

export const linkAuthorHash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        memberId: z.string().uuid(),
        authorHash: z.string().min(4).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId, data.orgId);
    const { error } = await context.supabase.from("member_author_links").upsert(
      {
        org_id: data.orgId,
        member_id: data.memberId,
        author_hash: data.authorHash,
        confirmed_by: context.userId,
      },
      { onConflict: "org_id,author_hash" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
