import { NextRequest } from "next/server";

/**
 * Shared guard for cron-callable API routes. Pass CRON_SECRET as
 * ?secret=... or Authorization: Bearer ... — see the routes under app/api/cron.
 */
export function authorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // If no secret configured, reject all cron calls

  const fromQuery = req.nextUrl.searchParams.get("secret");
  if (fromQuery === secret) return true;

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer === secret) return true;

  return false;
}
