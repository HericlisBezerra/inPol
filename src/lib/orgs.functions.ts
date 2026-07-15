import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("org_members")
      .select("role, org:organizations(id, name, city, state, slug, is_demo, created_at)")
      .eq("user_id", context.userId)
      .order("created_at", { referencedTable: "organizations", ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      role: row.role,
      org: row.org as { id: string; name: string; city: string | null; state: string | null; slug: string | null; is_demo: boolean; created_at: string },
    }));
  });

export const enterDemoMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("enter_demo_mode");
    if (error) throw new Error(error.message);
    return { orgId: data as unknown as string };
  });

export const getOrg = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: org, error } = await context.supabase
      .from("organizations")
      .select("id, name, city, state, slug, created_at")
      .eq("id", data.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!org) throw new Error("Organização não encontrada");
    const { data: member } = await context.supabase
      .from("org_members")
      .select("role")
      .eq("org_id", data.orgId)
      .eq("user_id", context.userId)
      .maybeSingle();
    return { ...org, role: member?.role ?? null };
  });

export const createOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(2).max(120),
        city: z.string().min(2).max(80),
        state: z.string().min(2).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50);
    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: data.name,
        city: data.city,
        state: data.state,
        slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
        created_by: context.userId,
      })
      .select("id, name, city, state, slug")
      .single();
    if (error) throw new Error(error.message);
    const { error: memberError } = await supabaseAdmin.from("org_members").insert({
      org_id: org.id,
      user_id: context.userId,
      role: "owner",
    });
    if (memberError) throw new Error(memberError.message);

    // Seed default vocabulary for Brazilian municipal gabinete
    const seeds = [
      ...["saude", "educacao", "transporte", "obras", "seguranca", "limpeza", "habitacao", "cultura", "esporte"].map(
        (v) => ({ org_id: org.id, kind: "department" as const, value: v }),
      ),
      { org_id: org.id, kind: "news_domain" as const, value: "tribunadejundiai.com.br" },
      { org_id: org.id, kind: "news_domain" as const, value: "bomdiajundiai.com.br" },
      { org_id: org.id, kind: "news_domain" as const, value: "g1.globo.com/sp/sorocaba-jundiai" },
    ];
    await supabaseAdmin.from("org_vocabulary").insert(seeds);

    await supabaseAdmin.from("audit_log").insert({
      org_id: org.id,
      actor_id: context.userId,
      action: "org.created",
      target_kind: "organization",
      target_id: org.id,
    });

    return org;
  });
