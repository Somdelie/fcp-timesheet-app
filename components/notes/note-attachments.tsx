"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Paperclip,
  FileText,
  FileSpreadsheet,
  File,
  X,
  Upload,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteAttachmentItem } from "@/actions/notes";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  switch (type) {
    case "pdf":
      return <FileText className="size-4 text-red-400" />;
    case "excel":
      return <FileSpreadsheet className="size-4 text-emerald-400" />;
    case "word":
      return <FileText className="size-4 text-blue-400" />;
    default:
      return <File className="size-4 text-muted-foreground" />;
  }
}

interface NoteAttachmentsProps {
  attachments: NoteAttachmentItem[];
  noteId: string | null; // null = note hasn't been created yet
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploads/note-file", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      onUploaded({
        id: data.publicId, // temporary id - will be replaced after server action
        url: data.url,
        publicId: data.publicId,
        name: data.name,
        type: data.type,
        size: data.size,
        mimeType: data.mimeType,
      });
    } catch {
      // Silently fail
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Existing attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {attachments.map((a) =>
            a.type === "image" ? (
              <div key={a.id} className="group relative inline-block">
                <button
                  type="button"
                  onClick={() => setLightboxUrl(a.url)}
                  className="cursor-zoom-in"
                >
                  <img
                    src={a.url}
                    alt={a.name}
                    className="max-h-32 rounded border border-border object-cover"
                  />
                </button>
                {editable && (
                  <button
                    type="button"
                    onClick={() => onRemove(a.id)}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ) : (
              <div
                key={a.id}
                className="group flex items-center gap-2 rounded border border-border/50 bg-muted/30 px-2.5 py-1.5"
              >
                {fileIcon(a.type)}
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-xs font-medium text-foreground hover:underline truncate"
                >
                  {a.name}
                </a>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatSize(a.size)}
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => onRemove(a.id)}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      )}

      {/* Upload button */}
      {editable && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors",
              uploading && "opacity-50 cursor-not-allowed",
            )}
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Paperclip className="size-3.5" />
            )}
            {uploading ? "Uploading..." : "Attach file"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.gif,.webp"
            className="hidden"
            onChange={handleUpload}
          />
        </>
      )}

      {/* Lightbox via portal to escape parent stacking contexts */}
      {lightboxUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-sm"
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
    </div>
  );
}
