"use client";

import { useCallback, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, X, Upload, Info, CheckCircle2 } from "lucide-react";

interface SelectedFile {
  id: string;
  file: File;
}

async function looksLikePdf(file: File) {
  const header = await file.slice(0, 5).text();
  return header === "%PDF-";
}

export default function PrintCardsPage() {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ count: number; sheets: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) return;
    setSuccess(null);
    setError(null);

    const validPdfs: File[] = [];
    const invalidNames: string[] = [];

    for (const file of pdfs) {
      if (await looksLikePdf(file)) validPdfs.push(file);
      else invalidNames.push(file.name);
    }

    if (invalidNames.length > 0) {
      setError(
        `These files are not valid PDFs: ${invalidNames.join(", ")}. Please re-download them from the employee card download button.`,
      );
    }

    if (validPdfs.length === 0) return;

    setFiles((prev) => {
      const existingNames = new Set(prev.map((sf) => sf.file.name));
      const newEntries: SelectedFile[] = validPdfs
        .filter((f) => !existingNames.has(f.name))
        .map((f) => ({ id: crypto.randomUUID(), file: f }));
      return [...prev, ...newEntries];
    });
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((sf) => sf.id !== id));
    setSuccess(null);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(Array.from(e.dataTransfer.files));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      void addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleMerge = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const formData = new FormData();
      for (const sf of files) {
        formData.append("cards", sf.file);
      }

      const res = await fetch("/api/merge-cards", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Server error ${res.status}`);
      }

      const blob = await res.blob();
      const timestamp = Date.now();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cards_print_ready_${timestamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSuccess({
        count: files.length,
        sheets: Math.ceil(files.length / 8),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Print Cards</CardTitle>
          <CardDescription>
            Merge worker card PDFs into a print-ready A4 sheet — 8 cards per
            page (2 × 4), duplex-ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Drop zone for PDF files"
            className={`flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer
              ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Drop worker card PDFs here</p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse — .pdf files only
              </p>
            </div>
            {files.length > 0 && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {files.length} {files.length === 1 ? "file" : "files"} selected
              </span>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="sr-only"
              onChange={handleInputChange}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto rounded-md border bg-muted/30 p-2">
              {files.map((sf) => (
                <li
                  key={sf.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{sf.file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${sf.file.name}`}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive focus:outline-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(sf.id);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Merge button */}
          <Button
            className="w-full"
            disabled={files.length === 0 || loading}
            onClick={handleMerge}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate Print PDF"
            )}
          </Button>

          {/* Success message */}
          {success && (
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Ready!{" "}
                <strong>
                  {success.count} {success.count === 1 ? "card" : "cards"}
                </strong>{" "}
                across{" "}
                <strong>
                  {success.sheets} {success.sheets === 1 ? "sheet" : "sheets"}
                </strong>
                . Print duplex — <strong>Flip on Long Edge</strong>.
              </span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Print instructions note */}
          <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              <strong>Print settings:</strong> Duplex / Two-sided → Flip on Long
              Edge. Each A4 sheet holds 8 cards (2×4). Cut along card edges
              after printing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
