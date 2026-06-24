import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user) return { id: (session.user as any).id as string };
  return null;
}

export async function GET(req: Request) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invites = await prisma.noteInvite.findMany({
    where: { invitedUserId: auth.id, status: "PENDING" },
    include: {
      invitedByUser: { select: { id: true, name: true } },
      note: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    invites.map((inv) => ({
      id: inv.id,
      noteId: inv.noteId,
      invitedBy: { id: inv.invitedByUser?.id, name: inv.invitedByUser?.name },
      noteTitle: inv.note?.title ?? null,
      createdAt: inv.createdAt,
    })),
  );
}
