"use server";

import { requireServerAuth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type NoteColor =
  | "DEFAULT"
  | "RED"
  | "ORANGE"
  | "YELLOW"
  | "GREEN"
  | "BLUE"
  | "PURPLE"
  | "PINK";

export type NoteAttachmentItem = {
  id: string;
  url: string;
  publicId: string;
  name: string;
  type: string;
  size: number;
  mimeType: string;
};

export type NoteCommentItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type NoteMemberRole = "OWNER" | "EDITOR" | "VIEWER";
export type NoteInviteStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "CANCELLED";

export type NoteMemberItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: NoteMemberRole;
};

export type NoteInviteItem = {
  id: string;
  invitedUserId: string;
  invitedUserName: string;
  invitedUserEmail: string;
  invitedByUserId: string;
  role: NoteMemberRole;
  status: NoteInviteStatus;
  createdAt: string;
};

export type NoteItem = {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  isPinned: boolean;
  isRoomNote: boolean;
  updatedAt: string;
  ownerId: string;
  canEdit: boolean;
  canDelete: boolean;
  attachments: NoteAttachmentItem[];
  comments: NoteCommentItem[];
  members: NoteMemberItem[];
  invites: NoteInviteItem[];
  myPendingInviteId: string | null;
  isInvited: boolean;
};

export type SearchUserItem = {
  id: string;
  name: string;
  email: string;
};

function serialize(
  n: {
    id: string;
    userId: string;
    title: string;
    content: string;
    color: string;
    isPinned: boolean;
    isRoomNote: boolean;
    updatedAt: Date;
    attachments: {
      id: string;
      url: string;
      publicId: string;
      name: string;
      type: string;
      size: number;
      mimeType: string;
    }[];
    comments: {
      id: string;
      userId: string;
      user: { name: string | null; email: string };
      content: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    members: {
      id: string;
      userId: string;
      role: "OWNER" | "EDITOR" | "VIEWER";
      user: { name: string | null; email: string };
    }[];
    invites: {
      id: string;
      invitedUserId: string;
      invitedUser: { name: string | null; email: string };
      invitedByUserId: string;
      role: "OWNER" | "EDITOR" | "VIEWER";
      status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
      createdAt: Date;
    }[];
  },
  authUserId: string,
): NoteItem {
  const member = n.members.find((m) => m.userId === authUserId);
  const myPendingInvite =
    n.invites.find(
      (i) => i.invitedUserId === authUserId && i.status === "PENDING",
    ) ?? null;

  return {
    id: n.id,
    title: n.title,
    content: n.content,
    color: n.color as NoteColor,
    isPinned: n.isPinned,
    isRoomNote: n.isRoomNote,
    updatedAt: n.updatedAt.toISOString(),
    ownerId: n.userId,
    canEdit:
      n.userId === authUserId ||
      member?.role === "OWNER" ||
      member?.role === "EDITOR",
    canDelete: n.userId === authUserId,
    attachments: n.attachments.map((a) => ({
      id: a.id,
      url: a.url,
      publicId: a.publicId,
      name: a.name,
      type: a.type,
      size: a.size,
      mimeType: a.mimeType,
    })),
    comments: n.comments.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user.name || "Anonymous",
      userEmail: c.user.email,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    members: n.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      userName: m.user.name || "Anonymous",
      userEmail: m.user.email,
      role: m.role,
    })),
    invites: n.invites.map((i) => ({
      id: i.id,
      invitedUserId: i.invitedUserId,
      invitedUserName: i.invitedUser.name || "Anonymous",
      invitedUserEmail: i.invitedUser.email,
      invitedByUserId: i.invitedByUserId,
      role: i.role,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
    })),
    myPendingInviteId: myPendingInvite?.id ?? null,
    isInvited: !!myPendingInvite,
  };
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
        include: {
          user: { select: { name: true, email: true } },
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
    (m) => m.userId === userId && (m.role === "OWNER" || m.role === "EDITOR"),
  );
}

function canViewNote(
  note: {
    userId: string;
    members: { userId: string }[];
  },
  userId: string,
) {
  return (
    note.userId === userId || note.members.some((m) => m.userId === userId)
  );
}

