import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (p && (p.role === "ADMIN" || p.role === "OFFICE"))
      return { id: p.sub, role: p.role as "ADMIN" | "OFFICE" };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE"))
    return { id: (session.user as any).id as string, role: role as "ADMIN" | "OFFICE" };
  return null;
}

/** DELETE /api/app/admin/paint-planning/[id] */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const { id } = await params;

  await prisma.sitePaintPlan.delete({ where: { id } });

  return NextResponse.json({ ok: true }, { headers: CORS });
}
