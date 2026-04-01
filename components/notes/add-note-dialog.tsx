"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./rich-text-editor";
import { NoteAttachments } from "./note-attachments";
import type { NoteColor, NoteAttachmentItem } from "@/actions/notes";

const colorOptions: { value: NoteColor; label: string; class: string }[] = [
  { value: "DEFAULT", label: "Slate", class: "bg-slate-400" },
  { value: "RED", label: "Red", class: "bg-red-400" },
  { value: "ORANGE", label: "Orange", class: "bg-orange-400" },
  { value: "YELLOW", label: "Amber", class: "bg-amber-400" },
  { value: "GREEN", label: "Green", class: "bg-emerald-400" },
  { value: "BLUE", label: "Blue", class: "bg-blue-400" },
  { value: "PURPLE", label: "Purple", class: "bg-violet-400" },
  { value: "PINK", label: "Pink", class: "bg-pink-400" },
];

interface AddNoteDialogProps {
  onAdd: (note: {
    title: string;
    content: string;
    color: NoteColor;
    pendingAttachments: Omit<NoteAttachmentItem, "id">[];
  }) => void;
}

export function AddNoteDialog({ onAdd }: AddNoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<NoteColor>("DEFAULT");
  const [pendingAttachments, setPendingAttachments] = useState<
    NoteAttachmentItem[]
  >([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim() && pendingAttachments.length === 0)
      return;
    onAdd({
      title,
      content,
      color,
      pendingAttachments: pendingAttachments.map(
        ({ id: _id, ...rest }) => rest,
      ),
    });
    setTitle("");
    setContent("");
    setColor("DEFAULT");
    setPendingAttachments([]);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="py-0 h-8 rounded">
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded border-border/50 bg-card p-0 overflow-hidden">
        <div
          className={cn(
            "h-1 w-full",
            colorOptions.find((c) => c.value === color)?.class ??
              "bg-slate-400",
          )}
        />

        <DialogHeader className="px-6">
          <DialogTitle className="text-xl font-semibold">
            Create Note
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Add a new note with a title, content, and color.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-6 pb-4">
          <div className="space-y-2">
            <Label
              htmlFor="note-title"
              className="text-sm font-medium text-foreground/80"
            >
              Title
            </Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter note title..."
              className="h-11 rounded border-border/50 bg-secondary/30 transition-all focus:bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground/80">
              Content
            </Label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Write your note..."
              minHeight="120px"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground/80">
              Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "group relative flex size-9 items-center justify-center rounded-full transition-all",
                    c.class,
                    color === c.value
                      ? "ring-2 ring-foreground/20 ring-offset-2 ring-offset-background scale-110"
                      : "hover:scale-105 hover:ring-2 hover:ring-foreground/10 hover:ring-offset-2 hover:ring-offset-background",
                  )}
                  title={c.label}
                >
                  {color === c.value && <Check className="size-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground/80">
              Attachments
            </Label>
            <NoteAttachments
              attachments={pendingAttachments}
              noteId={null}
              onUploaded={(a) => setPendingAttachments((prev) => [...prev, a])}
              onRemove={(id) =>
                setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
              }
            />
          </div> */}

          <Button
            type="submit"
            className="mt-2 h-11 rounded font-medium shadow-sm"
          >
            Create Note
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
