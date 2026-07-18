import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/scan-news")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isAuthorizedCron, unauthorizedResponse } = await import("@/lib/cron-auth.server");
        if (!isAuthorizedCron(request)) return unauthorizedResponse();
        const { scanNewsAllOrgs } = await import("@/lib/scanners.server");
        try {
          const results = await scanNewsAllOrgs();
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
