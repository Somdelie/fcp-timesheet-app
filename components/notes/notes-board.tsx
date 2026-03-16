"use client";

import { useEffect, useState, useTransition } from "react";
import { StickyNote, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NoteCard } from "./note-card";
import { AddNoteDialog } from "./add-note-dialog";
import {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  addNoteAttachment,
  removeNoteAttachment,
  type NoteItem,
  type NoteColor,
  type NoteAttachmentItem,
} from "@/actions/notes";

export function NotesBoard() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await getNotes();
      setNotes(data);
    });
  }, []);

  const handleAdd = (input: {
    title: string;
    content: string;
    color: NoteColor;
    pendingAttachments: Omit<NoteAttachmentItem, "id">[];
  }) => {
    startTransition(async () => {
      const created = await createNote(input);
      // Save pending attachments
      const savedAttachments: NoteAttachmentItem[] = [];
      for (const a of input.pendingAttachments) {
        const saved = await addNoteAttachment(created.id, a);
        savedAttachments.push(saved);
      }
      created.attachments = savedAttachments;
      setNotes((prev) => [created, ...prev]);
    });
  };

  const handleUpdate = (
    id: string,
    data: {
      title?: string;
      content?: string;
      isPinned?: boolean;
    },
  ) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...data } : n)));
    startTransition(async () => {
      await updateNote(id, data);
    });
  };

  const handleDelete = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    startTransition(async () => {
      await deleteNote(id);
    });
  };

  const handleAttachmentUploaded = (
    noteId: string,
    attachment: NoteAttachmentItem,
  ) => {
    startTransition(async () => {
      const saved = await addNoteAttachment(noteId, attachment);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, attachments: [...n.attachments, saved] }
            : n,
        ),
      );
    });
  };

  const handleAttachmentRemoved = (noteId: string, attachmentId: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              attachments: n.attachments.filter((a) => a.id !== attachmentId),
            }
          : n,
      ),
    );
    startTransition(async () => {
      await removeNoteAttachment(attachmentId);
    });
  };

  const filtered = notes.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const plainContent = n.content.replace(/<[^>]*>/g, "").toLowerCase();
    return n.title.toLowerCase().includes(q) || plainContent.includes(q);
  });

  // Sort: pinned first, then by updatedAt desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your personal notes and quick thoughts
          </p>
        </div>
        <AddNoteDialog onAdd={handleAdd} />
      </div>

      {/* Search */}
      {notes.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-input border-border"
          />
        </div>
      )}

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <StickyNote className="size-10 opacity-30" />
          <p className="text-sm">
            {search
              ? "No notes match your search"
              : "No notes yet — create one!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onAttachmentUploaded={handleAttachmentUploaded}
              onAttachmentRemoved={handleAttachmentRemoved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
