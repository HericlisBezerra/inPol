import { createFileRoute } from "@tanstack/react-router";

// Called by pg_cron every 15 minutes. Scans recent analyses and upserts alerts.
export const Route = createFileRoute("/api/public/hooks/detect-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCron, unauthorizedResponse } = await import("@/lib/cron-auth.server");
        if (!isAuthorizedCron(request)) return unauthorizedResponse();
        const { detectAlertsAllOrgs } = await import("@/lib/alerts.server");
        try {
          const results = await detectAlertsAllOrgs();
          return new Response(JSON.stringify({ ok: true, results }), {
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
