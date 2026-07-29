import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { countExact, fetchAllPages } from "@/lib/pg-paginate";
import { z } from "zod";

type SubjectMessage = {
  id: string;
  content: string | null;
  posted_at: string;
  group_id: string | null;
};

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
    // Direito de acesso/portabilidade (LGPD art. 18, II e V): a exportação tem que ser COMPLETA.
    // O `.limit(1000)` que estava aqui era exatamente o teto do PostgREST — o titular com mais de
    // mil mensagens recebia um extrato truncado, e o lgpd_events registrava esse número menor
    // como se fosse o total. Paginado, sem teto artificial.
    const rows = await fetchAllPages<SubjectMessage>((from, to) =>
      context.supabase
        .from("raw_messages")
        .select("id, content, posted_at, group_id")
        .eq("org_id", data.orgId)
        .eq("author_hash", data.authorHash)
        .order("posted_at", { ascending: false })
        .order("id", { ascending: true }) // desempate: posted_at repete, e sem ordem única a página repete/pula
        .range(from, to),
    );
    await context.supabase.from("lgpd_events").insert({
      org_id: data.orgId,
      event_type: "export_request",
      subject_kind: "author",
      subject_id: data.authorHash,
      details: { requested_by: context.userId, rows: rows.length },
    });
    return { rows };
  });

export const deleteSubjectData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), authorHash: z.string().min(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOrgOwner(context.supabase, context.userId, data.orgId);
    // O DELETE apaga tudo que casa com o filtro, mas o `.select("id")` devolvia no máximo 1.000
    // linhas (teto do PostgREST) — então o número gravado no lgpd_events subnotificava a exclusão
    // de um titular com mais mensagens que isso. Conta antes, apaga sem representação.
    const expected = await countExact(
      context.supabase
        .from("raw_messages")
        .select("*", { count: "exact", head: true })
        .eq("org_id", data.orgId)
        .eq("author_hash", data.authorHash),
    );
    const { error } = await context.supabase
      .from("raw_messages")
      .delete()
      .eq("org_id", data.orgId)
      .eq("author_hash", data.authorHash);
    // Sem esta checagem, um erro de RLS/rede viraria "N mensagens excluídas" na tela e na trilha
    // LGPD sem nada ter sido apagado.
    if (error) {
      console.error("[lgpd] falha ao excluir dados do titular:", error);
      throw new Error("Não foi possível excluir os dados do titular.");
    }
    await context.supabase.from("lgpd_events").insert({
      org_id: data.orgId,
      event_type: "retention_purge",
      subject_kind: "author",
      subject_id: data.authorHash,
      details: { by: "subject_request", deleted: expected },
    });
    return { deleted: expected };
  });
