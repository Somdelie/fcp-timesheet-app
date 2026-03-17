"use client";

import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NotesList } from "./notes-list";
import { NoteDetail } from "./note-detail";
import { AddNoteDialog } from "./add-note-dialog";
import {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  addNoteAttachment,
  removeNoteAttachment,
  addNoteComment,
  removeNoteComment,
  type NoteItem,
  type NoteColor,
  type NoteAttachmentItem,
  type NoteCommentItem,
} from "@/actions/notes";

export function NotesBoard() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await getNotes();
      setNotes(data);
      if (data.length > 0 && !selectedNoteId) {
        setSelectedNoteId(data[0].id);
      }
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
      const savedAttachments: NoteAttachmentItem[] = [];
      for (const a of input.pendingAttachments) {
        const saved = await addNoteAttachment(created.id, a);
        savedAttachments.push(saved);
      }
      created.attachments = savedAttachments;
      setNotes((prev) => [created, ...prev]);
      setSelectedNoteId(created.id);
    });
  };

  const handleUpdate = (
    id: string,
    data: {
      title?: string;
      content?: string;
      isPinned?: boolean;
      color?: NoteColor;
    },
  ) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...data } : n)));
    startTransition(async () => {
      await updateNote(id, data);
    });
  };

  const handleDelete = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNoteId === id) {
      setSelectedNoteId(notes[0]?.id || null);
    }
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

  const handleCommentAdded = (noteId: string, content: string) => {
    startTransition(async () => {
      const comment = await addNoteComment(noteId, content);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, comments: [...n.comments, comment] } : n,
        ),
      );
    });
  };

  const handleCommentRemoved = (commentId: string) => {
    setNotes((prev) =>
      prev.map((n) => ({
        ...n,
        comments: n.comments.filter((c) => c.id !== commentId),
      })),
    );
    startTransition(async () => {
      await removeNoteComment(commentId);
    });
  };

  const selectedNote =
    notes.find((n) => n.id === selectedNoteId) || notes[0] || null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              My Notes
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base mt-1">
              {notes.length} note{notes.length !== 1 ? "s" : ""}
            </p>
          </div>
          <AddNoteDialog onAdd={handleAdd} />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden gap-0 border-t">
        {/* Sidebar */}
        <div className="w-80 border-r overflow-hidden flex flex-col">
          {/* Search */}
          <div className="border-b p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-lg border-border/60 bg-secondary/30 pl-9 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground/70 focus:shadow-md"
              />
            </div>
          </div>

          {/* Notes List */}
          <NotesList
            notes={notes}
            selectedNoteId={selectedNoteId}
            onSelectNote={setSelectedNoteId}
            searchQuery={search}
          />
        </div>

        {/* Detail Pane */}
        {selectedNote ? (
          <NoteDetail
            note={selectedNote}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAttachmentUploaded={handleAttachmentUploaded}
            onAttachmentRemoved={handleAttachmentRemoved}
            onCommentAdded={handleCommentAdded}
            onCommentRemoved={handleCommentRemoved}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">No notes yet</p>
              <p className="text-sm">Create a new note to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
