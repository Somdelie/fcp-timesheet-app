"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Play,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
  FolderOpen,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type UploadFile = {
  id: string;
  file: File;
  orderNumber: string;
  status: "queued" | "uploading" | "done" | "error";
  message?: string;
};

type SeedItem = {
  productName: string;
  quantity: number;
};

type SeedOrder = {
  orderNumber: string;
  supplierCode: string;
  supplierName: string;
  siteCode?: string;
  siteName?: string;
  items: SeedItem[];
};

type SeedResponse = {
  summary: {
    totalFiles: number;
    queuedOrders: number;
    seededOrders: number;
    savedToDb: number;
    duplicates: number;
    skippedOrders: number;
  };
  orders: SeedOrder[];
  savedOrderIds?: string[];
  duplicateRefs?: string[];
  skippedOrderNumbers: string[];
  skipReasons?: Record<string, string[]>;
  prismaSeedCode?: string;
};

const ACCEPTED_TYPES = ["application/pdf"];

function guessOrderNumber(fileName: string) {
  const match = fileName.match(/(\d{4,})/);
  return match?.[1] ?? "Unknown";
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function BuildsmartPdfSeedPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SeedResponse | null>(null);
  const [apiUrl, setApiUrl] = useState("/api/admin/buildsmart/seed-from-pdfs");

  const sortedFiles = useMemo(
    () =>
      [...files].sort(
        (a, b) => Number(a.orderNumber || 0) - Number(b.orderNumber || 0),
      ),
    [files],
  );

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList)
      .filter(
        (file) =>
          ACCEPTED_TYPES.includes(file.type) ||
          file.name.toLowerCase().endsWith(".pdf"),
      )
      .map<UploadFile>((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        orderNumber: guessOrderNumber(file.name),
        status: "queued",
      }));

    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.id));
      const merged = [...prev];
      for (const file of incoming) {
        if (!seen.has(file.id)) merged.push(file);
      }
      return merged;
    });
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  }

  function clearAll() {
    setFiles([]);
    setResult(null);
  }

  async function handleSubmit() {
    if (!files.length || isSubmitting) return;

    setIsSubmitting(true);
    setResult(null);
    setFiles((prev) =>
      prev.map((file) => ({
        ...file,
        status: "uploading",
        message: undefined,
      })),
    );

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("pdfs", file.file, file.file.name);
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as SeedResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to process PDFs");
      }

      setResult(data);
      setFiles((prev) =>
        prev.map((file) => ({
          ...file,
          status: data.skippedOrderNumbers?.includes(file.orderNumber)
            ? "error"
            : "done",
          message: data.skippedOrderNumbers?.includes(file.orderNumber)
            ? "Skipped"
            : "Ready",
        })),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      setFiles((prev) =>
        prev.map((file) => ({ ...file, status: "error", message })),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded border shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl font-semibold tracking-tight">
                    BuildSmart PDF Seeder
                  </CardTitle>
                  <CardDescription className="mt-1 text-sm">
                    Drop all order PDFs here, then generate seed-ready order
                    payloads in one run.
                  </CardDescription>
                </div>
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 text-xs"
                >
                  PDF batch import
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                  if (e.dataTransfer.files?.length)
                    addFiles(e.dataTransfer.files);
                }}
                className={cn(
                  "group rounded border-2 border-dashed p-8 transition",
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
                )}
              >
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="mb-4 rounded border bg-background p-4 shadow-sm">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-medium">Drop PDFs here</h3>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    Supports multiple BuildSmart order PDFs at once. Filenames
                    like{" "}
                    <span className="font-medium text-foreground">
                      ORDER 66681.pdf
                    </span>{" "}
                    are picked up automatically.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <Button
                      onClick={() => inputRef.current?.click()}
                      className="rounded"
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Choose PDFs
                    </Button>
                    <Button
                      variant="outline"
                      onClick={clearAll}
                      disabled={!files.length}
                      className="rounded"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear list
                    </Button>
                  </div>
                  <Input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) addFiles(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="rounded border bg-muted/20 shadow-none">
                  <CardContent className="p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Queued PDFs
                    </div>
                    <div className="mt-2 text-3xl font-semibold">
                      {files.length}
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded border bg-muted/20 shadow-none">
                  <CardContent className="p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Detected orders
                    </div>
                    <div className="mt-2 text-3xl font-semibold">
                      {files.filter((f) => f.orderNumber !== "Unknown").length}
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded border bg-muted/20 shadow-none">
                  <CardContent className="p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      API endpoint
                    </div>
                    <div className="mt-2 truncate text-sm font-medium">
                      {apiUrl}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Process endpoint</label>
                <Input
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="rounded"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={!files.length || isSubmitting}
                  size="lg"
                  className="rounded px-6"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {isSubmitting ? "Processing PDFs..." : "Generate seed output"}
                </Button>

                <Button
                  variant="outline"
                  disabled={!result?.prismaSeedCode}
                  onClick={() =>
                    result?.prismaSeedCode &&
                    downloadText(
                      "site-product-orders.seed.ts",
                      result.prismaSeedCode,
                    )
                  }
                  className="rounded"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download seed file
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Upload queue</CardTitle>
              <CardDescription>
                Review each PDF before processing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[620px] pr-3">
                <div className="space-y-3">
                  {!sortedFiles.length ? (
                    <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
                      No PDFs added yet.
                    </div>
                  ) : (
                    sortedFiles.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded border bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <div className="rounded-xl border bg-muted p-2">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {entry.file.name}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>Order {entry.orderNumber}</span>
                                  <span>&bull;</span>
                                  <span>{fileSizeLabel(entry.file.size)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {entry.status === "queued" && (
                              <Badge variant="secondary">Queued</Badge>
                            )}
                            {entry.status === "uploading" && (
                              <Badge>Processing</Badge>
                            )}
                            {entry.status === "done" && (
                              <Badge className="gap-1 rounded-full">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Done
                              </Badge>
                            )}
                            {entry.status === "error" && (
                              <Badge
                                variant="destructive"
                                className="gap-1 rounded-full"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Skipped
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-xl"
                              onClick={() => removeFile(entry.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {entry.message ? (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {entry.message}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Run summary</CardTitle>
              <CardDescription>
                What happened after processing the uploaded PDFs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!result ? (
                <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No output yet.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <MetricCard
                      label="Files"
                      value={result.summary.totalFiles}
                    />
                    <MetricCard
                      label="Matched"
                      value={result.summary.seededOrders}
                    />
                    <MetricCard
                      label="Saved to DB"
                      value={result.summary.savedToDb}
                    />
                    <MetricCard
                      label="Duplicates"
                      value={result.summary.duplicates}
                    />
                    <MetricCard
                      label="Skipped"
                      value={result.summary.skippedOrders}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="text-sm font-medium">
                      Skipped order numbers
                    </div>
                    {result.skippedOrderNumbers.length ? (
                      <div className="flex flex-wrap gap-2">
                        {result.skippedOrderNumbers.map((orderNumber) => (
                          <Badge
                            key={orderNumber}
                            variant="destructive"
                            className="rounded-full px-3 py-1"
                          >
                            {orderNumber}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No skipped orders.
                      </div>
                    )}
                  </div>

                  {!!result.skipReasons &&
                    Object.keys(result.skipReasons).length > 0 && (
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Skip reasons</div>
                        <div className="space-y-3">
                          {Object.entries(result.skipReasons).map(
                            ([orderNumber, reasons]) => (
                              <div
                                key={orderNumber}
                                className="rounded border bg-muted/20 p-4"
                              >
                                <div className="text-sm font-semibold">
                                  Order {orderNumber}
                                </div>
                                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                                  {reasons.map((reason) => (
                                    <li key={reason}>&bull; {reason}</li>
                                  ))}
                                </ul>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Generated seed payload</CardTitle>
              <CardDescription>
                Preview of the returned orders before you write them to the
                database.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!result ? (
                <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Process PDFs to preview generated orders.
                </div>
              ) : (
                <ScrollArea className="h-[560px] rounded border bg-muted/20 p-4">
                  <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {JSON.stringify(result.orders, null, 2)}
                  </pre>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-muted/20 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
