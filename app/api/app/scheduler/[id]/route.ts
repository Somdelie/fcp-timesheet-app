import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
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
    if (p) return { id: p.sub, role: p.role };
  }
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return {
      id: (session.user as any).id as string,
      role: (session.user as any).role as string,
    };
  }
  return null;
}

const categoryMap: Record<string, string> = {
  meeting: "MEETING",
  todo: "TODO",
  reminder: "REMINDER",
  event: "EVENT",
};
const priorityMap: Record<string, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

/** PATCH /api/app/scheduler/[id] – update a task */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, any> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.category !== undefined)
    data.category = (categoryMap[body.category] ?? body.category.toUpperCase()) as any;
  if (body.priority !== undefined)
    data.priority = (priorityMap[body.priority] ?? body.priority.toUpperCase()) as any;
  if (body.time !== undefined) data.time = body.time || null;
  if (body.date !== undefined) data.date = new Date(body.date + "T00:00:00.000Z");
  if (body.column !== undefined) data.column = body.column;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  await prisma.schedulerTask.updateMany({
    where: { id, userId: auth.id },
    data,
  });

  return NextResponse.json({ ok: true }, { headers: CORS });
}

/** DELETE /api/app/scheduler/[id] – delete a task */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const { id } = await params;

  await prisma.schedulerTask.deleteMany({
    where: { id, userId: auth.id },
  });

  return NextResponse.json({ ok: true }, { headers: CORS });
}
