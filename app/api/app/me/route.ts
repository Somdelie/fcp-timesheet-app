import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim();
}

export async function GET(req: Request) {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json(
      { error: "Missing authorization token" },
      { status: 401 },
    );
  }

  let payload: { sub: string; role: string };
  try {
    const result = await verifyApiToken(token);
    if (!result) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }
    payload = result;
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  // ✅ sites for FOREMAN via ForemanSiteAssignment, active assignment window + active sites
  let sites: Array<{
    id: string;
    name: string;
    jobNumber: string | null;
    active: boolean;
  }> = [];

  if (user.role === "FOREMAN") {
    const foreman = await prisma.foreman.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (foreman) {
      const rows = await prisma.foremanSiteAssignment.findMany({
        where: {
          foremanId: foreman.id,
          endsOn: null, // current assignment
          site: { isActive: true },
        },
        select: {
          site: {
            select: { id: true, name: true, code: true, isActive: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // de-dupe by site id
      const map = new Map<
        string,
        { id: string; name: string; jobNumber: string | null; active: boolean }
      >();
      for (const r of rows) {
        map.set(r.site.id, {
          id: r.site.id,
          name: r.site.name,
          jobNumber: r.site.code ?? null,
          active: r.site.isActive,
        });
      }
      sites = Array.from(map.values());
    }
  }

  return NextResponse.json({ user, sites });
}
