// LGPD retention/purge helpers (server-only).
// Deletes raw_messages older than each org's retention_days and logs
// a retention_purge event.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEFAULT_RETENTION_DAYS = 180;

export async function purgeRetentionForOrg(orgId: string): Promise<{ deleted: number }> {
  const { data: policy } = await supabaseAdmin
    .from("org_lgpd_policy")
    .select("retention_days")
    .eq("org_id", orgId)
    .maybeSingle();
  const days = policy?.retention_days ?? DEFAULT_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: deleted } = await supabaseAdmin
    .from("raw_messages")
    .delete()
    .eq("org_id", orgId)
    .lt("posted_at", cutoff)
    .select("id");

  const count = deleted?.length ?? 0;
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
  const { data: orgs } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("is_demo", false);
  const out: Array<{ org_id: string; deleted?: number; error?: string }> = [];
  for (const o of orgs ?? []) {
    try {
      const r = await purgeRetentionForOrg(o.id);
      out.push({ org_id: o.id, deleted: r.deleted });
    } catch (e) {
      out.push({ org_id: o.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
