import { NextRequest } from "next/server";

import { verifyApiToken, type ApiJwtPayload } from "@/lib/jwt";

export type ApiAuthContext = {
  user: ApiJwtPayload;
};

/**
 * Extract and verify a Bearer JWT from the Authorization header.
 * Returns null if missing or invalid.
 */
export async function getApiAuthContext(
  req: NextRequest,
): Promise<ApiAuthContext | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const payload = await verifyApiToken(token);
  if (!payload) return null;

  return { user: payload };
}

/**
 * Require an authenticated API caller (Expo/Electron/other clients).
 *
 * - Returns the auth context when valid.
 * - Returns null when missing/invalid token or role not allowed.
 *
 * Route handlers are responsible for returning a 401/403 response
 * or any other shape they want (no thrown Responses, so no 500 overlay).
 */
export async function requireApiAuth(
  req: NextRequest,
  roles?: string[],
): Promise<ApiAuthContext | null> {
  const ctx = await getApiAuthContext(req);
  if (!ctx) return null;

  if (roles && !roles.includes(ctx.user.role)) {
    return null;
  }

  return ctx;
}
