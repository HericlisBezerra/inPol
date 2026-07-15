import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertPlatformAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito ao administrador da plataforma.");
}

export const amIPlatformAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { isAdmin: !!data };
  });

/* ---------------- USERS ---------------- */

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authList, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const users = authList.users;
    const ids = users.map((u) => u.id);

    const [{ data: profiles }, { data: memberships }, { data: admins }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, full_name, avatar_url").in("id", ids),
      supabaseAdmin
        .from("org_members")
        .select("user_id, org_id, role, organizations(id, name)")
        .in("user_id", ids),
      supabaseAdmin.from("platform_admins").select("user_id").in("user_id", ids),
    ]);

    const adminSet = new Set((admins ?? []).map((a) => a.user_id));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const memberMap = new Map<string, Array<{ org_id: string; org_name: string; role: string }>>();
    for (const m of memberships ?? []) {
      const arr = memberMap.get(m.user_id) ?? [];
      const org = m.organizations as { id: string; name: string } | null;
      arr.push({ org_id: m.org_id, org_name: org?.name ?? "?", role: m.role });
      memberMap.set(m.user_id, arr);
    }

    return users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      email_confirmed_at: u.email_confirmed_at,
      full_name: profileMap.get(u.id)?.full_name ?? null,
      is_platform_admin: adminSet.has(u.id),
      memberships: memberMap.get(u.id) ?? [],
    }));
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8).max(72),
        fullName: z.string().min(1).max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.fullName ? { full_name: data.fullName } : undefined,
    });
    if (error) throw new Error(error.message);
    return { id: created.user?.id, email: created.user?.email };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Não pode deletar a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetOrgMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        orgId: z.string().uuid(),
        role: z.enum(["owner", "analyst", "viewer"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("org_members")
      .upsert(
        { user_id: data.userId, org_id: data.orgId, role: data.role },
        { onConflict: "org_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveOrgMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), orgId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("org_members")
      .delete()
      .eq("user_id", data.userId)
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- ORGANIZATIONS ---------------- */

export const adminListOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("id, name, city, state, slug, is_demo, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminCreateOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(2).max(120),
        city: z.string().max(80).optional(),
        state: z.string().max(4).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const { data: created, error } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: data.name,
        city: data.city ?? null,
        state: data.state ?? null,
        slug,
        author_hash_salt: crypto.randomUUID(),
        created_by: context.userId,
      })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const adminDeleteOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("organizations").delete().eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- PLATFORM SETTINGS (Evolution) ---------------- */

const PLATFORM_ID = "00000000-0000-0000-0000-000000000001";

export const adminGetPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_settings")
      .select("*")
      .eq("id", PLATFORM_ID)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const adminUpdatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        evolutionBaseUrl: z.string().url().optional(),
        evolutionApiKey: z.string().min(4).optional(),
        evolutionInstanceName: z.string().min(1).max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      updated_at: string;
      updated_by: string;
      evolution_base_url?: string;
      evolution_api_key?: string;
      evolution_instance_name?: string;
    } = { updated_at: new Date().toISOString(), updated_by: context.userId };
    if (data.evolutionBaseUrl !== undefined)
      patch.evolution_base_url = data.evolutionBaseUrl.replace(/\/$/, "");
    if (data.evolutionApiKey !== undefined) patch.evolution_api_key = data.evolutionApiKey;
    if (data.evolutionInstanceName !== undefined)
      patch.evolution_instance_name = data.evolutionInstanceName;
    const { error } = await supabaseAdmin
      .from("platform_settings")
      .update(patch)
      .eq("id", PLATFORM_ID);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListEvolutionInstances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchInstances } = await import("@/lib/evolution.server");
    const { data: s } = await supabaseAdmin
      .from("platform_settings")
      .select("evolution_base_url, evolution_api_key")
      .eq("id", PLATFORM_ID)
      .maybeSingle();
    if (!s?.evolution_base_url || !s?.evolution_api_key) {
      return { instances: [], error: "Configure Base URL e API Key primeiro." };
    }
    try {
      const instances = await fetchInstances(s.evolution_base_url, s.evolution_api_key);
      return { instances, error: null };
    } catch (e) {
      return { instances: [], error: e instanceof Error ? e.message : "Erro ao consultar Evolution" };
    }
  });

