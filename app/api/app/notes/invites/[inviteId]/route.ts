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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteId } = await params;

  const invite = await prisma.noteInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite || invite.invitedUserId !== auth.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "Already handled" }, { status: 400 });
  }

  // Add the invited user as a NoteMember (EDITOR) and mark invite accepted
  await prisma.$transaction([
    prisma.noteMember.create({
      data: { noteId: invite.noteId, userId: auth.id, role: "EDITOR" },
    }),
    prisma.noteInvite.update({
      where: { id: inviteId },
      data: { status: "ACCEPTED" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteId } = await params;

  const invite = await prisma.noteInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite || invite.invitedUserId !== auth.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Decline -> delete invite
  await prisma.noteInvite.delete({ where: { id: inviteId } });

  return NextResponse.json({ ok: true });
}
