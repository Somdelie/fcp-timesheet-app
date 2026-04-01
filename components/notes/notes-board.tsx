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
  inviteUserToNote,
  removeUserFromNote,
  acceptNoteInvite,
  declineNoteInvite,
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
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "react-toastify";

export function NotesBoard() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(pointerSensor, keyboardSensor);

  const refreshNotes = async (preserveSelection = true) => {
    const refreshed = await getNotes();
    setNotes(refreshed);

    setSelectedNoteId((current) => {
      if (!refreshed.length) return null;

      if (!preserveSelection) {
        return refreshed[0]?.id ?? null;
      }

      const stillExists = refreshed.some((n) => n.id === current);
      return stillExists ? current : (refreshed[0]?.id ?? null);
    });

    return refreshed;
  };

  useEffect(() => {
    let mounted = true;

    startTransition(async () => {
      try {
        const data = await getNotes();
        if (!mounted) return;

        setNotes(data);
        setSelectedNoteId((current) => current ?? data[0]?.id ?? null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = notes.findIndex((note) => note.id === active.id);
    const newIndex = notes.findIndex((note) => note.id === over.id);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const updatedNotes = [...notes];
    const [moved] = updatedNotes.splice(oldIndex, 1);
    updatedNotes.splice(newIndex, 0, moved);

    setNotes(updatedNotes);
  };

  const handleAdd = (input: {
    title: string;
    content: string;
    color: NoteColor;
    pendingAttachments: Omit<NoteAttachmentItem, "id">[];
  }) => {
    startTransition(async () => {
      try {
        const created = await createNote(input);
        const savedAttachments: NoteAttachmentItem[] = [];

        for (const a of input.pendingAttachments) {
          const saved = await addNoteAttachment(created.id, a);
          savedAttachments.push(saved);
        }

        const createdNote: NoteItem = {
          ...created,
          attachments: savedAttachments,
        };

        setNotes((prev) => [createdNote, ...prev]);
        setSelectedNoteId(createdNote.id);
      } catch (error) {
        console.error(error);
        toast.error("Failed to create note.");
        await refreshNotes();
      }
    });
  };

  const handleInviteUser = (
    noteId: string,
    invitedUserId: string,
    role: "EDITOR" | "VIEWER" = "VIEWER",
  ) => {
    startTransition(async () => {
      try {
        await inviteUserToNote({ noteId, invitedUserId, role });
        await refreshNotes();
      } catch (error) {
        console.error(error);
        toast.error("Failed to invite collaborator.");
        await refreshNotes();
      }
    });
  };

  const handleRemoveUser = (noteId: string, userId: string) => {
    startTransition(async () => {
      try {
        await removeUserFromNote({ noteId, userId });
        await refreshNotes();
      } catch (error) {
        console.error(error);
        toast.error("Failed to remove collaborator.");
        await refreshNotes();
      }
    });
  };

  const handleAcceptInvite = (inviteId: string) => {
    startTransition(async () => {
      try {
        await acceptNoteInvite(inviteId);
        const refreshed = await refreshNotes();

        if (!refreshed.some((n) => n.myPendingInviteId === inviteId)) {
          toast.success("Invite accepted!");
        } else {
          toast.error("Failed to accept invite. Please try again.");
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to accept invite.");
        await refreshNotes();
      }
    });
  };

  const handleDeclineInvite = (inviteId: string) => {
    startTransition(async () => {
      try {
        await declineNoteInvite(inviteId);
        await refreshNotes();
        toast.success("Invite declined!");
      } catch (error) {
        console.error(error);
        toast.error("Failed to decline invite.");
        await refreshNotes();
      }
    });
  };

  const handleUpdate = (
    id: string,
    data: {
      title?: string;
      content?: string;
      isPinned?: boolean;
      color?: NoteColor;
      isRoomNote?: boolean;
    },
  ) => {
    startTransition(async () => {
      try {
        await updateNote(id, data);
        const refreshed = await refreshNotes();
        const updated = refreshed.find((n) => n.id === id);

        if (!updated) {
          toast.error("Updated note could not be found.");
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to update note.");
        await refreshNotes();
      }
    });
  };

  const handleDelete = (id: string) => {
    const previousNotes = notes;

    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);

      setSelectedNoteId((current) => {
        if (current !== id) return current;
        return next[0]?.id ?? null;
      });

      return next;
    });

    startTransition(async () => {
      try {
        await deleteNote(id);
      } catch (error) {
        console.error(error);
        toast.error("Failed to delete note.");
        setNotes(previousNotes);
        setSelectedNoteId((current) => current ?? previousNotes[0]?.id ?? null);
        await refreshNotes();
      }
    });
  };

  const handleAttachmentUploaded = (
    noteId: string,
    attachment: NoteAttachmentItem,
  ) => {
    startTransition(async () => {
      try {
        await addNoteAttachment(noteId, attachment);
        await refreshNotes();
      } catch (error) {
        console.error(error);
        toast.error("Failed to upload attachment.");
        await refreshNotes();
      }
    });
  };

  const handleAttachmentRemoved = (noteId: string, attachmentId: string) => {
    const previousNotes = notes;

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
      try {
        await removeNoteAttachment(attachmentId);
      } catch (error) {
        console.error(error);
        toast.error("Failed to remove attachment.");
        setNotes(previousNotes);
        await refreshNotes();
      }
    });
  };

  const handleCommentAdded = (noteId: string, content: string) => {
    startTransition(async () => {
      try {
        await addNoteComment(noteId, content);
        await refreshNotes();
      } catch (error) {
        console.error(error);
        toast.error("Failed to add comment.");
        await refreshNotes();
      }
    });
  };

  const handleCommentRemoved = (commentId: string) => {
    const previousNotes = notes;

    setNotes((prev) =>
      prev.map((n) => ({
        ...n,
        comments: n.comments.filter((c) => c.id !== commentId),
      })),
    );

    startTransition(async () => {
      try {
        await removeNoteComment(commentId);
      } catch (error) {
        console.error(error);
        toast.error("Failed to remove comment.");
        setNotes(previousNotes);
        await refreshNotes();
      }
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
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border/50 bg-card">
            <div className="shrink-0 flex items-center justify-between gap-2 p-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  placeholder="Search notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 rounded border-border/50 bg-background pl-10 text-sm shadow-sm transition-all placeholder:text-muted-foreground/50 focus:border-primary/30 focus:shadow-md"
                />
              </div>
              <AddNoteDialog onAdd={handleAdd} />
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {isLoading ? (
                <div className="flex flex-col gap-2 p-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse rounded bg-secondary/50 p-4"
                    />
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

          <main className="flex-1 overflow-hidden">
            {selectedNote ? (
              <NoteDetail
                key={selectedNote.id}
                note={selectedNote}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onAttachmentUploaded={handleAttachmentUploaded}
                onAttachmentRemoved={handleAttachmentRemoved}
                onCommentAdded={handleCommentAdded}
                onCommentRemoved={handleCommentRemoved}
                onInviteUser={handleInviteUser}
                onRemoveUser={handleRemoveUser}
                onAcceptInvite={handleAcceptInvite}
                onDeclineInvite={handleDeclineInvite}
                isPending={isPending}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No note selected
              </div>
            )}
          </main>
        </div>
      </div>
    </DndContext>
  );
}
