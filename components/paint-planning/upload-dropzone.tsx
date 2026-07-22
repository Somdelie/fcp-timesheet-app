"use client";

import { useCallback, useRef, useState } from "react";

export function UploadDropzone({
  onUploadComplete,
}: {
  onUploadComplete: () => Promise<void> | void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (list: FileList | null) => {
      if (!list?.length || uploading) return;
      const files = Array.from(list);
      const invalid = files.filter(
        (f) =>
          f.type !== "application/pdf" &&
          !f.name.toLowerCase().endsWith(".pdf"),
      );
      if (invalid.length)
        return setError(`${invalid.length} non-PDF file(s) rejected.`);
      if (files.length > 100) return setError("Maximum 100 PDFs per batch.");
      setError(null);
      setUploading(true);
      try {
        const body = new FormData();
        files.forEach((file) => body.append("files", file));
        const response = await fetch("/api/admin/paint-tds/import", {
          method: "POST",
          body,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Upload failed.");
        const failed =
          result.results?.filter(
            (item: { status: string }) => item.status === "failed",
          ).length ?? 0;
        if (failed)
          setError(
            `${failed} PDF(s) failed. Open the failed rows for details.`,
          );
        await onUploadComplete();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Upload failed.");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onUploadComplete, uploading],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void upload(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-9 text-center transition ${isDragging ? "border-green-600 bg-green-50" : "border-slate-300 bg-white hover:border-green-500 hover:bg-green-50/40"} ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(e) => void upload(e.target.files)}
        />
        <p className="text-sm font-semibold text-slate-900">
          {uploading
            ? "Reading and profiling PDFs…"
            : "Drop PDFs here, or browse"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Upload 1–100 technical data sheets at once.
        </p>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
