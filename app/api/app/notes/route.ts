import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function serializeNote(n: any, authUserId: string) {
  const member = n.members?.find((m: any) => m.userId === authUserId);
  const myPendingInvite =
    n.invites?.find(
      (i: any) => i.invitedUserId === authUserId && i.status === "PENDING",
    ) ?? null;

  return {
    id: n.id,
    title: n.title,
    content: n.content,
    color: n.color,
    isPinned: n.isPinned,
    isRoomNote: n.isRoomNote,
    background: n.background ?? "",
    updatedAt: n.updatedAt instanceof Date ? n.updatedAt.toISOString() : n.updatedAt,
    ownerId: n.userId,
    canEdit:
      n.userId === authUserId ||
      member?.role === "OWNER" ||
      member?.role === "EDITOR",
    canDelete: n.userId === authUserId,
    attachments: (n.attachments ?? []).map((a: any) => ({
      id: a.id,
      url: a.url,
      publicId: a.publicId,
      name: a.name,
      type: a.type,
      size: a.size,
      mimeType: a.mimeType,
    })),
    comments: (n.comments ?? []).map((c: any) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user?.name || "Anonymous",
      userEmail: c.user?.email,
      content: c.content,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
    })),
    members: (n.members ?? []).map((m: any) => ({
      id: m.id,
      userId: m.userId,
      userName: m.user?.name || "Anonymous",
      userEmail: m.user?.email,
      role: m.role,
    })),
    invites: (n.invites ?? []).map((i: any) => ({
      id: i.id,
      invitedUserId: i.invitedUserId,
      invitedUserName: i.invitedUser?.name || "Anonymous",
      invitedUserEmail: i.invitedUser?.email,
      invitedByUserId: i.invitedByUserId,
      role: i.role,
      status: i.status,
      createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt,
    })),
    myPendingInviteId: myPendingInvite?.id ?? null,
    isInvited: !!myPendingInvite,
  };
}

const noteInclude = {
  attachments: true,
  comments: {
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  members: {
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  invites: {
    include: { invitedUser: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

/** GET /api/app/notes – list notes for current user */
export async function GET(req: Request) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const notes = await prisma.userNote.findMany({
    where: {
      OR: [
        { userId: auth.id },
        { members: { some: { userId: auth.id } } },
        { invites: { some: { invitedUserId: auth.id, status: "PENDING" } } },
      ],
    },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    include: noteInclude,
  });

  return NextResponse.json(
    { notes: notes.map((n) => serializeNote(n, auth.id)) },
    { headers: CORS },
  );
}

/** POST /api/app/notes – create a note */
export async function POST(req: Request) {
  const auth = await getAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });

  const body = await req.json();
  const { title, content, color, isRoomNote } = body;

  const note = await prisma.userNote.create({
    data: {
      userId: auth.id,
      title: title || "Untitled",
      content: content || "",
      color: color ?? "DEFAULT",
      isRoomNote: isRoomNote ?? false,
      background: "note-bg",
      members: {
        create: { userId: auth.id, role: "OWNER" },
      },
    },
    include: noteInclude,
  });

  return NextResponse.json(
    { note: serializeNote(note, auth.id) },
    { status: 201, headers: CORS },
  );
}
