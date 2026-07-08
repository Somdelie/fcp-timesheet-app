// app/admin/cards/bulk-seed/page.tsx
"use client";

import { DragEvent, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { AlertTriangle, FileText, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ImportRow {
  line: number;
  name: string;
  email?: string;
  cardNumber: string;
  role?: string;
  sourceFile?: string;
}

interface PreviewRow extends ImportRow {
  status: "valid" | "warning" | "error";
  message: string | null;
  action: string;
  existingEmployeeName: string | null;
}

interface PreviewSummary {
  totalRows: number;
  createCount: number;
  updateCount: number;
  reactivateCount: number;
  warningCount: number;
  errorCount: number;
  createdCount?: number;
  updatedCount?: number;
  matchedScanCount?: number;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(text: string): { rows: ImportRow[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: ["Paste CSV text first."] };
  }

  const header = splitCsvLine(lines[0]).map((cell) =>
    cell.toLowerCase().replace(/\s+/g, ""),
  );

  const requiredColumns = ["name", "cardnumber"];
  const missingColumns = requiredColumns.filter(
    (column) => !header.includes(column),
  );

  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [`Missing required columns: ${missingColumns.join(", ")}`],
    };
  }

  const rows: ImportRow[] = [];

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const cells = splitCsvLine(lines[rowIndex]);
    const rowData: Record<string, string> = {};

    header.forEach((column, index) => {
      rowData[column] = cells[index] ?? "";
    });

    rows.push({
      line: rowIndex + 1,
      name: rowData.name ?? "",
      email: rowData.email ?? "",
      cardNumber: rowData.cardnumber ?? "",
      role: rowData.role || "WORKER",
    });
  }

  return { rows, errors: [] };
}

