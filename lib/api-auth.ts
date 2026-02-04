import { ApiJwtPayload, verifyApiToken } from "./jwt";

export async function requireApiAuth(
  req: Request,
): Promise<ApiJwtPayload | null> {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return verifyApiToken(m[1]);
}

export function requireRole(auth: ApiJwtPayload, roles: string[]) {
  return roles.includes(auth.role);
}
