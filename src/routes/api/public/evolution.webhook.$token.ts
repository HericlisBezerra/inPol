import { createFileRoute } from "@tanstack/react-router";
import type { EvolutionMessagePayload } from "@/lib/ingest.server";

export const Route = createFileRoute("/api/public/evolution/webhook/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { ingestEvolutionMessages } = await import("@/lib/ingest.server");

        const token = params.token;
        if (!token || token.length < 16) {
          return new Response(JSON.stringify({ error: "bad_token" }), { status: 401 });
        }

        // Lookup instance by webhook_token
        const { data: instance } = await supabaseAdmin
          .from("whatsapp_instances")
          .select("id, org_id, source_id, instance_name, organizations(author_hash_salt)")
          .eq("webhook_token", token)
          .maybeSingle();
        if (!instance) {
          return new Response(JSON.stringify({ error: "unknown_token" }), { status: 404 });
        }
        const orgRow = Array.isArray(instance.organizations)
          ? instance.organizations[0]
          : instance.organizations;
        const salt =
          (orgRow as { author_hash_salt: string } | null)?.author_hash_salt ?? "fallback-salt";

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
        }

        // Evolution sends: { event: "messages.upsert", data: { messages: [...] } } OR a single message in data
        const evt = (body as { event?: string }).event;
        if (evt && evt !== "messages.upsert" && evt !== "MESSAGES_UPSERT") {
          return new Response(JSON.stringify({ ok: true, ignored: evt }), { status: 200 });
        }
        const dataField = (body as { data?: unknown }).data;
        const rawMessages: EvolutionMessagePayload[] = (() => {
          if (!dataField) return [];
          if (Array.isArray(dataField)) return dataField as EvolutionMessagePayload[];
          const d = dataField as { messages?: unknown };
          if (Array.isArray(d.messages)) return d.messages as EvolutionMessagePayload[];
          return [dataField as EvolutionMessagePayload];
        })();

        if (rawMessages.length === 0) {
          return new Response(JSON.stringify({ ok: true, inserted: 0 }), { status: 200 });
        }

        // Build group map for monitored groups only
        const { data: groups } = await supabaseAdmin
          .from("whatsapp_groups")
          .select("id, remote_jid")
          .eq("instance_id", instance.id)
          .eq("is_monitored", true);
        const groupMap = new Map<string, string>();
        for (const g of groups ?? []) groupMap.set(g.remote_jid, g.id);

        const result = await ingestEvolutionMessages(
          { orgId: instance.org_id, sourceId: instance.source_id, authorSalt: salt },
          groupMap,
          rawMessages,
        );

        return new Response(JSON.stringify({ ok: true, ...result }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      GET: async ({ params }) =>
        new Response(JSON.stringify({ ok: true, token: params.token.slice(0, 6) + "…" }), {
          headers: { "content-type": "application/json" },
        }),
    },
  },
});
