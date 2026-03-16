"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

const colorOptions: { value: NoteColor; label: string; bg: string }[] = [
  { value: "DEFAULT", label: "Default", bg: "bg-card" },
  { value: "RED", label: "Red", bg: "bg-red-500/20" },
  { value: "ORANGE", label: "Orange", bg: "bg-orange-500/20" },
  { value: "YELLOW", label: "Yellow", bg: "bg-yellow-500/20" },
  { value: "GREEN", label: "Green", bg: "bg-emerald-500/20" },
  { value: "BLUE", label: "Blue", bg: "bg-blue-500/20" },
  { value: "PURPLE", label: "Purple", bg: "bg-purple-500/20" },
  { value: "PINK", label: "Pink", bg: "bg-pink-500/20" },
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
        <Button className="gap-2">
          <Plus className="size-4" />
          New Note
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Create Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              className="bg-input border-border"
            />
          </div>
          <div className="grid gap-2">
            <Label>Content</Label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Write your note..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "size-7 rounded-full border-2 transition-all",
                    c.bg,
                    color === c.value
                      ? "border-primary scale-110"
                      : "border-transparent hover:border-muted-foreground/40",
                  )}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Attachments</Label>
            <NoteAttachments
              attachments={pendingAttachments}
              noteId={null}
              onUploaded={(a) => setPendingAttachments((prev) => [...prev, a])}
              onRemove={(id) =>
                setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
              }
            />
          </div>
          <Button type="submit" className="mt-2">
            Create Note
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
