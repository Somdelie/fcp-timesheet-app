"use client";

import { useState, useRef, useEffect } from "react";
import {
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Check,
  X,
  Send,
  Paperclip,
  ChevronRight,
  Share2,
  Palette,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./rich-text-editor";
import { NoteAttachments } from "./note-attachments";
import { formatRelative } from "./format-relative";
import type {
  NoteItem,
  NoteColor,
  NoteAttachmentItem,
  NoteCommentItem,
} from "@/actions/notes";

const COLOR_PALETTE: { key: NoteColor; label: string; class: string }[] = [
  { key: "DEFAULT", label: "Slate", class: "bg-slate-400" },
  { key: "RED", label: "Red", class: "bg-red-400" },
  { key: "ORANGE", label: "Orange", class: "bg-orange-400" },
  { key: "YELLOW", label: "Amber", class: "bg-amber-400" },
  { key: "GREEN", label: "Green", class: "bg-emerald-400" },
  { key: "BLUE", label: "Blue", class: "bg-blue-400" },
  { key: "PURPLE", label: "Purple", class: "bg-violet-400" },
  { key: "PINK", label: "Pink", class: "bg-pink-400" },
];

const colorMeta: Record<NoteColor, { class: string; tint: string }> = {
  DEFAULT: { class: "bg-slate-400", tint: "bg-slate-50 dark:bg-slate-900/20" },
  RED: { class: "bg-red-400", tint: "bg-red-50 dark:bg-red-950/20" },
  ORANGE: {
    class: "bg-orange-400",
    tint: "bg-orange-50 dark:bg-orange-950/20",
  },
  YELLOW: { class: "bg-amber-400", tint: "bg-amber-50 dark:bg-amber-950/20" },
  GREEN: {
    class: "bg-emerald-400",
    tint: "bg-emerald-50 dark:bg-emerald-950/20",
  },
  BLUE: { class: "bg-blue-400", tint: "bg-blue-50 dark:bg-blue-950/20" },
  PURPLE: {
    class: "bg-violet-400",
    tint: "bg-violet-50 dark:bg-violet-950/20",
  },
  PINK: { class: "bg-pink-400", tint: "bg-pink-50 dark:bg-pink-950/20" },
};

interface NoteDetailProps {
  note: NoteItem;
  onUpdate: (
    id: string,
    data: {
      title?: string;
      content?: string;
      isPinned?: boolean;
      color?: NoteColor;
    },
  ) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onAttachmentUploaded: (
    noteId: string,
    attachment: NoteAttachmentItem,
  ) => void | Promise<void>;
  onAttachmentRemoved: (
    noteId: string,
    attachmentId: string,
  ) => void | Promise<void>;
  onCommentAdded: (noteId: string, content: string) => void | Promise<void>;
  onCommentRemoved: (commentId: string) => void | Promise<void>;
}

export function NoteDetail({
  note,
  onUpdate,
  onDelete,
  onAttachmentUploaded,
  onAttachmentRemoved,
  onCommentAdded,
  onCommentRemoved,
}: NoteDetailProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const meta = colorMeta[note.color] ?? colorMeta.DEFAULT;

  useEffect(() => {
    if (!editing) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note.id, note.title, note.content, editing]);

  const save = async () => {
    await onUpdate(note.id, { title, content });
    setEditing(false);
  };

  const cancel = () => {
    setTitle(note.title);
    setContent(note.content);
    setEditing(false);
  };

  const handleAddComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await onCommentAdded(note.id, trimmed);
      setCommentText("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      void onDelete(note.id);
    } else {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
    }
  };

  const handleShare = async () => {
    const shareText = `${note.title || "Untitled"}\n\n${
      note.content.replace(/<[^>]*>/g, "").trim() || "No content"
    }`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: note.title || "Untitled",
          text: shareText,
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
    } catch {
      // ignore cancelled share / clipboard errors
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Color bar */}
      <div className={cn("h-1 w-full shrink-0", meta.class)} />

      {/* Header */}
      <div
        className={cn(
          "shrink-0 border-b border-border/40 px-8 py-4",
          meta.tint,
        )}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            {editing ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void save();
                  }
                  if (e.key === "Escape") cancel();
                }}
                placeholder="Note title…"
                className="h-auto border-0 bg-transparent px-0 py-0 text-2xl font-bold leading-tight shadow-none focus-visible:ring-0"
                autoFocus
              />
            ) : (
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
                {title || "Untitled"}
              </h1>
            )}

            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <div className={cn("size-2 rounded-full", meta.class)} />
              <span>Updated {formatRelative(note.updatedAt)}</span>
              {note.isPinned && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Pin size={10} />
                  Pinned
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {editing ? (
              <>
                <ToolButton
                  onClick={() => void save()}
                  icon={<Check size={16} />}
                  label="Save"
                  variant="success"
                />
                <ToolButton
                  onClick={cancel}
                  icon={<X size={16} />}
                  label="Cancel"
                />
              </>
            ) : (
              <>
                <ColorPicker
                  current={note.color}
                  onChange={(color) => void onUpdate(note.id, { color })}
                />
                <ToolButton
                  onClick={handleShare}
                  icon={<Share2 size={16} />}
                  label="Share"
                />
                <ToolButton
                  onClick={() =>
                    void onUpdate(note.id, { isPinned: !note.isPinned })
                  }
                  icon={
                    note.isPinned ? <PinOff size={16} /> : <Pin size={16} />
                  }
                  label={note.isPinned ? "Unpin" : "Pin"}
                  active={note.isPinned}
                />
                <ToolButton
                  onClick={() => setEditing(true)}
                  icon={<Pencil size={16} />}
                  label="Edit"
                />
                <ToolButton
                  onClick={handleDelete}
                  icon={<Trash2 size={16} />}
                  label={deleteConfirm ? "Click to confirm" : "Delete"}
                  variant={deleteConfirm ? "danger" : undefined}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main content */}
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex-1 p-8 pb-12">
            {editing ? (
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Write your note…"
              />
            ) : (
              <div
                className="note-content prose prose-sm max-w-none cursor-text text-foreground/90 dark:prose-invert"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName === "IMG") {
                    setLightboxUrl((target as HTMLImageElement).src);
                  }
                }}
                dangerouslySetInnerHTML={{
                  __html:
                    content ||
                    "<p class='text-muted-foreground/60 italic'>Empty note — click edit to add content.</p>",
                }}
              />
            )}
          </div>
        </div>

        {/* Comments sidebar */}
        <div
          className={cn(
            "flex h-full min-h-0 shrink-0 flex-col border-l border-border/40 bg-card/30 transition-all duration-300",
            commentsOpen ? "w-80" : "w-12",
          )}
        >
          <button
            onClick={() => setCommentsOpen(!commentsOpen)}
            className="flex w-full shrink-0 items-center gap-2 border-b border-border/40 px-4 py-4 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight
              size={14}
              className={cn(
                "shrink-0 transition-transform duration-200",
                commentsOpen && "rotate-180",
              )}
            />

            {commentsOpen && (
              <>
                <span className="flex-1">Comments</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {note.comments.length}
                </span>
              </>
            )}
          </button>

          {commentsOpen && (
            <>
              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
                {note.comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-secondary/50">
                      <span className="text-lg text-muted-foreground/30">
                        💬
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground/50">
                      No comments yet
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 p-4">
                    {note.comments.map((comment) => (
                      <CommentCard
                        key={comment.id}
                        comment={comment}
                        colorClass={meta.class}
                        onRemove={() => void onCommentRemoved(comment.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Comment input */}
              <div className="shrink-0 border-t border-border/40 p-4">
                <div className="flex items-center gap-2">
                  <input
                    ref={commentInputRef}
                    type="text"
                    placeholder="Add a comment…"
                    value={commentText}
                    disabled={submitting}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleAddComment();
                      }
                    }}
                    className="flex-1 rounded border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />

                  <button
                    onClick={() => void handleAddComment()}
                    disabled={!commentText.trim() || submitting}
                    className="flex size-9 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground transition-all disabled:opacity-40 hover:bg-primary/90"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-8 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-6 top-6 flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={18} />
          </button>

          <img
            src={lightboxUrl}
            alt="Attachment preview"
            className="max-h-full max-w-full rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function ToolButton({
  onClick,
  icon,
  label,
  variant,
  active,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: "success" | "danger";
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded text-muted-foreground transition-all hover:bg-secondary hover:text-foreground",
        variant === "success" &&
          "bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
        variant === "danger" &&
          "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400",
        active && "text-amber-600 dark:text-amber-400",
      )}
    >
      {icon}
    </button>
  );
}

