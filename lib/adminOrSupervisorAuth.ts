import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireApiAuth } from "@/lib/apiAuth";

export type RequestActor = { id: string; role: string; name?: string | null };

/**
 * Resolve the calling ADMIN/SUPERVISOR from either a mobile/Electron Bearer
 * token or a web NextAuth session — same dual-path pattern used by the
 * existing manual-scan admin route.
 */
export async function getAdminOrSupervisorFromRequest(
  req: NextRequest,
  allowedRoles: string[] = ["ADMIN", "SUPERVISOR"],
): Promise<RequestActor | null> {
  const apiCtx = await requireApiAuth(req, allowedRoles);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role };
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && role && allowedRoles.includes(role)) {
    return {
      id: (session.user as any).id as string,
      role,
      name: session.user.name,
    };
  }

  return null;
}
