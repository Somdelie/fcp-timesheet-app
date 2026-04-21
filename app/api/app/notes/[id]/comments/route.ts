import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

/** POST /api/app/notes/[id]/comments – add a comment */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const { id: noteId } = await params;
  const { content } = await req.json();

  if (!content?.trim())
    return NextResponse.json({ error: "Content is required" }, { status: 400, headers: CORS });

  const note = await prisma.userNote.findFirst({
    where: {
      id: noteId,
      OR: [
        { userId: auth.id },
        { members: { some: { userId: auth.id } } },
      ],
    },
    select: { id: true },
  });

  if (!note)
    return NextResponse.json({ error: "Note not found" }, { status: 404, headers: CORS });

  const comment = await prisma.noteComment.create({
    data: { noteId, userId: auth.id, content },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        userId: comment.userId,
        userName: comment.user.name || "Anonymous",
        userEmail: comment.user.email,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      },
    },
    { status: 201, headers: CORS },
  );
}
