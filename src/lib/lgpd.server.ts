// LGPD retention/purge helpers (server-only).
// Deletes raw_messages older than each org's retention_days and logs
// a retention_purge event.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { countExact, fetchAllPages } from "@/lib/pg-paginate";

const DEFAULT_RETENTION_DAYS = 180;

export async function purgeRetentionForOrg(orgId: string): Promise<{ deleted: number }> {
  const { data: policy } = await supabaseAdmin
    .from("org_lgpd_policy")
    .select("retention_days")
    .eq("org_id", orgId)
    .maybeSingle();
  const days = policy?.retention_days ?? DEFAULT_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // O `.select("id")` no DELETE devolvia no máximo 1.000 linhas (teto do PostgREST): o expurgo
  // apagava tudo, mas registrava "1000" no lgpd_events mesmo tendo apagado dezenas de milhares.
  // A trilha de retenção é justamente o que se mostra à ANPD — o número precisa ser o real.
  const count = await countExact(
    supabaseAdmin
      .from("raw_messages")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .lt("posted_at", cutoff),
  );
  const { error } = await supabaseAdmin
    .from("raw_messages")
    .delete()
    .eq("org_id", orgId)
    .lt("posted_at", cutoff);
  // Erro silencioso aqui viraria um lgpd_events afirmando um expurgo que não aconteceu.
  if (error) throw new Error(error.message);

  if (count > 0) {
    await supabaseAdmin.from("lgpd_events").insert({
      org_id: orgId,
      event_type: "retention_purge",
      subject_kind: "system",
      subject_id: "retention-job",
      details: { deleted: count, cutoff, retention_days: days },
    });
  }
  return { deleted: count };
}

export async function purgeRetentionAllOrgs(): Promise<
  Array<{ org_id: string; deleted?: number; error?: string }>
> {
  // Paginado: uma org que caísse fora da primeira página nunca teria seus dados expurgados —
  // retenção estourada em silêncio, que é o pior tipo de falha de conformidade.
  const orgs = await fetchAllPages<{ id: string }>((from, to) =>
    supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("is_demo", false)
      .order("id", { ascending: true })
      .range(from, to),
  );
  const out: Array<{ org_id: string; deleted?: number; error?: string }> = [];
  for (const o of orgs) {
    try {
      const r = await purgeRetentionForOrg(o.id);
      out.push({ org_id: o.id, deleted: r.deleted });
    } catch (e) {
      out.push({ org_id: o.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