export default function AdminBulkCardSeedPage() {
  const [csvText, setCsvText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<"pdf" | "csv">("pdf");

  const hasErrors =
    previewRows.some((row) => row.status === "error") || errors.length > 0;

  const canSave =
    !saving &&
    !previewLoading &&
    !hasErrors &&
    (previewRows.length > 0 || importRows.length > 0);

  const previewState = useMemo(() => {
    if (!summary) return null;
    return `${summary.totalRows} rows · ${summary.createCount} create · ${summary.updateCount} update · ${summary.reactivateCount} reactivate · ${summary.warningCount} warnings · ${summary.errorCount} errors`;
  }, [summary]);

  function addFiles(nextFiles: File[]) {
    const pdfs = nextFiles.filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf"),
    );

    if (pdfs.length !== nextFiles.length) {
      toast.warning("Only PDF files are allowed.");
    }

    const merged = [...files, ...pdfs].slice(0, 30);
    setFiles(merged);
    setMode("pdf");
    setErrors([]);
    setPreviewRows([]);
    setSummary(null);
  }

  function removeFile(index: number) {
    setFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index),
    );
    setPreviewRows([]);
    setSummary(null);
  }

  async function previewPdfs(selectedFiles = files) {
    if (selectedFiles.length === 0) {
      setErrors(["Drop or select at least one attendance card PDF."]);
      return;
    }

    setPreviewLoading(true);
    setErrors([]);
    setPreviewRows([]);
    setSummary(null);

    const form = new FormData();
    form.append("dryRun", "true");
    selectedFiles.forEach((file) => form.append("files", file));

    try {
      const res = await fetch("/api/app/admin/cards/bulk-seed", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to read PDFs.");
      }

      setMode("pdf");
      setPreviewRows(data.rows ?? []);
      setSummary(data.summary ?? null);
      setImportRows(data.rows ?? []);
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Failed to read PDFs.",
      ]);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function previewCsv() {
    const parsed = parseCsv(csvText);
    setErrors(parsed.errors);
    setImportRows(parsed.rows);
    setPreviewRows([]);
    setSummary(null);
    setMode("csv");

    if (parsed.errors.length > 0) return;

    setPreviewLoading(true);

    try {
      const res = await fetch("/api/app/admin/cards/bulk-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed.rows, dryRun: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to validate rows.");
      }

      setPreviewRows(data.rows ?? []);
      setSummary(data.summary ?? null);
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Failed to validate rows.",
      ]);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function saveAll() {
    if (previewRows.length === 0) {
      toast.error("Preview first before saving.");
      return;
    }

    setSaving(true);

    try {
      let res: Response;

      // If any files are selected, always send FormData
      if (files.length > 0) {
        const form = new FormData();
        form.append("dryRun", "false");
        files.forEach((file) => form.append("files", file));

        res = await fetch("/api/app/admin/cards/bulk-seed", {
          method: "POST",
          body: form,
        });
      } else {
        // CSV/manual fallback
        const rowsToSave = importRows.length > 0 ? importRows : previewRows;

        res = await fetch("/api/app/admin/cards/bulk-seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: rowsToSave, dryRun: false }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save cards.");
      }

      setPreviewRows(data.rows ?? []);
      setSummary(data.summary ?? null);

      toast.success(
        `Saved ${data.summary.createdCount ?? 0} created, ${
          data.summary.updatedCount ?? 0
        } updated, ${data.summary.matchedScanCount ?? 0} scan(s) linked.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save cards.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="container mx-auto max-w-7xl py-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Card Seeder</CardTitle>
          <CardDescription>
            Drag and drop up to 30 attendance card PDFs. The system will read
            the worker name and card number, preview the import, then create
            missing employees or update existing cards.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
              dragging
                ? "border-primary bg-primary/10"
                : "border-border bg-muted/40"
            }`}
          >
            <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Drop attendance card PDFs here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Maximum 30 PDFs per import.
            </p>

            <label className="mt-4 inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Select PDFs
              <input
                type="file"
                multiple
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {files.length > 0 && (
            <div className="rounded-md border bg-background">
              <div className="border-b p-3 text-sm font-medium">
                Selected PDFs ({files.length}/30)
              </div>
              <div className="max-h-52 overflow-auto p-3">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="rounded p-1 hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 border-t p-3">
                <Button
                  onClick={() => void previewPdfs()}
                  disabled={previewLoading || saving}
                >
                  {previewLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reading PDFs…
                    </>
                  ) : (
                    "Preview PDFs"
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setFiles([])}
                  disabled={previewLoading || saving}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-md border p-4">
            <Label htmlFor="csv-input">Optional CSV/manual fallback</Label>
            <Textarea
              id="csv-input"
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder={`name,email,cardNumber,role\nELTON NCUBE,,4D7DBC911FD90A85,WORKER`}
              className="mt-2 min-h-32 font-mono"
            />
            <Button
              className="mt-3"
              variant="secondary"
              onClick={() => void previewCsv()}
              disabled={previewLoading || saving}
            >
              Preview CSV
            </Button>
          </div>

          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Errors
              </div>
              <ul className="list-disc pl-5">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {summary && (
            <div className="rounded-md border bg-muted/50 p-4 text-sm">
              <p className="font-medium">Preview summary</p>
              <p>{previewState}</p>
            </div>
          )}

          {previewRows.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-md border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Card Number</TableHead>
                      <TableHead>Source PDF</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Matched Employee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row) => (
                      <TableRow
                        key={`${row.line}-${row.cardNumber}-${row.sourceFile ?? ""}`}
                      >
                        <TableCell>{row.line}</TableCell>
                        <TableCell>{row.name || "—"}</TableCell>
                        <TableCell className="font-mono">
                          {row.cardNumber || "—"}
                        </TableCell>
                        <TableCell>{row.sourceFile || "—"}</TableCell>
                        <TableCell>{row.action}</TableCell>
                        <TableCell>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                              row.status === "valid"
                                ? "bg-emerald-100 text-emerald-800"
                                : row.status === "warning"
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-red-100 text-red-900"
                            }`}
                          >
                            {row.status}
                          </span>
                        </TableCell>
                        <TableCell>{row.message || "—"}</TableCell>
                        <TableCell>{row.existingEmployeeName || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button onClick={() => void saveAll()} disabled={!canSave}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save all cards"
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
