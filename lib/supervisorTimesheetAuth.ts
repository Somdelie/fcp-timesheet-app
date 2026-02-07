import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function requireSupervisor(req: Request) {
  let userId: string | null = null;
  let role: string | null = null;

  const token = getBearer(req);
  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload)
      return {
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    userId = payload.sub;
    role = payload.role;
  } else {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    userId = user?.id ?? null;
    role = user?.role ?? null;
  }

  if (!userId)
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  if (role !== "SUPERVISOR")
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true, user: { select: { name: true } } },
  });

  if (!supervisor)
    return {
      error: NextResponse.json(
        { error: "Supervisor not found" },
        { status: 404 },
      ),
    };

  return { supervisor };
}
