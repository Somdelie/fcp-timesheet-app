import { NextRequest, NextResponse } from "next/server";
import { requireServerAuth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { CollaborationService } from "@/lib/collaboration-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toBoolean(value: string | null): boolean {
  return value === "true";
}

async function getAccessibleNote(noteId: string, userId: string) {
  return prisma.userNote.findFirst({
    where: {
      id: noteId,
      OR: [
        { userId },
        { members: { some: { userId } } },
        {
          invites: {
            some: {
              invitedUserId: userId,
              status: "PENDING",
            },
          },
        },
      ],
    },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
        },
      },
    },
  });
}

function canEditNote(
  note: {
    userId: string;
    members: { userId: string; role: "OWNER" | "EDITOR" | "VIEWER" }[];
  },
  userId: string,
) {
  if (note.userId === userId) return true;
  return note.members.some(
    (member) =>
      member.userId === userId &&
      (member.role === "OWNER" || member.role === "EDITOR"),
  );
}

async function buildSnapshot(noteId: string) {
  const [note, activeUsers, latestEdit] = await Promise.all([
    prisma.userNote.findUnique({
      where: { id: noteId },
      select: {
        title: true,
        content: true,
        updatedAt: true,
      },
    }),
    CollaborationService.getActiveCollaborators(noteId),
    prisma.noteEditHistory.findFirst({
      where: { noteId },
      orderBy: { createdAt: "desc" },
      select: { userId: true },
    }),
  ]);

  if (!note) {
    return null;
  }

  return {
    activeUsers: activeUsers.map((user) => ({
      ...user,
      lastActivityAt: user.lastActivityAt.getTime(),
    })),
    note: {
      title: note.title,
      content: note.content,
      updatedAt: note.updatedAt.toISOString(),
    },
    latestEditUserId: latestEdit?.userId ?? null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  const auth = await requireServerAuth();
  const { noteId } = await params;

  const note = await getAccessibleNote(noteId, auth.userId);
  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  await CollaborationService.updatePresence(
    noteId,
    auth.userId,
    toNumber(request.nextUrl.searchParams.get("cursorPosition")),
    toNumber(request.nextUrl.searchParams.get("cursorLine")),
    toBoolean(request.nextUrl.searchParams.get("isTyping")),
    toBoolean(request.nextUrl.searchParams.get("isEditing")),
  );

  const snapshot = await buildSnapshot(noteId);
  if (!snapshot) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  const auth = await requireServerAuth();
  const { noteId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    title?: unknown;
    content?: unknown;
    cursorPosition?: unknown;
    cursorLine?: unknown;
    isTyping?: unknown;
    isEditing?: unknown;
  };

  const note = await getAccessibleNote(noteId, auth.userId);
  if (!note || !canEditNote(note, auth.userId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const title = typeof body.title === "string" ? body.title : undefined;
  const content = typeof body.content === "string" ? body.content : undefined;
  const cursorPosition =
    typeof body.cursorPosition === "number" ? body.cursorPosition : undefined;
  const cursorLine = typeof body.cursorLine === "number" ? body.cursorLine : undefined;
  const isTyping = body.isTyping === true;
  const isEditing = body.isEditing === true;

  await CollaborationService.updatePresence(
    noteId,
    auth.userId,
    cursorPosition,
    cursorLine,
    isTyping,
    isEditing,
  );

  const data: { title?: string; content?: string } = {};
  if (title !== undefined) data.title = title;
  if (content !== undefined) data.content = content;

  if (Object.keys(data).length > 0) {
    await prisma.$transaction([
      prisma.userNote.update({
        where: { id: noteId },
        data,
      }),
      prisma.noteEditHistory.create({
        data: {
          noteId,
          userId: auth.userId,
          changeType:
            title !== undefined && content !== undefined
              ? "text"
              : title !== undefined
                ? "title"
                : "text",
          operation: "update",
          previousContent: note.content,
          newContent: content ?? title ?? "",
        },
      }),
    ]);
  }

  const snapshot = await buildSnapshot(noteId);
  if (!snapshot) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  const auth = await requireServerAuth();
  const { noteId } = await params;

  await CollaborationService.removePresence(noteId, auth.userId);
  return new NextResponse(null, { status: 204 });
}
