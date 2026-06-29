"use client";

import * as React from "react";
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SiteDocument = {
  id: string;
  title: string;
  fileName: string;
  documentType: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  createdAt: string;
  uploadedBy: { id: string; name: string | null; email: string | null } | null;
};

const DOCUMENT_TYPES = [
  { value: "DRAWING", label: "Drawing" },
  { value: "SPEC", label: "Spec" },
  { value: "EXCEL", label: "Excel" },
  { value: "QUOTE", label: "Quote" },
  { value: "INVOICE", label: "Invoice" },
  { value: "PHOTO", label: "Photo" },
  { value: "OTHER", label: "Other" },
] as const;

function documentTypeLabel(type: string) {
  return DOCUMENT_TYPES.find((option) => option.value === type)?.label ?? type;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function iconFor(doc: SiteDocument) {
  if (
    doc.documentType === "EXCEL" ||
    doc.mimeType.includes("spreadsheet") ||
    doc.mimeType.includes("excel") ||
    doc.fileName.toLowerCase().endsWith(".xlsx")
  ) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
  }
  return <FileText className="h-5 w-5 text-blue-600" />;
}

export default function SiteDocumentsPanel({ siteId }: { siteId: string }) {
  const [documents, setDocuments] = React.useState<SiteDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [documentType, setDocumentType] = React.useState("DRAWING");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadDocuments = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/app/admin/sites/${encodeURIComponent(siteId)}/documents`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load documents");
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load documents",
      );
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  React.useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function uploadFiles(files: FileList | File[]) {
    const selected = Array.from(files);
    if (selected.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("documentType", documentType);
      selected.forEach((file) => formData.append("files", file));

      const res = await fetch(
        `/api/app/admin/sites/${encodeURIComponent(siteId)}/documents`,
        { method: "POST", body: formData },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const created = Array.isArray(data.documents) ? data.documents : [];
      setDocuments((current) => [...created, ...current]);
      toast.success(
        created.length === 1
          ? "Document uploaded"
          : `${created.length} documents uploaded`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(doc: SiteDocument) {
    if (!confirm(`Delete "${doc.title}"?`)) return;

    setDeletingId(doc.id);
    try {
      const res = await fetch(
        `/api/app/admin/sites/${encodeURIComponent(siteId)}/documents/${encodeURIComponent(doc.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");

      setDocuments((current) => current.filter((item) => item.id !== doc.id));
      toast.success("Document deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  function documentFileUrl(doc: SiteDocument, download = false) {
    const base = `/api/app/admin/sites/${encodeURIComponent(siteId)}/documents/${encodeURIComponent(doc.id)}`;
    return download ? `${base}?download=1` : base;
  }

  return (
    <section className="rounded border border-slate-200/70 bg-white/85 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/45">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">
            Site Documents
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Keep drawings, specs, PDFs, spreadsheets, and other site files here.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-52 space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Document type
            </label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger className="h-10 w-full rounded border-slate-300 bg-white text-sm font-medium shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="min-w-52">
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void uploadFiles(event.target.files);
            }}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload
          </Button>
        </div>
      </div>

      <div
        className="mt-4 rounded border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 transition-colors dark:border-slate-700 dark:text-slate-400"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          void uploadFiles(event.dataTransfer.files);
        }}
      >
        Drop files here, or use Upload. Max 25 MB per file.
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded border border-slate-200 bg-slate-50/70 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
            No site documents uploaded yet.
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto rounded border border-slate-200 dark:border-slate-700">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5">{iconFor(doc)}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-slate-950 dark:text-white">
                          {doc.title}
                        </p>
                        <Badge variant="secondary">
                          {documentTypeLabel(doc.documentType)}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        {doc.fileName} - {formatBytes(doc.fileSize)} - Uploaded{" "}
                        {new Date(doc.createdAt).toLocaleDateString("en-ZA", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })}
                        {doc.uploadedBy?.name
                          ? ` by ${doc.uploadedBy.name}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="gap-1"
                    >
                      <a
                        href={documentFileUrl(doc)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </a>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="gap-1"
                    >
                      <a href={documentFileUrl(doc, true)}>
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void deleteDocument(doc)}
                      disabled={deletingId === doc.id}
                      className="text-red-600 hover:text-red-700"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
