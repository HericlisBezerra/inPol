// Shared auth guard for /api/public/hooks/* cron endpoints.
// Uses the canonical Supabase apikey header check with the publishable key —
// the same value pg_cron already has and sends. Constant-time compare.

import { timingSafeEqual } from "node:crypto";

export function isAuthorizedCron(request: Request): boolean {
  const expected =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";
  if (!expected) return false;

  const provided =
    request.headers.get("apikey") ??
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
