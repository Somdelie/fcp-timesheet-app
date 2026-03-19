"use client";

import { cn } from "@/lib/utils";
import type { NoteItem, NoteColor } from "@/actions/notes";
import { formatRelative } from "./format-relative";
import { Pin, MessageSquare, Paperclip, GripVertical } from "lucide-react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface NotesListProps {
  notes: NoteItem[];
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  searchQuery: string;
  onDelete?: (noteId: string) => void;
  onReorder?: (notes: NoteItem[]) => void;
}

const colorAccents: Record<
  NoteColor,
  { dot: string; bg: string; activeBg: string }
> = {
  DEFAULT: {
    dot: "bg-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/20",
    activeBg: "bg-slate-100 dark:bg-slate-800/30",
  },
  RED: {
    dot: "bg-red-400",
    bg: "bg-red-50 dark:bg-red-950/20",
    activeBg: "bg-red-100 dark:bg-red-900/30",
  },
  ORANGE: {
    dot: "bg-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    activeBg: "bg-orange-100 dark:bg-orange-900/30",
  },
  YELLOW: {
    dot: "bg-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    activeBg: "bg-amber-100 dark:bg-amber-900/30",
  },
  GREEN: {
    dot: "bg-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    activeBg: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  BLUE: {
    dot: "bg-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    activeBg: "bg-blue-100 dark:bg-blue-900/30",
  },
  PURPLE: {
    dot: "bg-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/20",
    activeBg: "bg-violet-100 dark:bg-violet-900/30",
  },
  PINK: {
    dot: "bg-pink-400",
    bg: "bg-pink-50 dark:bg-pink-950/20",
    activeBg: "bg-pink-100 dark:bg-pink-900/30",
  },
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
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto overflow-x-hidden">
      {pinned.length > 0 && (
        <section className="px-3 pt-2">
          <SectionLabel icon={<Pin size={10} />} label="Pinned" />
          <SortableContext
            items={pinned.map((n) => n.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1">
              {pinned.map((note, i) => (
                <SortableNoteListItem
                  key={note.id}
                  note={note}
                  isSelected={selectedNoteId === note.id}
                  onSelect={() => onSelectNote(note.id)}
                  animDelay={i * 30}
                />
              ))}
            </div>
          </SortableContext>
        </section>
      )}

      {unpinned.length > 0 && (
        <section className="px-3 pt-2 pb-4">
          {pinned.length > 0 && (
            <SectionLabel label="All Notes" className="mt-4" />
          )}
          <SortableContext
            items={unpinned.map((n) => n.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1">
              {unpinned.map((note, i) => (
                <SortableNoteListItem
                  key={note.id}
                  note={note}
                  isSelected={selectedNoteId === note.id}
                  onSelect={() => onSelectNote(note.id)}
                  animDelay={i * 30}
                />
              ))}
            </div>
          </SortableContext>
        </section>
      )}

      {isEmpty && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded bg-secondary/50">
            <span className="text-xl text-muted-foreground/30">📝</span>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              No notes found
            </p>
            {searchQuery && (
              <p className="mt-1 text-xs text-muted-foreground/60">
                Try a different search term
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
        "flex items-center gap-1.5 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50",
        className,
      )}
    >
      {icon}
      {label}
    </div>
  );
}

interface NoteListItemProps {
  note: NoteItem;
  isSelected: boolean;
  onSelect: () => void;
  animDelay?: number;
}

function SortableNoteListItem(props: NoteListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-50 opacity-90")}
    >
      <NoteListItem
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

interface NoteListItemInternalProps extends NoteListItemProps {
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
}

function NoteListItem({
  note,
  isSelected,
  onSelect,
  animDelay = 0,
  dragHandleProps,
  isDragging,
}: NoteListItemInternalProps) {
  const accent = colorAccents[note.color] ?? colorAccents.DEFAULT;
  const plainContent = note.content.replace(/<[^>]*>/g, "").trim();
  const preview = plainContent.substring(0, 80);

  return (
    <div
      className={cn(
        "group relative flex w-full items-stretch rounded transition-all duration-200",
        "hover:bg-secondary/60",
        isSelected ? accent.activeBg : "bg-transparent",
        isDragging && "shadow-lg ring-2 ring-primary/20",
        "animate-in fade-in slide-in-from-left-2",
      )}
      style={{ animationDelay: `${animDelay}ms`, animationFillMode: "both" }}
    >
      {/* Drag handle */}
      <button
        {...dragHandleProps}
        className={cn(
          "flex shrink-0 cursor-grab items-center justify-center px-1.5 text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing",
          "opacity-0 group-hover:opacity-100",
          isSelected && "opacity-100",
        )}
        tabIndex={-1}
      >
        <GripVertical size={14} />
      </button>

      <button
        onClick={onSelect}
        className="min-w-0 flex-1 overflow-hidden px-2 py-3 text-left"
      >
        {/* Color indicator */}
        <div
          className={cn(
            "absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full transition-all",
            accent.dot,
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-50",
          )}
        />

        <div className="flex min-w-0 items-start gap-3">
          {/* Color dot */}
          <div
            className={cn("mt-1.5 size-2 shrink-0 rounded-full", accent.dot)}
          />

          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h4
                className={cn(
                  "min-w-0 flex-1 truncate text-sm font-medium leading-snug transition-colors",
                  isSelected ? "text-foreground" : "text-foreground/80",
                )}
              >
                {note.title || "Untitled"}
              </h4>
              {note.isPinned && (
                <Pin size={11} className="shrink-0 text-amber-500/70" />
              )}
            </div>

            {/* Preview */}
            {preview && (
              <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground/70">
                {preview}
                {plainContent.length > 80 && "…"}
              </p>
            )}

            {/* Meta row */}
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground/50">
                {formatRelative(note.updatedAt)}
              </span>

              {note.comments.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                  <MessageSquare size={10} />
                  {note.comments.length}
                </span>
              )}

              {note.attachments?.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                  <Paperclip size={10} />
                  {note.attachments.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