function ColorPicker({
  current,
  onChange,
}: {
  current: NoteColor;
  onChange: (c: NoteColor) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentMeta = colorMeta[current] ?? colorMeta.DEFAULT;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Change color"
        className="flex size-9 items-center justify-center rounded transition-all hover:bg-secondary"
      >
        <Palette size={16} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 flex min-w-36 flex-col gap-1 rounded border border-border/60 bg-popover p-2 shadow-xl animate-in fade-in zoom-in-95">
          {COLOR_PALETTE.map(({ key, label, class: colorClass }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2.5 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
                current === key && "bg-secondary",
              )}
            >
              <div className={cn("size-3 rounded-full", colorClass)} />
              <span className="text-foreground/80">{label}</span>
              {current === key && (
                <Check size={12} className="ml-auto text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentCard({
  comment,
  colorClass,
  onRemove,
}: {
  comment: NoteCommentItem;
  colorClass: string;
  onRemove: () => void;
}) {
  const initials = (comment.userName ?? "?")
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="group flex items-start gap-3 rounded bg-secondary/30 p-3 transition-colors hover:bg-secondary/50">
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
          colorClass,
        )}
      >
        {initials}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {comment.userName ?? "Unknown"}
          </span>

          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-muted-foreground/50 opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
          >
            <X size={12} />
          </button>
        </div>

        <p className="mt-1 text-sm leading-relaxed text-foreground/80">
          {comment.content}
        </p>

        <p className="mt-2 text-[10px] text-muted-foreground/50">
          {formatRelative(comment.createdAt)}
        </p>
      </div>
    </div>
  );
}
