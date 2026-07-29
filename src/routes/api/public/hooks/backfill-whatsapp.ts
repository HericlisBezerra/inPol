import { createFileRoute } from "@tanstack/react-router";

// Cron/manual hook: backfill WhatsApp history via Evolution API.
// Body: { orgId?: string, days?: number }
// - orgId omitted → runs for all non-demo orgs.
export const Route = createFileRoute("/api/public/hooks/backfill-whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCron, unauthorizedResponse } = await import("@/lib/cron-auth.server");
        if (!isAuthorizedCron(request)) return unauthorizedResponse();

        const body = (await request.json().catch(() => ({}))) as {
          orgId?: string;
          days?: number;
          onlyIfStaleHours?: number;
        };
        const days = Math.min(60, Math.max(1, Number(body.days ?? 14)));
        // Default: only run when there was NO whatsapp message in last 24h.
        // Pass onlyIfStaleHours=0 (or negative) to force a run.
        const onlyIfStaleHours =
          body.onlyIfStaleHours === undefined ? 24 : Number(body.onlyIfStaleHours);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { backfillAllInstancesForOrg } = await import("@/lib/backfill.server");

        // Sem orgId no body o hook roda para TODAS as orgs — paginado, senão uma org fora da
        // primeira página de 1.000 nunca teria backfill, em silêncio.
        const { fetchAllPages } = await import("@/lib/pg-paginate");
        const orgs = body.orgId
          ? [{ id: body.orgId }]
          : await fetchAllPages<{ id: string }>((from, to) =>
              supabaseAdmin
                .from("organizations")
                .select("id")
                .eq("is_demo", false)
                .order("id", { ascending: true })
                .range(from, to),
            );

        const results: Record<string, unknown> = {};
        for (const o of orgs) {
          try {
            results[o.id] = await backfillAllInstancesForOrg(o.id, { days, onlyIfStaleHours });
          } catch (e) {
            results[o.id] = { error: e instanceof Error ? e.message : String(e) };
          }
        }

        return new Response(JSON.stringify({ ok: true, days, onlyIfStaleHours, results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
