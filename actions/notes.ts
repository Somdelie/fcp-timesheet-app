"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
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

export type NoteItem = {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  isPinned: boolean;
  updatedAt: string;
  attachments: NoteAttachmentItem[];
};

function serialize(n: {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
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
}): NoteItem {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    color: n.color as NoteColor,
    isPinned: n.isPinned,
    updatedAt: n.updatedAt.toISOString(),
    attachments: n.attachments.map((a) => ({
      id: a.id,
      url: a.url,
      publicId: a.publicId,
      name: a.name,
      type: a.type,
      size: a.size,
      mimeType: a.mimeType,
    })),
  };
}

export async function getNotes(): Promise<NoteItem[]> {
  const auth = await requireServerAuth();
  const notes = await prisma.userNote.findMany({
    where: { userId: auth.userId },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    include: { attachments: true },
  });
  return notes.map(serialize);
}

export async function createNote(input: {
  title: string;
  content: string;
  color?: NoteColor;
}): Promise<NoteItem> {
  const auth = await requireServerAuth();
  const note = await prisma.userNote.create({
    data: {
      userId: auth.userId,
      title: input.title,
      content: input.content,
      color: (input.color ?? "DEFAULT") as any,
    },
    include: { attachments: true },
  });
  revalidatePath("/notes");
  return serialize(note);
}

export async function updateNote(
  noteId: string,
  input: {
    title?: string;
    content?: string;
    color?: NoteColor;
    isPinned?: boolean;
  },
): Promise<void> {
  const auth = await requireServerAuth();
  await prisma.userNote.updateMany({
    where: { id: noteId, userId: auth.userId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.color !== undefined ? { color: input.color as any } : {}),
      ...(input.isPinned !== undefined ? { isPinned: input.isPinned } : {}),
    },
  });
  revalidatePath("/notes");
}

export async function deleteNote(noteId: string): Promise<void> {
  const auth = await requireServerAuth();
  await prisma.userNote.deleteMany({
    where: { id: noteId, userId: auth.userId },
  });
  revalidatePath("/notes");
}

export async function addNoteAttachment(
  noteId: string,
  attachment: {
    url: string;
    publicId: string;
    name: string;
    type: string;
    size: number;
    mimeType: string;
  },
): Promise<NoteAttachmentItem> {
  const auth = await requireServerAuth();
  // Verify ownership
  const note = await prisma.userNote.findFirst({
    where: { id: noteId, userId: auth.userId },
    select: { id: true },
  });
  if (!note) throw new Error("Note not found");

  const record = await prisma.noteAttachment.create({
    data: {
      noteId,
      url: attachment.url,
      publicId: attachment.publicId,
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      mimeType: attachment.mimeType,
    },
  });
  revalidatePath("/notes");
  return {
    id: record.id,
    url: record.url,
    publicId: record.publicId,
    name: record.name,
    type: record.type,
    size: record.size,
    mimeType: record.mimeType,
  };
}

export async function removeNoteAttachment(
  attachmentId: string,
): Promise<void> {
  const auth = await requireServerAuth();
  // Delete only if note belongs to user
  const attachment = await prisma.noteAttachment.findUnique({
    where: { id: attachmentId },
    include: { note: { select: { userId: true } } },
  });
  if (!attachment || attachment.note.userId !== auth.userId) return;
  await prisma.noteAttachment.delete({ where: { id: attachmentId } });
  revalidatePath("/notes");
}
