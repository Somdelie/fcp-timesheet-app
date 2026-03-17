"use client";

import { cn } from "@/lib/utils";
import type { NoteItem } from "@/actions/notes";
import { formatRelative } from "./format-relative";
import { Pin, MessageSquare, Paperclip } from "lucide-react";

interface NotesListProps {
  notes: NoteItem[];
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  searchQuery: string;
}

// Color accent map — left-border stripe & dot tint
const colorAccents: Record<
  string,
  { border: string; dot: string; bg: string }
> = {
  DEFAULT: { border: "#94a3b8", dot: "#94a3b8", bg: "transparent" },
  RED: { border: "#f87171", dot: "#ef4444", bg: "rgba(239,68,68,0.04)" },
  ORANGE: { border: "#fb923c", dot: "#f97316", bg: "rgba(249,115,22,0.04)" },
  YELLOW: { border: "#fbbf24", dot: "#f59e0b", bg: "rgba(245,158,11,0.04)" },
  GREEN: { border: "#34d399", dot: "#10b981", bg: "rgba(16,185,129,0.04)" },
  BLUE: { border: "#60a5fa", dot: "#3b82f6", bg: "rgba(59,130,246,0.04)" },
  PURPLE: { border: "#a78bfa", dot: "#8b5cf6", bg: "rgba(139,92,246,0.04)" },
  PINK: { border: "#f472b6", dot: "#ec4899", bg: "rgba(236,72,153,0.04)" },
};

export function NotesList({
  notes,
  selectedNoteId,
  onSelectNote,
  searchQuery,
}: NotesListProps) {
  const filterNotes = (subset: NoteItem[]) => {
    if (!searchQuery) return subset;
    const q = searchQuery.toLowerCase();
    return subset.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content
          .replace(/<[^>]*>/g, "")
          .toLowerCase()
          .includes(q),
    );
  };

  const pinned = filterNotes(notes.filter((n) => n.isPinned));
  const unpinned = filterNotes(notes.filter((n) => !n.isPinned));
  const isEmpty = pinned.length === 0 && unpinned.length === 0;

  return (
    <div className="flex flex-col overflow-y-auto flex-1 py-2 notes-list-scroll">
      <style>{`
        .notes-list-scroll::-webkit-scrollbar { width: 3px; }
        .notes-list-scroll::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, currentColor 15%, transparent);
          border-radius: 99px;
        }
        @keyframes noteSlideIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .note-item-enter {
          animation: noteSlideIn 0.18s ease both;
        }
        .note-item-btn {
          position: relative;
          display: block;
          width: 100%;
          text-align: left;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background 0.12s;
        }
        .note-item-btn::before {
          content: '';
          position: absolute;
          left: 0; top: 6px; bottom: 6px;
          width: 2.5px;
          border-radius: 0 2px 2px 0;
          background: var(--accent-color, transparent);
          opacity: 0;
          transition: opacity 0.15s;
        }
        .note-item-btn:hover::before,
        .note-item-btn.is-selected::before {
          opacity: 1;
        }
        .note-item-btn:hover,
        .note-item-btn.is-selected {
          background: var(--accent-bg, rgba(0,0,0,0.04));
        }
        .note-item-btn.is-selected .note-title {
          color: var(--accent-dot, inherit);
        }
        .note-meta-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 10px;
          padding: 1px 5px;
          border-radius: 4px;
          background: color-mix(in srgb, currentColor 8%, transparent);
          color: inherit;
          opacity: 0.65;
        }
      `}</style>

      {/* Pinned section */}
      {pinned.length > 0 && (
        <section className="px-3 mb-1">
          <SectionLabel
            icon={<Pin size={9} className="opacity-50" />}
            label="Pinned"
          />
          <div className="flex flex-col gap-0.5">
            {pinned.map((note, i) => (
              <NoteListItem
                key={note.id}
                note={note}
                isSelected={selectedNoteId === note.id}
                onSelect={() => onSelectNote(note.id)}
                animDelay={i * 30}
              />
            ))}
          </div>
        </section>
      )}

      {/* Unpinned section */}
      {unpinned.length > 0 && (
        <section className="px-3">
          {pinned.length > 0 && <SectionLabel label="Notes" className="mt-3" />}
          <div className="flex flex-col gap-0.5">
            {unpinned.map((note, i) => (
              <NoteListItem
                key={note.id}
                note={note}
                isSelected={selectedNoteId === note.id}
                onSelect={() => onSelectNote(note.id)}
                animDelay={i * 30}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 px-6 text-center">
          <span className="text-2xl opacity-20 select-none">✎</span>
          <p className="text-sm font-medium text-muted-foreground">
            No notes found
          </p>
          {searchQuery && (
            <p className="text-xs text-muted-foreground opacity-60">
              Try a different search term
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Section label ─────────────────────────────────────────── */
function SectionLabel({
  label,
  icon,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-1 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none",
        className,
      )}
    >
      {icon}
      {label}
    </div>
  );
}

/* ── Single note item ──────────────────────────────────────── */
interface NoteListItemProps {
  note: NoteItem;
  isSelected: boolean;
  onSelect: () => void;
  animDelay?: number;
}

function NoteListItem({
  note,
  isSelected,
  onSelect,
  animDelay = 0,
}: NoteListItemProps) {
  const accent = colorAccents[note.color] ?? colorAccents.DEFAULT;
  const plainContent = note.content.replace(/<[^>]*>/g, "").trim();
  const preview = plainContent.substring(0, 72);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "note-item-btn note-item-enter rounded-lg px-3 py-2.5",
        isSelected && "is-selected",
      )}
      style={
        {
          "--accent-color": accent.border,
          "--accent-dot": accent.dot,
          "--accent-bg": isSelected ? accent.bg : undefined,
          animationDelay: `${animDelay}ms`,
        } as React.CSSProperties
      }
    >
      {/* Title row */}
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <h4
          className={cn(
            "note-title text-sm font-semibold truncate leading-snug transition-colors",
            isSelected ? "text-foreground" : "text-foreground/80",
          )}
        >
          {/* Color dot */}
          <span
            className="inline-block w-1.5 h-1.5 rounded-full mr-2 shrink-0 align-middle"
            style={{ background: accent.dot, marginBottom: "1px" }}
          />
          {note.title || "Untitled"}
        </h4>
        {note.isPinned && <Pin size={10} className="shrink-0 opacity-40" />}
      </div>

      {/* Preview */}
      {preview && (
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 pl-3.5 mb-1.5">
          {preview}
          {plainContent.length > 72 && "…"}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 pl-3.5">
        <span className="text-[10px] text-muted-foreground/50">
          {formatRelative(note.updatedAt)}
        </span>
        {note.comments.length > 0 && (
          <span className="note-meta-badge" style={{ color: accent.dot }}>
            <MessageSquare size={9} />
            {note.comments.length}
          </span>
        )}
        {note.attachments?.length > 0 && (
          <span className="note-meta-badge" style={{ color: accent.dot }}>
            <Paperclip size={9} />
            {note.attachments.length}
          </span>
        )}
      </div>
    </button>
  );
}
