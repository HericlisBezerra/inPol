// Backfill WhatsApp history via Evolution API when the webhook missed messages.
// Loops monitored groups of an instance and reuses ingestEvolutionMessages so
// dedupe (external_id), author hashing, AI analysis and alerts all still apply.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchMessagesForGroup } from "@/lib/evolution.server";
import { ingestEvolutionMessages, type EvolutionMessagePayload } from "@/lib/ingest.server";

export interface BackfillOptions {
  days?: number; // how far back to pull, default 14
  pageSize?: number; // page size per Evolution call, default 100
  maxPagesPerGroup?: number; // hard cap, default 15
}

export async function backfillInstance(
  instanceId: string,
  options: BackfillOptions & { onlyIfStaleHours?: number } = {},
): Promise<{
  instance: string;
  groups: number;
  fetched: number;
  inserted: number;
  skipped: number;
  errors: Array<{ group: string; error: string }>;
  skippedReason?: string;
}> {
  const days = options.days ?? 14;
  const sinceTs = Math.floor((Date.now() - days * 86400_000) / 1000);

  const { data: inst, error } = await supabaseAdmin
    .from("whatsapp_instances")
    .select(
      "id, org_id, source_id, instance_name, evolution_base_url, evolution_api_key, organizations(author_hash_salt)",
    )
    .eq("id", instanceId)
    .maybeSingle();
  if (error || !inst) throw new Error("Instância não encontrada");

  const orgRow = Array.isArray(inst.organizations) ? inst.organizations[0] : inst.organizations;
  const salt = (orgRow as { author_hash_salt: string } | null)?.author_hash_salt ?? "fallback-salt";

  // Auto-skip when the webhook is clearly alive: newest ingested message
  // for this instance is within onlyIfStaleHours. Default off (undefined).
  if (options.onlyIfStaleHours && options.onlyIfStaleHours > 0) {
    const staleCutoff = new Date(Date.now() - options.onlyIfStaleHours * 3_600_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("raw_messages")
      .select("posted_at, whatsapp_groups!inner(instance_id)")
      .eq("whatsapp_groups.instance_id", inst.id)
      .gte("posted_at", staleCutoff)
      .order("posted_at", { ascending: false })
      .limit(1);
    if (recent && recent.length > 0) {
      return {
        instance: inst.instance_name,
        groups: 0,
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: [],
        skippedReason: `webhook_alive:last_msg_${recent[0].posted_at}`,
      };
    }
  }

  const { data: groups } = await supabaseAdmin
    .from("whatsapp_groups")
    .select("id, remote_jid, subject")
    .eq("instance_id", inst.id)
    .eq("is_monitored", true);

  const groupMap = new Map<string, string>();
  for (const g of groups ?? []) groupMap.set(g.remote_jid, g.id);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  const errors: Array<{ group: string; error: string }> = [];

  for (const g of groups ?? []) {
    try {
      const raw = await fetchMessagesForGroup(
        inst.evolution_base_url,
        inst.evolution_api_key,
        inst.instance_name,
        {
          remoteJid: g.remote_jid,
          sinceTsSeconds: sinceTs,
          pageSize: options.pageSize ?? 100,
          maxPages: options.maxPagesPerGroup ?? 15,
        },
      );
      totalFetched += raw.length;
      if (raw.length === 0) continue;

      const res = await ingestEvolutionMessages(
        { orgId: inst.org_id, sourceId: inst.source_id ?? "", authorSalt: salt },
        groupMap,
        raw as EvolutionMessagePayload[],
      );
      totalInserted += res.inserted;
      totalSkipped += res.skipped;
    } catch (e) {
      errors.push({
        group: g.subject ?? g.remote_jid,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await supabaseAdmin.from("audit_log").insert({
    org_id: inst.org_id,
    action: "whatsapp.backfill.run",
    target_kind: "whatsapp_instance",
    target_id: inst.id,
    metadata: {
      days,
      groups: groups?.length ?? 0,
      fetched: totalFetched,
      inserted: totalInserted,
      skipped: totalSkipped,
      errors: errors.length,
    },
  });

  return {
    instance: inst.instance_name,
    groups: groups?.length ?? 0,
    fetched: totalFetched,
    inserted: totalInserted,
    skipped: totalSkipped,
    errors,
  };
}

export async function backfillAllInstancesForOrg(
  orgId: string,
  options: BackfillOptions & { onlyIfStaleHours?: number } = {},
) {
  const { data: instances } = await supabaseAdmin
    .from("whatsapp_instances")
    .select("id")
    .eq("org_id", orgId);
  const results = [];
  for (const i of instances ?? []) {
    try {
      results.push(await backfillInstance(i.id, options));
    } catch (e) {
      results.push({ instance: i.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