export async function getNotes(): Promise<NoteItem[]> {
  const auth = await requireServerAuth();

  const notes = await prisma.userNote.findMany({
    where: {
      OR: [
        { userId: auth.userId },
        { members: { some: { userId: auth.userId } } },
        {
          invites: {
            some: {
              invitedUserId: auth.userId,
              status: "PENDING",
            },
          },
        },
      ],
    },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    include: {
      attachments: true,
      comments: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      members: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      invites: {
        include: {
          invitedUser: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return notes.map((n) => serialize(n, auth.userId));
}

export async function createNote(input: {
  title: string;
  content: string;
  color?: NoteColor;
  isRoomNote?: boolean;
}): Promise<NoteItem> {
  const auth = await requireServerAuth();

  const note = await prisma.userNote.create({
    data: {
      userId: auth.userId,
      title: input.title,
      content: input.content,
      color: input.color ?? "DEFAULT",
      isRoomNote: input.isRoomNote ?? false,
      members: {
        create: {
          userId: auth.userId,
          role: "OWNER",
        },
      },
    },
    include: {
      attachments: true,
      comments: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      members: {
        include: { user: { select: { name: true, email: true } } },
      },
      invites: {
        include: {
          invitedUser: { select: { name: true, email: true } },
        },
      },
    },
  });

  revalidatePath("/notes");
  return serialize(note, auth.userId);
}

export async function updateNote(
  noteId: string,
  input: {
    title?: string;
    content?: string;
    color?: NoteColor;
    isPinned?: boolean;
    isRoomNote?: boolean;
  },
): Promise<void> {
  const auth = await requireServerAuth();

  const note = await getAccessibleNote(noteId, auth.userId);
  if (!note || !canEditNote(note, auth.userId)) {
    throw new Error("Unauthorized");
  }

  await prisma.userNote.update({
    where: { id: noteId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
      ...(input.isRoomNote !== undefined
        ? { isRoomNote: input.isRoomNote }
        : {}),
    },
  });

  revalidatePath("/notes");
}

export async function deleteNote(noteId: string): Promise<void> {
  const auth = await requireServerAuth();

  const note = await prisma.userNote.findUnique({
    where: { id: noteId },
    select: { id: true, userId: true },
  });

  if (!note || note.userId !== auth.userId) {
    throw new Error("Unauthorized");
  }

  await prisma.userNote.delete({
    where: { id: noteId },
  });

  revalidatePath("/notes");
}

export async function inviteUserToNote(input: {
  noteId: string;
  invitedUserId: string;
  role?: NoteMemberRole;
}): Promise<void> {
  const auth = await requireServerAuth();

  const note = await prisma.userNote.findFirst({
    where: {
      id: input.noteId,
      OR: [
        { userId: auth.userId },
        {
          members: {
            some: { userId: auth.userId, role: { in: ["OWNER", "EDITOR"] } },
          },
        },
      ],
    },
    select: { id: true },
  });

  if (!note) throw new Error("Note not found or unauthorized");

  await prisma.userNote.update({
    where: { id: input.noteId },
    data: { isRoomNote: true },
  });

  await prisma.noteInvite.upsert({
    where: {
      noteId_invitedUserId: {
        noteId: input.noteId,
        invitedUserId: input.invitedUserId,
      },
    },
    update: {
      status: "PENDING",
      role: input.role ?? "VIEWER",
      invitedByUserId: auth.userId,
      acceptedAt: null,
      declinedAt: null,
    },
    create: {
      noteId: input.noteId,
      invitedUserId: input.invitedUserId,
      invitedByUserId: auth.userId,
      role: input.role ?? "VIEWER",
      status: "PENDING",
    },
  });

  revalidatePath("/notes");
}

export async function acceptNoteInvite(inviteId: string): Promise<void> {
  const auth = await requireServerAuth();

  const invite = await prisma.noteInvite.findFirst({
    where: {
      id: inviteId,
      invitedUserId: auth.userId,
      status: "PENDING",
    },
    select: {
      id: true,
      noteId: true,
      invitedUserId: true,
      role: true,
    },
  });

  if (!invite) throw new Error("Invite not found");

  await prisma.$transaction([
    prisma.noteInvite.update({
      where: { id: invite.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    }),
    prisma.noteMember.upsert({
      where: {
        noteId_userId: {
          noteId: invite.noteId,
          userId: invite.invitedUserId,
        },
      },
      update: {
        role: invite.role,
      },
      create: {
        noteId: invite.noteId,
        userId: invite.invitedUserId,
        role: invite.role,
      },
    }),
  ]);

  revalidatePath("/notes");
}

export async function declineNoteInvite(inviteId: string): Promise<void> {
  const auth = await requireServerAuth();

  await prisma.noteInvite.updateMany({
    where: {
      id: inviteId,
      invitedUserId: auth.userId,
      status: "PENDING",
    },
    data: {
      status: "DECLINED",
      declinedAt: new Date(),
    },
  });

  revalidatePath("/notes");
}

export async function removeUserFromNote(input: {
  noteId: string;
  userId: string;
}): Promise<void> {
  const auth = await requireServerAuth();

  const note = await prisma.userNote.findFirst({
    where: { id: input.noteId, userId: auth.userId },
    select: { id: true },
  });

  if (!note) throw new Error("Unauthorized");

  await prisma.noteMember.deleteMany({
    where: {
      noteId: input.noteId,
      userId: input.userId,
    },
  });

  await prisma.noteInvite.updateMany({
    where: {
      noteId: input.noteId,
      invitedUserId: input.userId,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
    },
  });

  revalidatePath("/notes");
}

export async function addNoteComment(
  noteId: string,
  content: string,
): Promise<NoteCommentItem> {
  const auth = await requireServerAuth();

  const note = await getAccessibleNote(noteId, auth.userId);
  if (!note || (!canViewNote(note, auth.userId) && !note.isRoomNote)) {
    throw new Error("Note not found");
  }

  const comment = await prisma.noteComment.create({
    data: {
      noteId,
      userId: auth.userId,
      content,
    },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  revalidatePath("/notes");

  return {
    id: comment.id,
    userId: comment.userId,
    userName: comment.user.name || "Anonymous",
    userEmail: comment.user.email,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

export async function removeNoteComment(commentId: string): Promise<void> {
  const auth = await requireServerAuth();

  const comment = await prisma.noteComment.findUnique({
    where: { id: commentId },
    include: {
      note: {
        include: {
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!comment) {
    throw new Error("Comment not found");
  }

  const isAuthor = comment.userId === auth.userId;
  const canEdit = canEditNote(comment.note, auth.userId);

  if (!isAuthor && !canEdit) {
    throw new Error("Unauthorized");
  }

  await prisma.noteComment.delete({
    where: { id: commentId },
  });

  revalidatePath("/notes");
}

export async function addNoteAttachment(
  noteId: string,
  attachment: Omit<NoteAttachmentItem, "id">,
): Promise<NoteAttachmentItem> {
  const auth = await requireServerAuth();

  const note = await getAccessibleNote(noteId, auth.userId);
  if (!note || !canEditNote(note, auth.userId)) {
    throw new Error("Unauthorized");
  }

  const created = await prisma.noteAttachment.create({
    data: {
      noteId,
      url: attachment.url,
      publicId: attachment.publicId,
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      mimeType: attachment.mimeType,
    },
    select: {
      id: true,
      url: true,
      publicId: true,
      name: true,
      type: true,
      size: true,
      mimeType: true,
    },
  });

  revalidatePath("/notes");

  return created;
}

export async function removeNoteAttachment(
  attachmentId: string,
): Promise<void> {
  const auth = await requireServerAuth();

  const attachment = await prisma.noteAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      note: {
        include: {
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!attachment || !canEditNote(attachment.note, auth.userId)) {
    throw new Error("Unauthorized");
  }

  await prisma.noteAttachment.delete({
    where: { id: attachmentId },
  });

  revalidatePath("/notes");
}

export async function searchUsers(query: string): Promise<SearchUserItem[]> {
  const auth = await requireServerAuth();
  const q = query.trim();

  if (q.length < 2) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { not: auth.userId },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ name: "asc" }],
    take: 10,
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name ?? u.email,
    email: u.email,
  }));
}
