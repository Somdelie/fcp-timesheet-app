"use client";

import { useState, useRef } from "react";
import {
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  File,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteAttachmentItem } from "@/actions/notes";

interface NoteAttachmentsProps {
  attachments: NoteAttachmentItem[];
  noteId: string | null;
  onUploaded: (attachment: NoteAttachmentItem) => void;
  onRemove: (attachmentId: string) => void;
  editable?: boolean;
}

export function NoteAttachments({
  attachments,
  noteId,
  onUploaded,
  onRemove,
  editable = true,
}: NoteAttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/uploads/note-file", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();

        onUploaded({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          url: data.url,
          size: file.size,
          publicId: data.publicId, // Added missing property
          mimeType: data.mimeType, // Added missing property
        });
      } catch {
        // Silent fail - user can retry
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="size-4" />;
    if (type.includes("pdf") || type.includes("document"))
      return <FileText className="size-4" />;
    return <File className="size-4" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* Attachments grid */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className={cn(
                "group relative flex items-center gap-2 rounded border border-border/60 bg-secondary/30 p-2.5 transition-all hover:bg-secondary/50",
                attachment.type.startsWith("image/") && "col-span-1",
              )}
            >
              {attachment.type.startsWith("image/") ? (
                <div className="relative aspect-square w-full overflow-hidden rounded">
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="h-full w-full object-cover"
                  />
                  {editable && (
                    <button
                      onClick={() => onRemove(attachment.id)}
                      className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-all hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
                    {getFileIcon(attachment.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {attachment.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatSize(attachment.size)}
                    </p>
                  </div>
                  {editable && (
                    <button
                      onClick={() => onRemove(attachment.id)}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {editable && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleUpload(e.dataTransfer.files);
          }}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-border/60 bg-secondary/20 px-4 py-6 transition-all hover:border-primary/30 hover:bg-secondary/40",
            dragOver && "border-primary/50 bg-primary/5",
            uploading && "pointer-events-none opacity-60",
          )}
          onClick={() => inputRef.current?.click()}
        >
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors",
              dragOver && "bg-primary/10 text-primary",
            )}
          >
            {uploading ? (
              <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            ) : (
              <Upload className="size-4" />
            )}
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-foreground">
              {uploading
                ? "Uploading..."
                : "Drop files here or click to upload"}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Images, documents, and more
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      )}
    </div>
  );
}
