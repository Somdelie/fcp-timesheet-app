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

const COLOR_PALETTE: { key: NoteColor; hex: string; label: string }[] = [
  { key: "DEFAULT", hex: "#94a3b8", label: "Slate" },
  { key: "RED", hex: "#f87171", label: "Red" },
  { key: "ORANGE", hex: "#fb923c", label: "Orange" },
  { key: "YELLOW", hex: "#fbbf24", label: "Amber" },
  { key: "GREEN", hex: "#34d399", label: "Green" },
  { key: "BLUE", hex: "#60a5fa", label: "Blue" },
  { key: "PURPLE", hex: "#a78bfa", label: "Purple" },
  { key: "PINK", hex: "#f472b6", label: "Pink" },
];

const colorMeta: Record<NoteColor, { hex: string; tint: string }> = {
  DEFAULT: { hex: "#94a3b8", tint: "rgba(148,163,184,0.08)" },
  RED: { hex: "#f87171", tint: "rgba(239,68,68,0.07)" },
  ORANGE: { hex: "#fb923c", tint: "rgba(249,115,22,0.07)" },
  YELLOW: { hex: "#fbbf24", tint: "rgba(245,158,11,0.07)" },
  GREEN: { hex: "#34d399", tint: "rgba(16,185,129,0.07)" },
  BLUE: { hex: "#60a5fa", tint: "rgba(59,130,246,0.07)" },
  PURPLE: { hex: "#a78bfa", tint: "rgba(139,92,246,0.07)" },
  PINK: { hex: "#f472b6", tint: "rgba(236,72,153,0.07)" },
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

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "var(--color-background-primary)" }}
    >
      <div
        className="h-0.5 w-full shrink-0 transition-all duration-500"
        style={{ background: meta.hex, opacity: 0.7 }}
      />

      <div
        className="shrink-0 border-b px-6 py-4 transition-colors duration-300"
        style={{ borderColor: `${meta.hex}30`, background: meta.tint }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
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
                className="border-0 bg-transparent px-0 text-2xl font-bold shadow-none focus-visible:ring-0 h-auto py-0 leading-tight"
                style={{ fontFamily: "'Lora', Georgia, serif" }}
                autoFocus
              />
            ) : (
              <h1
                className="text-2xl font-bold text-foreground leading-tight truncate"
                style={{ fontFamily: "'Lora', Georgia, serif" }}
              >
                {title || "Untitled"}
              </h1>
            )}

            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: meta.hex }}
              />
              Updated {formatRelative(note.updatedAt)}
              {note.isPinned && (
                <span className="inline-flex items-center gap-0.5 text-muted-foreground/60">
                  · <Pin size={9} className="inline" /> pinned
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {editing ? (
              <>
                <ToolButton
                  onClick={() => void save()}
                  icon={<Check size={15} />}
                  label="Save"
                  accent="#10b981"
                  tint="rgba(16,185,129,0.1)"
                />
                <ToolButton
                  onClick={cancel}
                  icon={<X size={15} />}
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
                  onClick={() =>
                    void onUpdate(note.id, { isPinned: !note.isPinned })
                  }
                  icon={
                    note.isPinned ? <PinOff size={15} /> : <Pin size={15} />
                  }
                  label={note.isPinned ? "Unpin" : "Pin"}
                  accent={note.isPinned ? "#f59e0b" : undefined}
                />

                <ToolButton
                  onClick={() => setEditing(true)}
                  icon={<Pencil size={15} />}
                  label="Edit"
                />

                <ToolButton
                  onClick={handleDelete}
                  icon={<Trash2 size={15} />}
                  label={deleteConfirm ? "Confirm delete?" : "Delete"}
                  accent={deleteConfirm ? "#ef4444" : undefined}
                  tint={deleteConfirm ? "rgba(239,68,68,0.1)" : undefined}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 p-6 pb-10">
            {editing ? (
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Write your note…"
              />
            ) : (
              <div
                className="prose prose-sm dark:prose-invert max-w-none cursor-text note-content"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName === "IMG") {
                    setLightboxUrl((target as HTMLImageElement).src);
                  }
                }}
                dangerouslySetInnerHTML={{
                  __html:
                    content ||
                    "<p class='text-muted-foreground italic text-sm'>Empty note — click edit to add content.</p>",
                }}
              />
            )}

            <div
              className="mt-8 pt-6 border-t"
              style={{ borderColor: `${meta.hex}25` }}
            >
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-1.5">
                <Paperclip size={10} /> Attachments
              </h3>

              <NoteAttachments
                attachments={note.attachments}
                noteId={note.id}
                onRemove={(attachmentId) =>
                  void onAttachmentRemoved(note.id, attachmentId)
                }
                onUploaded={(attachment) =>
                  void onAttachmentUploaded(note.id, attachment)
                }
              />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col border-l shrink-0 transition-all duration-300",
            commentsOpen ? "w-72" : "w-10",
          )}
          style={{ borderColor: `${meta.hex}25` }}
        >
          <button
            onClick={() => setCommentsOpen(!commentsOpen)}
            className="flex items-center gap-2 border-b px-3 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full text-left shrink-0"
            style={{ borderColor: `${meta.hex}20` }}
          >
            <ChevronRight
              size={13}
              className={cn(
                "transition-transform shrink-0",
                commentsOpen && "rotate-180",
              )}
            />

            {commentsOpen && (
              <>
                <span className="flex-1">Comments</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: meta.tint, color: meta.hex }}
                >
                  {note.comments.length}
                </span>
              </>
            )}
          </button>

          {commentsOpen && (
            <>
              <div className="flex-1 overflow-y-auto comments-scroll">
                {note.comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 px-4 text-center">
                    <span className="text-xl opacity-20 select-none">💬</span>
                    <p className="text-xs text-muted-foreground/50">
                      No comments yet
                    </p>
                  </div>
                ) : (
                  <div className="p-3 flex flex-col gap-2">
                    {note.comments.map((comment) => (
                      <CommentCard
                        key={comment.id}
                        comment={comment}
                        accentHex={meta.hex}
                        onRemove={() => void onCommentRemoved(comment.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div
                className="border-t shrink-0 p-3"
                style={{ borderColor: `${meta.hex}20` }}
              >
                <div className="flex gap-2 items-center">
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
                    className="flex-1 text-xs bg-transparent border-b outline-none py-1.5 placeholder:text-muted-foreground/40 text-foreground transition-all"
                    style={{ borderColor: `${meta.hex}40` }}
                  />

                  <button
                    onClick={() => void handleAddComment()}
                    disabled={!commentText.trim() || submitting}
                    className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-all disabled:opacity-30"
                    style={{ background: meta.tint, color: meta.hex }}
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>

          <img
            src={lightboxUrl}
            alt="Attachment preview"
            className="max-h-full max-w-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&display=swap');
        .comments-scroll::-webkit-scrollbar { width: 2px; }
        .comments-scroll::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, currentColor 12%, transparent);
          border-radius: 99px;
        }
        .note-content p { margin-bottom: 0.75em; }
        .note-content p:last-child { margin-bottom: 0; }
      `}</style>
    </div>
  );
}

function ToolButton({
  onClick,
  icon,
  label,
  accent,
  tint,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  accent?: string;
  tint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex items-center justify-center w-8 h-8 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-secondary/60"
      style={
        accent
          ? { color: accent, background: tint ?? `${accent}12` }
          : undefined
      }
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

  const currentHex = colorMeta[current]?.hex ?? "#94a3b8";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Change color"
        className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:bg-secondary/60"
      >
        <span
          className="w-3.5 h-3.5 rounded-full border-2"
          style={{ background: currentHex, borderColor: `${currentHex}80` }}
        />
      </button>

      {open && (
        <div className="absolute top-10 right-0 z-20 flex flex-col gap-1 p-2 rounded-xl border bg-popover shadow-xl min-w-30">
          {COLOR_PALETTE.map(({ key, hex, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-colors hover:bg-secondary/60",
                current === key && "bg-secondary",
              )}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: hex }}
              />
              {label}
              {current === key && (
                <Check size={10} className="ml-auto opacity-60" />
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
  accentHex,
  onRemove,
}: {
  comment: NoteCommentItem;
  accentHex: string;
  onRemove: () => void;
}) {
  const initials = (comment.userName ?? "?")
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="group flex gap-2 items-start">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
        style={{
          background: `${accentHex}22`,
          color: accentHex,
        }}
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1 mb-0.5">
          <span className="text-[11px] font-semibold text-foreground/80 truncate">
            {comment.userName ?? "Unknown"}
          </span>

          <button
            type="button"
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"
          >
            <X size={10} />
          </button>
        </div>

        <p className="text-xs text-foreground/90 leading-relaxed break-words">
          {comment.content}
        </p>

        <p className="text-[10px] text-muted-foreground/50 mt-1">
          {formatRelative(comment.createdAt)}
        </p>
      </div>
    </div>
  );
}
