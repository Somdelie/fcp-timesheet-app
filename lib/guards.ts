// lib/guards.ts
import { prisma } from "@/lib/prisma";
import type { ServerAuthUser } from "@/lib/auth-server";
import { siteWhereFor } from "@/lib/site-scope";

export async function requireCanManageSite(
  auth: ServerAuthUser,
  siteId: string,
) {
  // Admin / Office can manage all sites
  if (auth.role === "ADMIN" || auth.role === "OFFICE") return;

  // Supervisor can manage only sites assigned to them (active assignment)
  if (auth.role === "SUPERVISOR") {
    const ok = await prisma.site.findFirst({
      where: { id: siteId, ...siteWhereFor(auth) },
      select: { id: true },
    });
    if (!ok) throw new Error("Forbidden");
    return;
  }

  // Foreman cannot manage assignments/bookings by default
  throw new Error("Forbidden");
}
