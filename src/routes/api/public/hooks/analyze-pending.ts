import { createFileRoute } from "@tanstack/react-router";

// Called by pg_cron after collection jobs. It closes the loop:
// raw_messages -> message_analyses -> topics/alerts/report inputs.
export const Route = createFileRoute("/api/public/hooks/analyze-pending")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCron, unauthorizedResponse } = await import("@/lib/cron-auth.server");
        if (!isAuthorizedCron(request)) return unauthorizedResponse();

        try {
          const body = (await request.json().catch(() => ({}))) as { limitPerOrg?: number };
          const { runAnalysisForPendingAllOrgs } = await import("@/lib/ingest.server");
          const { detectAlertsAllOrgs } = await import("@/lib/alerts.server");
          const limit = Math.max(10, Math.min(200, Number(body.limitPerOrg ?? 80)));
          const analysis = await runAnalysisForPendingAllOrgs(limit);
          const alerts = await detectAlertsAllOrgs();

          return new Response(JSON.stringify({ ok: true, analysis, alerts }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});