import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listInstances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("whatsapp_instances")
      .select(
        "id, instance_name, evolution_base_url, connected_phone, webhook_token, connection_status, last_seen_at, created_at",
      )
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        instanceName: z.string().min(1).max(80),
        evolutionBaseUrl: z.string().url(),
        evolutionApiKey: z.string().min(8),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify the caller is an admin of the org
    const { data: roleCheck } = await supabaseAdmin
      .from("org_members")
      .select("role")
      .eq("org_id", data.orgId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!roleCheck || !["owner", "analyst"].includes(roleCheck.role)) {
      throw new Error("Apenas owner ou analyst pode criar instâncias.");
    }

    const { data: source, error: srcErr } = await supabaseAdmin
      .from("sources")
      .insert({
        org_id: data.orgId,
        kind: "whatsapp",
        label: data.instanceName,
        config: {},
      })
      .select("id")
      .single();
    if (srcErr) throw new Error(srcErr.message);

    const { data: inst, error } = await supabaseAdmin
      .from("whatsapp_instances")
      .insert({
        org_id: data.orgId,
        source_id: source.id,
        instance_name: data.instanceName,
        evolution_base_url: data.evolutionBaseUrl.replace(/\/$/, ""),
        evolution_api_key: data.evolutionApiKey,
      })
      .select("id, instance_name, webhook_token")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      org_id: data.orgId,
      actor_id: context.userId,
      action: "whatsapp.instance.created",
      target_kind: "whatsapp_instance",
      target_id: inst.id,
    });

    return inst;
  });

export const deleteInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), instanceId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify caller is owner/analyst of the org OR platform admin
    const [{ data: role }, { data: pa }] = await Promise.all([
      supabaseAdmin
        .from("org_members")
        .select("role")
        .eq("org_id", data.orgId)
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    const isOrgAdmin = role && ["owner", "analyst"].includes(role.role);
    if (!isOrgAdmin && !pa) throw new Error("Sem permissão para deletar instâncias.");

    const { data: inst, error: instErr } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("id, source_id, org_id")
      .eq("id", data.instanceId)
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (instErr || !inst) throw new Error("Instância não encontrada");

    // Delete groups tied to this instance first (FK)
    await supabaseAdmin.from("whatsapp_groups").delete().eq("instance_id", inst.id);
    const { error: delErr } = await supabaseAdmin
      .from("whatsapp_instances")
      .delete()
      .eq("id", inst.id);
    if (delErr) throw new Error(delErr.message);

    if (inst.source_id) {
      await supabaseAdmin.from("sources").delete().eq("id", inst.source_id);
    }

    await supabaseAdmin.from("audit_log").insert({
      org_id: data.orgId,
      actor_id: context.userId,
      action: "whatsapp.instance.deleted",
      target_kind: "whatsapp_instance",
      target_id: inst.id,
    });

    return { ok: true };
  });

export const refreshGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), instanceId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchGroups } = await import("@/lib/evolution.server");

    const { data: ok } = await context.supabase.rpc("is_org_admin", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!ok) throw new Error("Sem permissão");

    const { data: inst, error } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("id, org_id, instance_name, evolution_base_url, evolution_api_key")
      .eq("id", data.instanceId)
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (error || !inst) throw new Error("Instância não encontrada");

    const groups = await fetchGroups(
      inst.evolution_base_url,
      inst.evolution_api_key,
      inst.instance_name,
    );

    if (groups.length === 0) return { synced: 0 };

    const rows = groups.map((g) => ({
      org_id: inst.org_id,
      instance_id: inst.id,
      remote_jid: g.id,
      subject: g.subject,
      participant_count: g.size ?? null,
      picture_url: g.pictureUrl ?? null,
    }));

    const { error: upErr } = await supabaseAdmin
      .from("whatsapp_groups")
      .upsert(rows, { onConflict: "instance_id,remote_jid", ignoreDuplicates: false });
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin
      .from("whatsapp_instances")
      .update({ last_seen_at: new Date().toISOString(), connection_status: "ok" })
      .eq("id", inst.id);

    await supabaseAdmin.from("audit_log").insert({
      org_id: data.orgId,
      actor_id: context.userId,
      action: "whatsapp.groups.synced",
      target_kind: "whatsapp_instance",
      target_id: inst.id,
      metadata: { count: groups.length },
    });

    return { synced: groups.length };
  });

export const listGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), instanceId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("whatsapp_groups")
      .select(
        "id, instance_id, remote_jid, subject, participant_count, picture_url, is_monitored, neighborhood_tag, monitored_at, tags",
      )
      .eq("org_id", data.orgId)
      .order("subject", { ascending: true });
    if (data.instanceId) q = q.eq("instance_id", data.instanceId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setGroupTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        groupId: z.string().uuid(),
        tags: z.array(z.string().min(1).max(40)).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await context.supabase.rpc("has_org_access", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!ok) throw new Error("Sem acesso");
    const tags = Array.from(new Set(data.tags.map((t) => t.trim()).filter(Boolean)));
    const { error } = await supabaseAdmin
      .from("whatsapp_groups")
      .update({ tags })
      .eq("id", data.groupId)
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true, tags };
  });

export const getInstanceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), instanceId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchInstanceStatus } = await import("@/lib/evolution.server");
    // Verify org access
    const { data: ok } = await context.supabase.rpc("has_org_access", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!ok) throw new Error("Sem acesso");

    const { data: inst, error } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("id, instance_name, evolution_base_url, evolution_api_key")
      .eq("id", data.instanceId)
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (error || !inst) throw new Error("Instância não encontrada");

    try {
      const raw = (await fetchInstanceStatus(
        inst.evolution_base_url,
        inst.evolution_api_key,
        inst.instance_name,
      )) as { instance?: { state?: string }; state?: string };
      const state = raw?.instance?.state ?? raw?.state ?? "unknown";
      await supabaseAdmin
        .from("whatsapp_instances")
        .update({ connection_status: state, last_seen_at: new Date().toISOString() })
        .eq("id", inst.id);
      return { state };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro";
      await supabaseAdmin
        .from("whatsapp_instances")
        .update({ connection_status: "error" })
        .eq("id", inst.id);
      return { state: "error", error: msg };
    }
  });

export const toggleGroupMonitoring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        groupId: z.string().uuid(),
        monitored: z.boolean(),
        neighborhoodTag: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await context.supabase.rpc("is_org_admin", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!ok) throw new Error("Sem permissão");
    const { error } = await supabaseAdmin
      .from("whatsapp_groups")
      .update({
        is_monitored: data.monitored,
        monitored_at: data.monitored ? new Date().toISOString() : null,
        monitored_by: data.monitored ? context.userId : null,
        neighborhood_tag: data.neighborhoodTag ?? null,
      })
      .eq("id", data.groupId)
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("lgpd_events").insert({
      org_id: data.orgId,
      event_type: data.monitored ? "group.monitoring.enabled" : "group.monitoring.disabled",
      subject_kind: "whatsapp_group",
      subject_id: data.groupId,
      details: { actor: context.userId, neighborhood: data.neighborhoodTag ?? null },
    });

    return { ok: true };
  });

export const backfillInstanceMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        instanceId: z.string().uuid(),
        days: z.number().min(1).max(60).default(14),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_org_admin", {
      _user_id: context.userId,
      _org_id: data.orgId,
    });
    if (!ok) throw new Error("Sem permissão");
    const { backfillInstance } = await import("@/lib/backfill.server");
    return backfillInstance(data.instanceId, { days: data.days });
  });