/* ---------------- ORG WHATSAPP NUMBERS ---------------- */

export const adminListOrgNumbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("org_whatsapp_numbers")
      .select("id, phone_jid, label, assigned_at, org_id, organizations(id, name)")
      .order("assigned_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminAssignOrgNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        phoneJid: z.string().min(5).max(80),
        label: z.string().max(80).optional(),
        instanceName: z.string().min(1).max(120).optional(),
        connectedPhone: z.string().max(120).optional(),
        connectionStatus: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phoneJid = data.phoneJid.trim();
    const instanceName = (data.instanceName ?? phoneJid).trim();
    const label = data.label?.trim() || instanceName;
    const connectedPhone = (data.connectedPhone ?? phoneJid).trim();

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("platform_settings")
      .select("evolution_base_url, evolution_api_key")
      .eq("id", PLATFORM_ID)
      .maybeSingle();
    if (settingsError) throw new Error(settingsError.message);
    if (!settings?.evolution_base_url || !settings.evolution_api_key) {
      throw new Error("Configure Base URL e API Key da Evolution antes de vincular.");
    }

    const { error: numberError } = await supabaseAdmin.from("org_whatsapp_numbers").upsert({
      org_id: data.orgId,
      phone_jid: phoneJid,
      label,
      assigned_by: context.userId,
      assigned_at: new Date().toISOString(),
    }, { onConflict: "phone_jid" });
    if (numberError) throw new Error(numberError.message);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("id, source_id")
      .eq("org_id", data.orgId)
      .eq("instance_name", instanceName)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { error: sourceError } = await supabaseAdmin
        .from("sources")
        .update({ label, config: { mode: "platform-evolution", phone_jid: phoneJid } })
        .eq("id", existing.source_id);
      if (sourceError) throw new Error(sourceError.message);

      const { error: instanceError } = await supabaseAdmin
        .from("whatsapp_instances")
        .update({
          evolution_base_url: settings.evolution_base_url.replace(/\/$/, ""),
          evolution_api_key: settings.evolution_api_key,
          connected_phone: connectedPhone,
          connection_status: data.connectionStatus ?? "open",
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (instanceError) throw new Error(instanceError.message);
    } else {
      const { data: source, error: sourceError } = await supabaseAdmin
        .from("sources")
        .insert({
          org_id: data.orgId,
          kind: "whatsapp",
          label,
          config: { mode: "platform-evolution", phone_jid: phoneJid },
        })
        .select("id")
        .single();
      if (sourceError) throw new Error(sourceError.message);

      const { error: instanceError } = await supabaseAdmin.from("whatsapp_instances").insert({
        org_id: data.orgId,
        source_id: source.id,
        instance_name: instanceName,
        evolution_base_url: settings.evolution_base_url.replace(/\/$/, ""),
        evolution_api_key: settings.evolution_api_key,
        connected_phone: connectedPhone,
        connection_status: data.connectionStatus ?? "open",
        last_seen_at: new Date().toISOString(),
      });
      if (instanceError) throw new Error(instanceError.message);
    }

    return { ok: true };
  });

export const adminUnassignOrgNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: number, error: numberError } = await supabaseAdmin
      .from("org_whatsapp_numbers")
      .select("org_id, phone_jid")
      .eq("id", data.id)
      .maybeSingle();
    if (numberError) throw new Error(numberError.message);

    const { error } = await supabaseAdmin.from("org_whatsapp_numbers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    if (number) {
      const { data: instances } = await supabaseAdmin
        .from("whatsapp_instances")
        .select("id, source_id")
        .eq("org_id", number.org_id)
        .eq("connected_phone", number.phone_jid);
      const instanceIds = (instances ?? []).map((i) => i.id);
      const sourceIds = (instances ?? []).map((i) => i.source_id).filter(Boolean);
      if (instanceIds.length > 0) {
        const { error: instanceError } = await supabaseAdmin
          .from("whatsapp_instances")
          .delete()
          .in("id", instanceIds);
        if (instanceError) throw new Error(instanceError.message);
      }
      if (sourceIds.length > 0) {
        const { error: sourceError } = await supabaseAdmin.from("sources").delete().in("id", sourceIds);
        if (sourceError) throw new Error(sourceError.message);
      }
    }

    return { ok: true };
  });
