"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import {
  Upload,
  FileText,
  Download,
  Trash2,
  GripVertical,
  Loader2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PdfItem = {
  id: string;
  file: File;
  size: number;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MergePdfsPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<PdfItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [merging, setMerging] = useState(false);

  const totalSize = useMemo(
    () => files.reduce((sum, f) => sum + f.size, 0),
    [files],
  );

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter(
      (f) => f.type === "application/pdf",
    );

    if (!pdfs.length) return;

    setFiles((prev) => [
      ...prev,
      ...pdfs.map((file) => ({
        id: crypto.randomUUID(),
        file,
        size: file.size,
      })),
    ]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      setDragging(false);

      if (e.dataTransfer.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const moveFile = useCallback((index: number, direction: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + direction;

      if (target < 0 || target >= next.length) return prev;

      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const mergePdfs = useCallback(async () => {
    if (files.length < 2) return;

    try {
      setMerging(true);

      const mergedPdf = await PDFDocument.create();

      for (const item of files) {
        const bytes = await item.file.arrayBuffer();

        const pdf = await PDFDocument.load(bytes);

        const copiedPages = await mergedPdf.copyPages(
          pdf,
          pdf.getPageIndices(),
        );

        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();

      const blob = new Blob([mergedBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `merged-${new Date().getTime()}.pdf`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to merge PDFs");
    } finally {
      setMerging(false);
    }
  }, [files]);

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Merge PDFs</h1>

        <p className="text-muted-foreground mt-2">
          Upload multiple PDF files, arrange them in the correct order, then
          merge them into one document.
        </p>
      </div>

      <Card
        className={[
          "border-2 border-dashed transition-all duration-200",
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25",
        ].join(" ")}
      >
        <div
          className="p-10 text-center"
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={onDrop}
        >
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-muted p-4">
              <Upload className="h-8 w-8" />
            </div>
          </div>

          <h2 className="text-lg font-semibold">Drag & drop PDF files here</h2>

          <p className="text-sm text-muted-foreground mt-2">
            or click below to browse your files
          </p>

          <Button
            className="mt-5"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            Select PDFs
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                addFiles(e.target.files);
              }
            }}
          />
        </div>
      </Card>

      {files.length > 0 ? (
        <Card className="p-0 overflow-hidden">
          <div className="border-b px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">PDF Files ({files.length})</h3>

              <p className="text-sm text-muted-foreground">
                Total size: {formatBytes(totalSize)}
              </p>
            </div>

            <Button onClick={mergePdfs} disabled={files.length < 2 || merging}>
              {merging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Merge PDFs
                </>
              )}
            </Button>
          </div>

          <div className="divide-y">
            {files.map((item, index) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                <GripVertical className="h-5 w-5 text-muted-foreground" />

                <div className="rounded-lg bg-muted p-2">
                  <FileText className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.file.name}</div>

                  <div className="text-sm text-muted-foreground">
                    {formatBytes(item.size)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === 0}
                    onClick={() => moveFile(index, -1)}
                  >
                    ↑
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={index === files.length - 1}
                    onClick={() => moveFile(index, 1)}
                  >
                    ↓
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeFile(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
