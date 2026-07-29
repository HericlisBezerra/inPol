import { createFileRoute } from "@tanstack/react-router";

// Called by pg_cron with body { kind: "daily"|"weekly"|"monthly" }.
// Iterates all organizations and generates the report for each.
export const Route = createFileRoute("/api/public/hooks/generate-reports")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCron, unauthorizedResponse } = await import("@/lib/cron-auth.server");
        if (!isAuthorizedCron(request)) return unauthorizedResponse();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { generateReport } = await import("@/lib/reports.server");

        const body = (await request.json().catch(() => ({}))) as { kind?: string };
        const kind = body.kind === "weekly" || body.kind === "monthly" ? body.kind : "daily";

        // "Todas as orgs" tem que ser todas mesmo: sem paginar, uma org fora da primeira página
        // de 1.000 simplesmente nunca receberia relatório — e sem erro nenhum no cron.
        const { fetchAllPages } = await import("@/lib/pg-paginate");
        let orgs: Array<{ id: string }> = [];
        try {
          orgs = await fetchAllPages<{ id: string }>((from, to) =>
            supabaseAdmin
              .from("organizations")
              .select("id")
              .eq("is_demo", false)
              .order("id", { ascending: true })
              .range(from, to),
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ error: message }), { status: 500 });
        }

        const results: Array<{ org_id: string; report_id?: string; error?: string }> = [];
        for (const o of orgs) {
          try {
            const id = await generateReport(o.id, kind);
            results.push({ org_id: o.id, report_id: id });
          } catch (e) {
            results.push({ org_id: o.id, error: e instanceof Error ? e.message : String(e) });
          }
        }

        return new Response(JSON.stringify({ ok: true, kind, results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
