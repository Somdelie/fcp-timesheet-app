"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Pin, PinOff, Trash2, Pencil, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./rich-text-editor";
import { NoteAttachments } from "./note-attachments";
import type { NoteItem, NoteColor, NoteAttachmentItem } from "@/actions/notes";

const colorMap: Record<NoteColor, string> = {
  DEFAULT: "bg-card border-border/50",
  RED: "bg-red-500/10 border-red-500/30",
  ORANGE: "bg-orange-500/10 border-orange-500/30",
  YELLOW: "bg-yellow-500/10 border-yellow-500/30",
  GREEN: "bg-emerald-500/10 border-emerald-500/30",
  BLUE: "bg-blue-500/10 border-blue-500/30",
  PURPLE: "bg-purple-500/10 border-purple-500/30",
  PINK: "bg-pink-500/10 border-pink-500/30",
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
    <Card
      className={cn(
        "group transition-all duration-200 hover:shadow-md",
        colorMap[note.color],
        note.isPinned && "ring-1 ring-primary/30",
      )}
    >
      <CardContent className="p-4">
        {/* Actions */}
        <div className="flex items-center justify-end gap-1 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {editing ? (
            <>
              <button
                onClick={save}
                className="rounded p-1 text-emerald-500 hover:bg-emerald-500/10"
              >
                <Check className="size-3.5" />
              </button>
              <button
                onClick={cancel}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={note.isPinned ? "Unpin" : "Pin"}
              >
                {note.isPinned ? (
                  <PinOff className="size-3.5" />
                ) : (
                  <Pin className="size-3.5" />
                )}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Content */}
        {editing ? (
          <div className="space-y-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="bg-transparent border-border/50 text-sm font-semibold"
            />
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Write something..."
              minHeight="80px"
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
            className="cursor-pointer"
            onDoubleClick={() => setEditing(true)}
          >
            {note.title && (
              <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-2">
                {note.title}
              </h3>
            )}
            {note.content && note.content !== "<p></p>" ? (
              <div
                className="text-xs text-muted-foreground tiptap line-clamp-6"
                dangerouslySetInnerHTML={{ __html: note.content }}
                onClick={handleContentClick}
              />
            ) : (
              !note.title &&
              note.attachments.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  Empty note
                </p>
              )
            )}
            {note.attachments.length > 0 && (
              <div className="mt-2">
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
        <p className="text-[10px] text-muted-foreground/60 mt-3">
          {relativeTime}
        </p>

        {/* Inline image lightbox */}
        {lightboxUrl &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={() => setLightboxUrl(null)}
            >
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
              >
                <X className="size-5" />
              </button>
              <img
                src={lightboxUrl}
                alt="Full size"
                className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body,
          )}
      </CardContent>
    </Card>
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
