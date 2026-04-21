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

/** DELETE /api/app/notes/[id]/comments/[commentId] */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const { commentId } = await params;

  const comment = await prisma.noteComment.findUnique({
    where: { id: commentId },
    include: {
      note: { include: { members: { select: { userId: true, role: true } } } },
    },
  });

  if (!comment)
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });

  const isAuthor = comment.userId === auth.id;
  const canEdit =
    comment.note.userId === auth.id ||
    comment.note.members.some(
      (m) => m.userId === auth.id && (m.role === "OWNER" || m.role === "EDITOR"),
    );

  if (!isAuthor && !canEdit)
    return NextResponse.json({ error: "Unauthorized" }, { status: 403, headers: CORS });

  await prisma.noteComment.delete({ where: { id: commentId } });

  return NextResponse.json({ ok: true }, { headers: CORS });
}
