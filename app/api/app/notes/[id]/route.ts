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

function canEdit(note: { userId: string; members: { userId: string; role: string }[] }, userId: string) {
  if (note.userId === userId) return true;
  return note.members.some(
    (m) => m.userId === userId && (m.role === "OWNER" || m.role === "EDITOR"),
  );
}

/** PATCH /api/app/notes/[id] – update a note */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const { id } = await params;
  const body = await req.json();

  const note = await prisma.userNote.findFirst({
    where: {
      id,
      OR: [
        { userId: auth.id },
        { members: { some: { userId: auth.id } } },
      ],
    },
    include: { members: { select: { userId: true, role: true } } },
  });

  if (!note || !canEdit(note, auth.id))
    return NextResponse.json({ error: "Unauthorized" }, { status: 403, headers: CORS });

  const data: Record<string, any> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.content !== undefined) data.content = body.content;
  if (body.color !== undefined) data.color = body.color;
  if (body.isPinned !== undefined) data.isPinned = body.isPinned;
  if (body.isRoomNote !== undefined) data.isRoomNote = body.isRoomNote;
  if (body.background !== undefined) data.background = body.background;

  await prisma.userNote.update({ where: { id }, data });

  return NextResponse.json({ ok: true }, { headers: CORS });
}

/** DELETE /api/app/notes/[id] – delete a note */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const { id } = await params;

  const note = await prisma.userNote.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!note || note.userId !== auth.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403, headers: CORS });

  await prisma.userNote.delete({ where: { id } });

  return NextResponse.json({ ok: true }, { headers: CORS });
}
