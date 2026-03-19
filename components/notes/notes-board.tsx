"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { Search, StickyNote } from "lucide-react";
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
} from "@/actions/notes";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

export function NotesBoard() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(pointerSensor, keyboardSensor);

  useEffect(() => {
    startTransition(async () => {
      const data = await getNotes();
      setNotes(data);
      if (data.length > 0 && !selectedNoteId) {
        setSelectedNoteId(data[0].id);
      }
      setIsLoading(false);
    });
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const oldIndex = notes.findIndex((note) => note.id === active.id);
    const newIndex = notes.findIndex((note) => note.id === over.id);

    if (oldIndex !== newIndex) {
      const updatedNotes = arrayMove(notes, oldIndex, newIndex);
      setNotes(updatedNotes);
    }
  };

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
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);

      if (selectedNoteId === id) {
        setSelectedNoteId(next[0]?.id ?? null);
      }

      return next;
    });

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <header className="shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-6 px-6 py-2">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded bg-primary/10">
                <StickyNote className="size-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  Notes
                </h1>
                <p className="text-sm text-muted-foreground">
                  {notes.length} {notes.length === 1 ? "note" : "notes"}
                </p>
              </div>
            </div>

            <AddNoteDialog onAdd={handleAdd} />
          </div>
        </header>

        {/* Main content */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border/50 bg-card/30">
            <div className="shrink-0 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  placeholder="Search notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 rounded border-border/50 bg-background pl-10 text-sm shadow-sm transition-all placeholder:text-muted-foreground/50 focus:border-primary/30 focus:shadow-md"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {isLoading ? (
                <div className="flex flex-col gap-2 p-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse rounded bg-secondary/50 p-4"
                    ></div>
                  ))}
                </div>
              ) : (
                <NotesList
                  notes={notes}
                  selectedNoteId={selectedNoteId}
                  onSelectNote={setSelectedNoteId}
                  searchQuery={search}
                  onDelete={handleDelete}
                  onReorder={setNotes}
                />
              )}
            </div>
          </aside>

          {/* Note Detail */}
          <main className="flex-1 overflow-hidden">
            {selectedNote && (
              <NoteDetail
                key={selectedNote.id}
                note={selectedNote}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onAttachmentUploaded={handleAttachmentUploaded}
                onAttachmentRemoved={handleAttachmentRemoved}
                onCommentAdded={handleCommentAdded}
                onCommentRemoved={handleCommentRemoved}
              />
            )}
          </main>
        </div>
      </div>
    </DndContext>
  );
}
