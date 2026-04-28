import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuth(req: Request) {
  const token = getBearer(req);
  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return { userId: null, role: null };
    return { userId: payload.sub, role: payload.role };
  }
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  return { userId: user?.id ?? null, role: user?.role ?? null };
}

export async function GET(req: Request) {
  const { userId, role } = await getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "SUPERVISOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!supervisor)
    return NextResponse.json({ error: "Supervisor not found" }, { status: 404 });

  const now = new Date();

  // Foremen actively linked to this supervisor
  const links = await prisma.supervisorForeman.findMany({
    where: {
      supervisorId: supervisor.id,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: {
      foreman: {
        select: {
          id: true,
          user: { select: { name: true, phone: true } },
          siteAssignments: {
            where: {
              startsOn: { lte: now },
              OR: [{ endsOn: null }, { endsOn: { gt: now } }],
            },
            select: {
              site: {
                select: { id: true, name: true, code: true, location: true },
              },
            },
          },
        },
      },
    },
  });

  const foremen = links.map(({ foreman }) => ({
    id: foreman.id,
    name: foreman.user.name ?? "Unknown",
    phoneNumber: foreman.user.phone ?? null,
    sites: foreman.siteAssignments.map((a) => ({
      id: a.site.id,
      name: a.site.name,
      code: a.site.code,
      location: a.site.location,
    })),
  }));

  return NextResponse.json({ foremen });
}
