"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Pin, PinOff, Trash2, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./rich-text-editor";
import { NoteAttachments } from "./note-attachments";
import type { NoteItem, NoteColor, NoteAttachmentItem } from "@/actions/notes";

const colorStyles: Record<
  NoteColor,
  { card: string; border: string; accent: string }
> = {
  DEFAULT: {
    card: "bg-card",
    border: "border-border/40",
    accent: "bg-secondary/50",
  },
  RED: {
    card: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200/60 dark:border-red-800/40",
    accent: "bg-red-100 dark:bg-red-900/40",
  },
  ORANGE: {
    card: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200/60 dark:border-orange-800/40",
    accent: "bg-orange-100 dark:bg-orange-900/40",
  },
  YELLOW: {
    card: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200/60 dark:border-amber-800/40",
    accent: "bg-amber-100 dark:bg-amber-900/40",
  },
  GREEN: {
    card: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200/60 dark:border-emerald-800/40",
    accent: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  BLUE: {
    card: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-200/60 dark:border-sky-800/40",
    accent: "bg-sky-100 dark:bg-sky-900/40",
  },
  PURPLE: {
    card: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-200/60 dark:border-violet-800/40",
    accent: "bg-violet-100 dark:bg-violet-900/40",
  },
  PINK: {
    card: "bg-pink-50 dark:bg-pink-950/30",
    border: "border-pink-200/60 dark:border-pink-800/40",
    accent: "bg-pink-100 dark:bg-pink-900/40",
  },
};

interface NoteCardProps {
  note: NoteItem;
  onUpdate: (
    id: string,
    data: { title?: string; content?: string; isPinned?: boolean },
  ) => void;
  onDelete: (id: string) => void;
  onAttachmentUploaded: (
    noteId: string,
    attachment: NoteAttachmentItem,
  ) => void;
  onAttachmentRemoved: (noteId: string, attachmentId: string) => void;
}

export function NoteCard({
  note,
  onUpdate,
  onDelete,
  onAttachmentUploaded,
  onAttachmentRemoved,
}: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const colors = colorStyles[note.color];

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      e.stopPropagation();
      setLightboxUrl((target as HTMLImageElement).src);
    }
  };

  const save = () => {
    onUpdate(note.id, { title, content });
    setEditing(false);
  };

  const cancel = () => {
    setTitle(note.title);
    setContent(note.content);
    setEditing(false);
  };

  const relativeTime = formatRelative(note.updatedAt);

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border shadow-sm transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5",
        colors.card,
        colors.border,
        note.isPinned && "ring-2 ring-amber-400/50 dark:ring-amber-500/40",
      )}
    >
      {/* Pin indicator */}
      {note.isPinned && (
        <div className="absolute -top-1.5 -right-1.5 z-10">
          <div className="flex size-6 items-center justify-center rounded-full bg-amber-400 shadow-sm dark:bg-amber-500">
            <Pin className="size-3 text-white" />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Actions */}
        <div
          className={cn(
            "mb-3 flex items-center justify-end gap-1 transition-opacity duration-150",
            editing ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {editing ? (
            <>
              <button
                onClick={save}
                className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                aria-label="Save changes"
              >
                <Check className="size-4" />
              </button>
              <button
                onClick={cancel}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Cancel editing"
              >
                <X className="size-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors",
                  note.isPinned
                    ? "text-amber-500 hover:bg-amber-500/10"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
                title={note.isPinned ? "Unpin" : "Pin"}
                aria-label={note.isPinned ? "Unpin note" : "Pin note"}
              >
                {note.isPinned ? (
                  <PinOff className="size-4" />
                ) : (
                  <Pin className="size-4" />
                )}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Edit note"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                aria-label="Delete note"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>

        {/* Content */}
        {editing ? (
          <div className="flex flex-col gap-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className={cn(
                "border-0 bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0",
                "placeholder:text-muted-foreground/50",
              )}
            />
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Write something..."
              minHeight="100px"
            />
            <NoteAttachments
              attachments={note.attachments}
              noteId={note.id}
              onUploaded={(a) => onAttachmentUploaded(note.id, a)}
              onRemove={(aId) => onAttachmentRemoved(note.id, aId)}
            />
          </div>
        ) : (
          <div
            className="flex flex-1 cursor-pointer flex-col"
            onDoubleClick={() => setEditing(true)}
          >
            {note.title && (
              <h3 className="mb-2 text-base font-semibold leading-snug text-foreground line-clamp-2">
                {note.title}
              </h3>
            )}
            {note.content && note.content !== "<p></p>" ? (
              <div
                className="tiptap flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-6"
                dangerouslySetInnerHTML={{ __html: note.content }}
                onClick={handleContentClick}
              />
            ) : (
              !note.title &&
              note.attachments.length === 0 && (
                <p className="flex-1 text-sm italic text-muted-foreground/60">
                  Empty note - double click to edit
                </p>
              )
            )}
            {note.attachments.length > 0 && (
              <div className="mt-3">
                <NoteAttachments
                  attachments={note.attachments}
                  noteId={note.id}
                  onUploaded={() => {}}
                  onRemove={() => {}}
                  editable={false}
                />
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={cn(
            "mt-4 rounded-lg px-2.5 py-1.5 text-center",
            colors.accent,
          )}
        >
          <time className="text-xs font-medium text-muted-foreground">
            {relativeTime}
          </time>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setLightboxUrl(null)}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Close lightbox"
            >
              <X className="size-5" />
            </button>
            <img
              src={lightboxUrl}
              alt="Full size preview"
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </article>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
