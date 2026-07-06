"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  History,
  TriangleAlert,
  ShoppingCart,
  Receipt,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type StockOrderResult = {
  orderNumber: string;
  foremanName: string | null;
  createdAt: string;
  itemsCreated: number;
  status: "created" | "skipped" | "duplicate";
  reason?: string;
};

type ParseFailure = {
  fileName: string;
  orderNumber: string | null;
  reason: string;
};

type SeedResponse = {
  summary: {
    totalFiles: number;
    parsedOrders?: number;
    parseFailures?: number;
    queuedOrders: number;
    seededOrders: number;
    savedToDb: number;
    duplicates: number;
    skippedOrders: number;
    stockOrdersDetected?: number;
    stockOrdersCreated?: number;
  };
  orders: SeedOrder[];
  stockOrders?: StockOrderResult[];
  savedOrderIds?: string[];
  duplicateRefs?: string[];
  skippedOrderNumbers?: string[];
  skipReasons?: Record<string, string[]>;
  parseFailures?: ParseFailure[];
  prismaSeedCode?: string;
};

type PdfOrdersTabProps = {
  title: string;
  description: string;
  badgeText: string;
  apiUrlDefault: string;
};

type ImportJobResultJson = Partial<SeedResponse> & {
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
};

type ImportJobRow = {
  id: string;
  fileName: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  error?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  resultJson?: ImportJobResultJson | null;
};

type QueueResponse = SeedResponse & {
  jobs?: ImportJobRow[];
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

async function getResponseErrorMessage(res: Response) {
  const fallback = `Request failed (${res.status}${res.statusText ? ` ${res.statusText}` : ""})`;
  const contentType = res.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as {
        error?: unknown;
        message?: unknown;
      };
      return (
        (typeof data.error === "string" && data.error) ||
        (typeof data.message === "string" && data.message) ||
        fallback
      );
    }

    const text = (await res.text()).trim();
    return text ? `${fallback}: ${text.slice(0, 300)}` : fallback;
  } catch {
    return fallback;
  }
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
  return (
    <div className="min-h-screen bg-background">
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="mb-4 rounded border bg-muted/40 p-1">
          <TabsTrigger value="orders" className="rounded">
            <FileText className="mr-2 h-4 w-4" />
            PDF Orders
          </TabsTrigger>
          <TabsTrigger value="materials" className="rounded">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Historical Materials
          </TabsTrigger>
          <TabsTrigger value="historical" className="rounded">
            <History className="mr-2 h-4 w-4" />
            Historical Costs
          </TabsTrigger>
          <TabsTrigger value="claims" className="rounded">
            <Receipt className="mr-2 h-4 w-4" />
            Claims
          </TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <PdfOrdersTab
            title="Documents PDF Seeder"
            description="Drop Documents PO PDFs here. Each PO is saved once — if that order number already exists (from PDF Orders or Historical Materials), it is skipped."
            badgeText="PDF batch import"
            apiUrlDefault="/api/admin/buildsmart/seed-from-pdfs"
          />
        </TabsContent>
        <TabsContent value="materials">
          <HistoricalMaterialsTab />
        </TabsContent>
        <TabsContent value="historical">
          <HistoricalCostsTab />
        </TabsContent>
        <TabsContent value="claims">
          <ClaimsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── PDF Orders tab (original content) ───────────────────────────────────────

function PdfOrdersTab({
  title,
  description,
  badgeText,
  apiUrlDefault,
}: PdfOrdersTabProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QueueResponse | null>(null);
  const [apiUrl, setApiUrl] = useState(apiUrlDefault);
  const [jobs, setJobs] = useState<ImportJobRow[]>([]);

  const sortedFiles = useMemo(
    () =>
      [...files].sort(
        (a, b) => Number(a.orderNumber || 0) - Number(b.orderNumber || 0),
      ),
    [files],
  );

  useEffect(() => {
    if (!jobs.length) return;

    const hasActiveJobs = jobs.some((job) =>
      ["QUEUED", "PROCESSING"].includes(job.status),
    );

    if (!hasActiveJobs) return;

    const timer = window.setInterval(async () => {
      try {
        const ids = jobs.map((job) => job.id).join(",");
        const res = await fetch(`/api/admin/buildsmart/import-jobs?ids=${ids}`);

        if (!res.ok) return;

        const data = (await res.json()) as { jobs: ImportJobRow[] };

        setJobs((prev) => {
          const previousOrder = prev.map((job) => job.id);
          const latest = new Map(data.jobs.map((job) => [job.id, job]));

          return previousOrder
            .map((id) => latest.get(id))
            .filter(Boolean) as ImportJobRow[];
        });
      } catch {
        // silent polling failure
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [jobs]);

  const completedJobs = jobs.filter((job) => job.status === "COMPLETED");
  const failedJobs = jobs.filter((job) => job.status === "FAILED");
  const processingJobs = jobs.filter((job) => job.status === "PROCESSING");
  const queuedJobs = jobs.filter((job) => job.status === "QUEUED");

  const jobResults = completedJobs
    .map((job) => job.resultJson)
    .filter(Boolean) as ImportJobResultJson[];

  const totalDuplicates = jobResults.reduce(
    (sum, item) => sum + (item.summary?.duplicates ?? 0),
    0,
  );

  const totalSkipped = jobResults.reduce(
    (sum, item) => sum + (item.summary?.skippedOrders ?? 0),
    0,
  );

  const totalSaved = jobResults.reduce(
    (sum, item) => sum + (item.summary?.savedToDb ?? 0),
    0,
  );

  const totalParsed = jobResults.reduce(
    (sum, item) =>
      sum + (item.summary?.parsedOrders ?? item.summary?.queuedOrders ?? 0),
    0,
  );

  const skippedOrderNumbers = jobResults.flatMap(
    (item) => item.skippedOrderNumbers ?? [],
  );

  const duplicateRefs = jobResults.flatMap((item) => item.duplicateRefs ?? []);

  const parseFailures = jobResults.flatMap((item) => item.parseFailures ?? []);

  const skipReasons = jobResults.reduce<Record<string, string[]>>(
    (acc, item) => {
      for (const [orderNumber, reasons] of Object.entries(
        item.skipReasons ?? {},
      )) {
        acc[orderNumber] = [...(acc[orderNumber] ?? []), ...reasons];
      }
      return acc;
    },
    {},
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
    setJobs([]);
  }

  async function handleSubmit() {
    if (!files.length || isSubmitting) return;

    setIsSubmitting(true);
    setResult(null);
    setJobs([]);

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

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response));
      }

      const data = (await response.json()) as QueueResponse & {
        error?: string;
      };

      setResult(data);
      setJobs(data.jobs ?? []);

      setFiles((prev) =>
        prev.map((file) => ({
          ...file,
          status: "done" as const,
          message: data.jobs?.length ? "Queued for import" : "Parsed",
        })),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";

      setFiles((prev) =>
        prev.map((file) => ({
          ...file,
          status: "error",
          message,
        })),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded border shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {title}
                </CardTitle>
                <CardDescription className="mt-1 text-sm">
                  {description}
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className="rounded-full px-3 py-1 text-xs"
              >
                {badgeText}
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
                  Supports multiple BuildSmart purchase-order PDFs at once.
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
                    disabled={!files.length && !jobs.length}
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
              {isSubmitting ? "Queueing PDFs..." : "Queue PDF import"}
            </Button>
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
            <ScrollArea className="h-155 pr-3">
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
                            <div className="rounded border bg-muted p-2">
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
                            <Badge>Queueing</Badge>
                          )}
                          {entry.status === "done" && (
                            <Badge className="gap-1 rounded-full">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Queued
                            </Badge>
                          )}
                          {entry.status === "error" && (
                            <Badge
                              variant="destructive"
                              className="gap-1 rounded-full"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Error
                            </Badge>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded"
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
              Live summary from the import jobs.
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
                  <MetricCard label="Queued" value={queuedJobs.length} />
                  <MetricCard
                    label="Processing"
                    value={processingJobs.length}
                  />
                  <MetricCard label="Completed" value={completedJobs.length} />
                  <MetricCard label="Failed" value={failedJobs.length} />
                  <MetricCard label="Parsed" value={totalParsed} />
                  <MetricCard label="Saved" value={totalSaved} />
                  <MetricCard label="Duplicates" value={totalDuplicates} />
                  <MetricCard label="Skipped" value={totalSkipped} />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="text-sm font-medium">Duplicate orders</div>
                  {duplicateRefs.length ? (
                    <div className="flex flex-wrap gap-2">
                      {duplicateRefs.map((orderNumber) => (
                        <Badge key={orderNumber} variant="secondary">
                          {orderNumber}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No duplicate orders.
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="text-sm font-medium">Skipped orders</div>
                  {skippedOrderNumbers.length ? (
                    <div className="flex flex-wrap gap-2">
                      {skippedOrderNumbers.map((orderNumber) => (
                        <Badge key={orderNumber} variant="destructive">
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

                {Object.keys(skipReasons).length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="text-sm font-medium">Skip reasons</div>
                      {Object.entries(skipReasons).map(
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
                  </>
                )}

                {parseFailures.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="text-sm font-medium">Parse failures</div>
                      <ul className="space-y-1 text-sm text-amber-700">
                        {parseFailures.map((failure) => (
                          <li key={`${failure.fileName}-${failure.reason}`}>
                            {failure.fileName}
                            {failure.orderNumber
                              ? ` (PO ${failure.orderNumber})`
                              : ""}
                            : {failure.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Import progress</CardTitle>
            <CardDescription>
              Live status of uploaded BuildSmart PDF jobs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!jobs.length ? (
              <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
                No import jobs yet.
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const progress = job.resultJson?.progress;
                  const pct =
                    progress?.total && progress.total > 0
                      ? Math.round((progress.current / progress.total) * 100)
                      : job.status === "COMPLETED" || job.status === "FAILED"
                        ? 100
                        : job.status === "PROCESSING"
                          ? 50
                          : 10;

                  return (
                    <div key={job.id} className="rounded border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {job.fileName}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {progress?.message ??
                              (job.status === "QUEUED"
                                ? "Waiting to start"
                                : job.status === "PROCESSING"
                                  ? "Processing PDF"
                                  : job.status === "COMPLETED"
                                    ? "Completed"
                                    : "Failed")}
                          </div>
                          {job.error && (
                            <div className="mt-2 text-xs text-destructive">
                              {job.error}
                            </div>
                          )}
                        </div>

                        <Badge
                          variant={
                            job.status === "FAILED"
                              ? "destructive"
                              : job.status === "COMPLETED"
                                ? "default"
                                : "secondary"
                          }
                          className="shrink-0 rounded-full"
                        >
                          {job.status}
                        </Badge>
                      </div>

                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                        <span>{pct}%</span>
                        {progress && (
                          <span>
                            {progress.current} / {progress.total}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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

// ─── Historical Materials tab ─────────────────────────────────────────────────

type MatOrderLine = {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: string | null;
  totalAmount: string;
  ledgerCode: string;
  batchRef: string;
};

type MatOrderPreview = {
  fileName: string;
  orderNumber: string | null;
  siteCode: string;
  siteName: string | null;
  transactionDate: string;
  totalAmount: string;
  lineCount: number;
  lines: MatOrderLine[];
};

type MatParseResponse = {
  action: "parse";
  totalOrders: number;
  totalLines: number;
  parseWarnings: string[];
  orders: MatOrderPreview[];
};

type MatImportResult = {
  orderNumber: string | null;
  siteCode: string;
  siteName: string | null;
  transactionDate: string;
  totalAmount: string;
  linesCreated: number;
  status: string;
  reason?: string;
};

type MatImportResponse = {
  action: "import";
  summary: Record<string, number>;
  totalProcessed: number;
  parseWarnings: string[];
  results: MatImportResult[];
};

const MAT_STATUS_BADGE: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  CREATED: { label: "Created", variant: "default" },
  DUPLICATE: { label: "Already imported", variant: "secondary" },
  MISSING_SITE: { label: "Missing site", variant: "destructive" },
  NO_ORDER_NUMBER: { label: "No order number", variant: "outline" },
  ERROR: { label: "Error", variant: "destructive" },
};

function HistoricalMaterialsTab() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [siteCodeOverride, setSiteCodeOverride] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [preview, setPreview] = useState<MatParseResponse | null>(null);
  const [importResult, setImportResult] = useState<MatImportResponse | null>(
    null,
  );
  const [importProgress, setImportProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}`));
      return [
        ...prev,
        ...incoming.filter((f) => !seen.has(`${f.name}-${f.size}`)),
      ];
    });
    setPreview(null);
    setImportResult(null);
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setPreview(null);
    setImportResult(null);
  }

  async function callApi(action: "parse" | "import") {
    if (!files.length || isBusy) return;
    setIsBusy(true);
    if (action === "parse") setImportResult(null);
    setImportProgress(null);

    try {
      const fd = new FormData();
      fd.append("action", action);
      if (siteCodeOverride.trim())
        fd.append("siteCode", siteCodeOverride.trim());
      for (const f of files) fd.append("pdfs", f, f.name);

      const res = await fetch("/api/admin/buildsmart/seed-material-orders", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error ?? "Request failed");
      }

      if (action === "parse") {
        const data = await res.json();
        setPreview(data as MatParseResponse);
      } else {
        // Stream NDJSON progress events
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const streamedResults: MatImportResult[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop()!;
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as
              | {
                  type: "progress";
                  total: number;
                  done: number;
                  result: MatImportResult;
                }
              | {
                  type: "done";
                  summary: Record<string, number>;
                  totalProcessed: number;
                  parseWarnings: string[];
                }
              | { type: "error"; error: string };

            if (event.type === "progress") {
              setImportProgress({ done: event.done, total: event.total });
              streamedResults.push(event.result);
            } else if (event.type === "done") {
              setImportResult({
                action: "import",
                summary: event.summary,
                totalProcessed: event.totalProcessed,
                parseWarnings: event.parseWarnings,
                results: streamedResults,
              });
              setImportProgress(null);
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          }
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsBusy(false);
      setImportProgress(null);
    }
  }

  const orders = preview?.orders ?? [];
  const results = importResult?.results ?? [];
  const warnings = importResult?.parseWarnings ?? preview?.parseWarnings ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded border shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Historical Material Orders
                </CardTitle>
                <CardDescription className="mt-1 text-sm">
                  Upload BuildSmart cost-report PDFs to seed past supplier
                  orders (DEL-batch lines). Each unique order number becomes one
                  SiteProductOrder with the original order date preserved.
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className="rounded-full px-3 py-1 text-xs"
              >
                Historical orders
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
                  <ShoppingCart className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium">
                  Drop cost-report PDFs here
                </h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Only{" "}
                  <span className="font-medium text-foreground">
                    DEL-batch lines
                  </span>{" "}
                  are extracted — these are historical supplier purchase orders.
                  Use the{" "}
                  <span className="font-medium text-foreground">
                    PDF Orders
                  </span>{" "}
                  tab for ongoing orders instead.
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
                    onClick={() => {
                      setFiles([]);
                      setPreview(null);
                      setImportResult(null);
                    }}
                    disabled={!files.length}
                    className="rounded"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
                <input
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

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Site code override{" "}
                <span className="font-normal text-muted-foreground">
                  (only needed when the PDF has no contract header)
                </span>
              </label>
              <Input
                placeholder="e.g. 6537"
                value={siteCodeOverride}
                onChange={(e) => setSiteCodeOverride(e.target.value)}
                className="max-w-xs rounded"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => callApi("parse")}
                disabled={!files.length || isBusy}
                variant="outline"
                size="lg"
                className="rounded px-6"
              >
                {isBusy && !importProgress ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Preview orders
              </Button>
              <Button
                onClick={() => callApi("import")}
                disabled={!files.length || isBusy || !preview}
                size="lg"
                className="rounded px-6"
              >
                {importProgress ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Import to database
              </Button>
            </div>

            {/* Import progress bar */}
            {importProgress && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {"Importing orders…"}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {importProgress.done}
                    {" / "}
                    {importProgress.total}
                    <span className="ml-2 text-primary">
                      {Math.round(
                        (importProgress.done / importProgress.total) * 100,
                      )}
                      {"%"}
                    </span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-150"
                    style={{
                      width: `${Math.round((importProgress.done / importProgress.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* File queue */}
        <Card className="rounded border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Upload queue</CardTitle>
            <CardDescription>
              Cost-report PDFs staged for material order seeding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 pr-3">
              <div className="space-y-3">
                {!files.length ? (
                  <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No PDFs added yet.
                  </div>
                ) : (
                  files.map((f) => (
                    <div
                      key={`${f.name}-${f.size}`}
                      className="rounded border bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="rounded border bg-muted p-2 shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {f.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(f.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 rounded"
                          onClick={() => removeFile(f.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Import summary */}
      {importResult && (
        <Card className="rounded border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Import summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(importResult.summary).map(([k, v]) => (
                <MetricCard key={k} label={k.replace(/_/g, " ")} value={v} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="rounded border border-amber-200 bg-amber-50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <TriangleAlert className="h-4 w-4" />
              Parse warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-amber-700">
              {warnings.map((w, i) => (
                <li key={i}>&bull; {w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Preview: grouped by order */}
      {orders.length > 0 && !importResult && (
        <Card className="rounded border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">
              Preview{" "}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {orders.length} orders · {preview?.totalLines ?? 0} lines
              </span>
            </CardTitle>
            <CardDescription>
              Review detected orders before importing. Click{" "}
              <span className="font-medium text-foreground">
                Import to database
              </span>{" "}
              when ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-125">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">
                      Order No.
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Site</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Order Date
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Lines</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o, i) => (
                    <tr key={i} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-2 font-mono text-xs font-semibold">
                        {o.orderNumber ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <span className="font-mono">{o.siteCode}</span>
                        {o.siteName && (
                          <div className="text-muted-foreground">
                            {o.siteName}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {new Date(o.transactionDate).toLocaleDateString(
                          "en-ZA",
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-xs">
                        {o.lineCount}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs">
                        R
                        {Number(o.totalAmount).toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/30">
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-2 text-xs font-semibold text-muted-foreground"
                    >
                      GRAND TOTAL
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm font-bold">
                      R
                      {orders
                        .reduce((s, o) => s + Number(o.totalAmount), 0)
                        .toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Import results */}
      {results.length > 0 && (
        <Card className="rounded border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">
              Import results{" "}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {results.length} orders
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-125">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">
                      Order No.
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Site</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Order Date
                    </th>
                    <th className="px-4 py-2 text-right font-medium">Lines</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.map((r, i) => {
                    const statusInfo = MAT_STATUS_BADGE[r.status] ?? {
                      label: r.status,
                      variant: "secondary" as const,
                    };
                    return (
                      <tr
                        key={i}
                        className={cn(
                          "transition-colors",
                          r.status === "CREATED" && "bg-green-50/50",
                          r.status === "DUPLICATE" && "bg-muted/30",
                          (r.status === "MISSING_SITE" ||
                            r.status === "ERROR") &&
                            "bg-red-50/40",
                        )}
                      >
                        <td className="px-4 py-2 font-mono text-xs font-semibold">
                          {r.orderNumber ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          <span className="font-mono">{r.siteCode}</span>
                          {r.siteName && (
                            <div className="text-muted-foreground">
                              {r.siteName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {new Date(r.transactionDate).toLocaleDateString(
                            "en-ZA",
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-xs">
                          {r.linesCreated}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          R
                          {Number(r.totalAmount).toLocaleString("en-ZA", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-2">
                          <Badge
                            variant={statusInfo.variant}
                            className="rounded-full text-xs"
                          >
                            {statusInfo.label}
                          </Badge>
                          {r.reason && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {r.reason}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Historical Costs tab ─────────────────────────────────────────────────────

type CostPreviewRow = {
  fileName: string;
  siteCode: string;
  siteName: string | null;
  ledgerCode: string;
  category: string;
  description: string | null;
  transactionDate: string;
  externalRef: string | null;
  amount: string;
  parseWarning?: string;
};

type CostImportResult = {
  siteCode: string;
  ledgerCode: string;
  category: string;
  description: string | null;
  transactionDate: string;
  amount: string;
  status: string;
  reason?: string;
};

type ParseResponse = {
  action: "parse";
  totalRows: number;
  rowsByCategory: Record<string, number>;
  parseWarnings: string[];
  rows: CostPreviewRow[];
};

type ImportResponse = {
  action: "import";
  summary: Record<string, number>;
  totalProcessed: number;
  rowsByCategory: Record<string, number>;
  parseWarnings: string[];
  results: CostImportResult[];
};

const STATUS_BADGE: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  NEW_HISTORICAL: { label: "Imported", variant: "default" },
  DUPLICATE_IMPORTED: { label: "Already imported", variant: "secondary" },
  DUPLICATE_EXISTING_APP: { label: "App duplicate", variant: "outline" },
  DUPLICATE_ORDER: {
    label: "PO already imported",
    variant: "secondary",
  },
  MISSING_SITE: { label: "Missing site", variant: "destructive" },
  INVALID_ROW: { label: "Invalid", variant: "destructive" },
};

const CATEGORY_COLOURS: Record<string, string> = {
  LABOUR: "bg-blue-100 text-blue-800",
  MATERIAL: "bg-green-100 text-green-800",
  CONSUMABLE: "bg-teal-100 text-teal-800",
  PLANT: "bg-orange-100 text-orange-800",
  TOOLS: "bg-amber-100 text-amber-800",
  SAFETY: "bg-red-100 text-red-800",
  SCAFFOLDING: "bg-purple-100 text-purple-800",
  SUBCONTRACT: "bg-pink-100 text-pink-800",
  OTHER: "bg-gray-100 text-gray-700",
};

function HistoricalCostsTab() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [siteCodeOverride, setSiteCodeOverride] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [preview, setPreview] = useState<ParseResponse | null>(null);
  const [jobs, setJobs] = useState<ImportJobRow[]>([]);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );

    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}`));
      return [
        ...prev,
        ...incoming.filter((f) => !seen.has(`${f.name}-${f.size}`)),
      ];
    });

    setPreview(null);
    setJobs([]);
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setPreview(null);
    setJobs([]);
  }

  function clearAll() {
    setFiles([]);
    setPreview(null);
    setJobs([]);
    setSiteCodeOverride("");
  }

  useEffect(() => {
    if (!jobs.length) return;

    const hasActiveJobs = jobs.some((job) =>
      ["QUEUED", "PROCESSING"].includes(job.status),
    );

    if (!hasActiveJobs) return;

    const timer = window.setInterval(async () => {
      try {
        const ids = jobs.map((job) => job.id).join(",");
        const res = await fetch(`/api/admin/buildsmart/import-jobs?ids=${ids}`);

        if (!res.ok) return;

        const data = (await res.json()) as { jobs: ImportJobRow[] };

        setJobs((prev) => {
          const previousOrder = prev.map((job) => job.id);
          const latest = new Map(data.jobs.map((job) => [job.id, job]));

          return previousOrder
            .map((id) => latest.get(id))
            .filter(Boolean) as ImportJobRow[];
        });
      } catch {
        // silent polling failure
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [jobs]);

  async function callApi(action: "parse" | "import") {
    if (!files.length || isBusy) return;

    setIsBusy(true);

    if (action === "parse") {
      setPreview(null);
    }

    if (action === "import") {
      setJobs([]);
    }

    try {
      const fd = new FormData();
      fd.append("action", action);

      if (siteCodeOverride.trim()) {
        fd.append("siteCode", siteCodeOverride.trim());
      }

      for (const f of files) {
        fd.append("pdfs", f, f.name);
      }

      const res = await fetch("/api/admin/buildsmart/seed-historical-costs", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        throw new Error(await getResponseErrorMessage(res));
      }

      const data = await res.json();

      if (action === "parse") {
        setPreview(data as ParseResponse);
      } else {
        const queued = data as QueueResponse;
        setJobs(queued.jobs ?? []);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsBusy(false);
    }
  }

  const completedJobs = jobs.filter((job) => job.status === "COMPLETED");
  const failedJobs = jobs.filter((job) => job.status === "FAILED");
  const processingJobs = jobs.filter((job) => job.status === "PROCESSING");
  const queuedJobs = jobs.filter((job) => job.status === "QUEUED");

  const jobResults = completedJobs
    .map((job) => job.resultJson)
    .filter(Boolean) as any[];

  const importResults = jobResults.flatMap(
    (result) => (result.results ?? []) as CostImportResult[],
  );

  const previewRows = preview?.rows ?? [];
  const rows = importResults.length ? importResults : previewRows;

  const parseWarnings = [
    ...(preview?.parseWarnings ?? []),
    ...jobResults.flatMap((result) => result.parseWarnings ?? []),
  ];

  const combinedSummary = jobResults.reduce<Record<string, number>>(
    (acc, result) => {
      for (const [key, value] of Object.entries(result.summary ?? {})) {
        acc[key] = (acc[key] ?? 0) + Number(value ?? 0);
      }
      return acc;
    },
    {},
  );

  const importedCount = combinedSummary.NEW_HISTORICAL ?? 0;
  const duplicateImported = combinedSummary.DUPLICATE_IMPORTED ?? 0;
  const duplicateExisting = combinedSummary.DUPLICATE_EXISTING_APP ?? 0;
  const duplicateOrder = combinedSummary.DUPLICATE_ORDER ?? 0;
  const missingSite = combinedSummary.MISSING_SITE ?? 0;
  const invalidRow = combinedSummary.INVALID_ROW ?? 0;

  const isImportMode = jobs.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded border shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Historical Cost Import
                </CardTitle>
                <CardDescription className="mt-1 text-sm">
                  Upload BuildSmart &quot;Detail Contract Cost Report&quot; PDFs
                  for labour, plant, and other ledger lines. Rows tied to a PO
                  already imported via PDF Orders or Historical Materials are
                  skipped automatically.
                </CardDescription>
              </div>

              <Badge
                variant="secondary"
                className="rounded-full px-3 py-1 text-xs"
              >
                Historical costs
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
                if (e.dataTransfer.files?.length) {
                  addFiles(e.dataTransfer.files);
                }
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
                  <History className="h-8 w-8" />
                </div>

                <h3 className="text-lg font-medium">
                  Drop cost-report PDFs here
                </h3>

                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  Accepts BuildSmart{" "}
                  <span className="font-medium text-foreground">
                    Contract Cost Analysis
                  </span>{" "}
                  or{" "}
                  <span className="font-medium text-foreground">
                    Ledger Posting
                  </span>{" "}
                  reports. Not purchase-order PDFs.
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
                    disabled={!files.length && !jobs.length}
                    className="rounded"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>

                <input
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

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Site code override{" "}
                <span className="font-normal text-muted-foreground">
                  (only needed when the PDF has no contract header)
                </span>
              </label>

              <Input
                placeholder="e.g. 6537"
                value={siteCodeOverride}
                onChange={(e) => setSiteCodeOverride(e.target.value)}
                className="max-w-xs rounded"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => callApi("parse")}
                disabled={!files.length || isBusy}
                variant="outline"
                size="lg"
                className="rounded px-6"
              >
                {isBusy && !jobs.length ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Preview rows
              </Button>

              <Button
                onClick={() => callApi("import")}
                disabled={!files.length || isBusy}
                size="lg"
                className="rounded px-6"
              >
                {isBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {isBusy ? "Queueing import..." : "Import to database"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Upload queue</CardTitle>
            <CardDescription>PDFs staged for import.</CardDescription>
          </CardHeader>

          <CardContent>
            <ScrollArea className="h-96 pr-3">
              <div className="space-y-3">
                {!files.length ? (
                  <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No PDFs added yet.
                  </div>
                ) : (
                  files.map((f) => (
                    <div
                      key={`${f.name}-${f.size}`}
                      className="rounded border bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="shrink-0 rounded border bg-muted p-2">
                            <FileText className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {f.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(f.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 rounded"
                          onClick={() => removeFile(f.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {jobs.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Import summary</CardTitle>
              <CardDescription>
                Live summary from the historical cost import jobs.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard label="Queued" value={queuedJobs.length} />
                <MetricCard label="Processing" value={processingJobs.length} />
                <MetricCard label="Completed" value={completedJobs.length} />
                <MetricCard label="Failed" value={failedJobs.length} />
                <MetricCard label="Imported" value={importedCount} />
                <MetricCard
                  label="Duplicate imported"
                  value={duplicateImported}
                />
                <MetricCard label="Duplicate app" value={duplicateExisting} />
                <MetricCard label="Duplicate PO" value={duplicateOrder} />
                <MetricCard label="Missing site" value={missingSite} />
                <MetricCard label="Invalid rows" value={invalidRow} />
              </div>

              {parseWarnings.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                      <TriangleAlert className="h-4 w-4" />
                      Parse warnings
                    </div>

                    <ul className="space-y-1 text-sm text-amber-700">
                      {parseWarnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>&bull; {warning}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Import progress</CardTitle>
              <CardDescription>
                Live status of uploaded historical cost jobs.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {jobs.map((job) => {
                const progress = job.resultJson?.progress;
                const pct =
                  progress?.total && progress.total > 0
                    ? Math.round((progress.current / progress.total) * 100)
                    : job.status === "COMPLETED" || job.status === "FAILED"
                      ? 100
                      : job.status === "PROCESSING"
                        ? 50
                        : 10;

                return (
                  <div key={job.id} className="rounded border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {job.fileName}
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          {progress?.message ??
                            (job.status === "QUEUED"
                              ? "Waiting to start"
                              : job.status === "PROCESSING"
                                ? "Processing PDF"
                                : job.status === "COMPLETED"
                                  ? "Completed"
                                  : "Failed")}
                        </div>

                        {job.error && (
                          <div className="mt-2 text-xs text-destructive">
                            {job.error}
                          </div>
                        )}
                      </div>

                      <Badge
                        variant={
                          job.status === "FAILED"
                            ? "destructive"
                            : job.status === "COMPLETED"
                              ? "default"
                              : "secondary"
                        }
                        className="shrink-0 rounded-full"
                      >
                        {job.status}
                      </Badge>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>{pct}%</span>
                      {progress && (
                        <span>
                          {progress.current} / {progress.total}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {parseWarnings.length > 0 && !jobs.length && (
        <Card className="rounded border border-amber-200 bg-amber-50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <TriangleAlert className="h-4 w-4" />
              Parse warnings
            </CardTitle>
          </CardHeader>

          <CardContent>
            <ul className="space-y-1 text-sm text-amber-700">
              {parseWarnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>&bull; {warning}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="rounded border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">
              {isImportMode ? "Import results" : "Preview"}{" "}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {rows.length} rows
              </span>
            </CardTitle>

            {!isImportMode && (
              <CardDescription>
                Review parsed rows before importing. Click{" "}
                <span className="font-medium text-foreground">
                  Import to database
                </span>{" "}
                when ready.
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="p-0">
            <ScrollArea className="h-125">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Site</th>
                    <th className="px-4 py-2 text-left font-medium">Ledger</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Category
                    </th>
                    <th className="px-4 py-2 text-left font-medium">
                      Description
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    {isImportMode && (
                      <th className="px-4 py-2 text-left font-medium">
                        Status
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {rows.map((r, i) => {
                    const row = r as CostPreviewRow & Partial<CostImportResult>;
                    const statusInfo = isImportMode
                      ? (STATUS_BADGE[row.status ?? ""] ?? {
                          label: row.status ?? "",
                          variant: "secondary" as const,
                        })
                      : null;

                    return (
                      <tr
                        key={i}
                        className={cn(
                          "transition-colors",
                          isImportMode &&
                            row.status === "NEW_HISTORICAL" &&
                            "bg-green-50/50",
                          isImportMode &&
                            row.status === "DUPLICATE_IMPORTED" &&
                            "bg-muted/30",
                          isImportMode &&
                            (row.status === "MISSING_SITE" ||
                              row.status === "INVALID_ROW") &&
                            "bg-red-50/40",
                        )}
                      >
                        <td className="px-4 py-2 font-mono text-xs">
                          {row.siteCode}
                          {row.siteName && (
                            <div className="text-muted-foreground">
                              {row.siteName}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-2 font-mono text-xs">
                          {row.ledgerCode}
                        </td>

                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "inline-block rounded px-2 py-0.5 text-xs font-medium",
                              CATEGORY_COLOURS[row.category] ??
                                "bg-gray-100 text-gray-700",
                            )}
                          >
                            {row.category}
                          </span>
                        </td>

                        <td className="max-w-50 truncate px-4 py-2 text-xs text-muted-foreground">
                          {row.description ?? "—"}
                          {row.parseWarning && (
                            <div className="text-amber-600">
                              {row.parseWarning}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-2 text-xs">
                          {row.transactionDate
                            ? new Date(row.transactionDate).toLocaleDateString(
                                "en-ZA",
                              )
                            : "—"}
                        </td>

                        <td className="px-4 py-2 text-right font-mono text-xs">
                          R
                          {Number(row.amount).toLocaleString("en-ZA", {
                            minimumFractionDigits: 2,
                          })}
                        </td>

                        {isImportMode && (
                          <td className="px-4 py-2">
                            <Badge
                              variant={statusInfo?.variant}
                              className="rounded-full text-xs"
                            >
                              {statusInfo?.label}
                            </Badge>

                            {row.reason && row.reason !== statusInfo?.label && (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {row.reason}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot className="border-t-2 border-border bg-muted/30">
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-2 text-xs font-semibold text-muted-foreground"
                    >
                      GRAND TOTAL
                    </td>

                    <td className="px-4 py-2 text-right font-mono text-sm font-bold">
                      R
                      {rows
                        .reduce((s, r) => s + Number((r as any).amount ?? 0), 0)
                        .toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </td>

                    {isImportMode && <td />}
                  </tr>
                </tfoot>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Claims tab ───────────────────────────────────────────────────────────────

type ClaimRow = {
  fileName: string;
  siteCode: string;
  siteName: string | null;
  claimDate: string;
  amountClaimed: number;
  amountReceived: number;
  outstanding: number;
  claimStatus: "SUBMITTED" | "PARTIALLY_RECEIVED" | "RECEIVED";
  dbAction: "CREATE" | "UPDATE";
  parseWarning?: string;
};

type ClaimParseResponse = {
  action: "parse";
  claims: ClaimRow[];
  parseErrors: { fileName: string; error: string }[];
  missingSiteErrors: { fileName: string; siteCode: string; error: string }[];
};

type ClaimImportResult = ClaimRow & {
  importStatus: "CREATED" | "UPDATED" | "ERROR";
  importError?: string;
};

type ClaimImportResponse = {
  action: "import";
  results: ClaimImportResult[];
  parseErrors: { fileName: string; error: string }[];
  missingSiteErrors: { fileName: string; siteCode: string; error: string }[];
};

const CLAIM_STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  SUBMITTED: { label: "Submitted", variant: "secondary" },
  PARTIALLY_RECEIVED: { label: "Partial", variant: "outline" },
  RECEIVED: { label: "Received", variant: "default" },
};

const IMPORT_STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  CREATED: { label: "Created", variant: "default" },
  UPDATED: { label: "Updated", variant: "secondary" },
  ERROR: { label: "Error", variant: "destructive" },
};

function fmt(n: number) {
  return n.toLocaleString("en-ZA", { minimumFractionDigits: 2 });
}

function ClaimsTab() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [preview, setPreview] = useState<ClaimParseResponse | null>(null);
  const [importResult, setImportResult] = useState<ClaimImportResponse | null>(
    null,
  );

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}`));
      return [
        ...prev,
        ...incoming.filter((f) => !seen.has(`${f.name}-${f.size}`)),
      ];
    });
    setPreview(null);
    setImportResult(null);
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setPreview(null);
    setImportResult(null);
  }

  async function callApi(action: "parse" | "import") {
    if (!files.length || isBusy) return;
    setIsBusy(true);
    if (action === "parse") setImportResult(null);

    try {
      const fd = new FormData();
      fd.append("action", action);
      for (const f of files) fd.append("pdfs", f, f.name);

      const res = await fetch("/api/admin/buildsmart/seed-claims", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      if (action === "parse") setPreview(data as ClaimParseResponse);
      else setImportResult(data as ClaimImportResponse);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsBusy(false);
    }
  }

  const claims = importResult?.results ?? preview?.claims ?? [];
  const allErrors = [
    ...(importResult?.parseErrors ?? preview?.parseErrors ?? []),
    ...(importResult?.missingSiteErrors ?? preview?.missingSiteErrors ?? []),
  ];
  const isResult = importResult !== null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Upload card */}
        <Card className="rounded border shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Claim Seeder
                </CardTitle>
                <CardDescription className="mt-1 text-sm">
                  Drop the latest monthly claim PDF for each site. One record
                  per site is created or updated with the cumulative claim total
                  and paid-to-date amount.
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className="rounded-full px-3 py-1 text-xs"
              >
                Claims
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
                  <Receipt className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium">Drop claim PDFs here</h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  FCP monthly claim letters sent to clients. Site code is read
                  from the{" "}
                  <span className="font-medium text-foreground">
                    FCP - XXXX
                  </span>{" "}
                  reference. Drop multiple PDFs to seed several sites at once —
                  if you drop multiple months for one site, the most recent is
                  used.
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
                    onClick={() => {
                      setFiles([]);
                      setPreview(null);
                      setImportResult(null);
                    }}
                    disabled={!files.length}
                    className="rounded"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
                <input
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

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => callApi("parse")}
                disabled={!files.length || isBusy}
                variant="outline"
                size="lg"
                className="rounded px-6"
              >
                {isBusy && !importResult ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Preview claims
              </Button>
              <Button
                onClick={() => callApi("import")}
                disabled={!files.length || isBusy || !preview}
                size="lg"
                className="rounded px-6"
              >
                {isBusy && !!importResult ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Save to database
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* File queue */}
        <Card className="rounded border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Upload queue</CardTitle>
            <CardDescription>Claim PDFs staged for import.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 pr-3">
              <div className="space-y-3">
                {!files.length ? (
                  <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No PDFs added yet.
                  </div>
                ) : (
                  files.map((f) => (
                    <div
                      key={`${f.name}-${f.size}`}
                      className="rounded border bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="rounded border bg-muted p-2 shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {f.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(f.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 rounded"
                          onClick={() => removeFile(f.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Parse errors */}
      {allErrors.length > 0 && (
        <Card className="rounded border border-amber-200 bg-amber-50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <TriangleAlert className="h-4 w-4" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-amber-700">
              {allErrors.map((e, i) => (
                <li key={i}>
                  <span className="font-medium">{e.fileName}</span>
                  {" — "}
                  {e.error}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Claims table */}
      {claims.length > 0 && (
        <Card className="rounded border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">
              {isResult ? "Import results" : "Preview"}{" "}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {claims.length} {claims.length === 1 ? "site" : "sites"}
              </span>
            </CardTitle>
            {!isResult && (
              <CardDescription>
                Review before saving. If multiple PDFs were dropped for the same
                site, only the most recent is shown.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-125">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Site</th>
                    <th className="px-4 py-2 text-left font-medium">
                      Claim Date
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      Total Claimed
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      Paid to Date
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      Outstanding
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    {isResult && (
                      <th className="px-4 py-2 text-left font-medium">
                        Result
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {claims.map((c, i) => {
                    const row = c as ClaimRow & Partial<ClaimImportResult>;
                    const statusInfo = CLAIM_STATUS_BADGE[row.claimStatus] ?? {
                      label: row.claimStatus,
                      variant: "secondary" as const,
                    };
                    const importInfo =
                      isResult && row.importStatus
                        ? (IMPORT_STATUS_BADGE[row.importStatus] ?? {
                            label: row.importStatus,
                            variant: "secondary" as const,
                          })
                        : null;
                    return (
                      <tr
                        key={i}
                        className={cn(
                          "transition-colors",
                          isResult &&
                            row.importStatus === "CREATED" &&
                            "bg-green-50/50",
                          isResult &&
                            row.importStatus === "UPDATED" &&
                            "bg-blue-50/30",
                          isResult &&
                            row.importStatus === "ERROR" &&
                            "bg-red-50/40",
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-semibold">
                            {row.siteCode}
                          </div>
                          {row.siteName && (
                            <div className="text-xs text-muted-foreground">
                              {row.siteName}
                            </div>
                          )}
                          {!isResult && (
                            <Badge
                              variant={
                                row.dbAction === "CREATE"
                                  ? "default"
                                  : "secondary"
                              }
                              className="mt-1 rounded-full px-1.5 py-0 text-[10px]"
                            >
                              {row.dbAction}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {new Date(row.claimDate).toLocaleDateString("en-ZA")}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          R{fmt(row.amountClaimed)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          R{fmt(row.amountReceived)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                          R{fmt(row.outstanding)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={statusInfo.variant}
                            className="rounded-full text-xs"
                          >
                            {statusInfo.label}
                          </Badge>
                          {row.parseWarning && (
                            <div className="mt-0.5 text-[11px] text-amber-600">
                              {row.parseWarning}
                            </div>
                          )}
                        </td>
                        {isResult && (
                          <td className="px-4 py-3">
                            {importInfo && (
                              <Badge
                                variant={importInfo.variant}
                                className="rounded-full text-xs"
                              >
                                {importInfo.label}
                              </Badge>
                            )}
                            {row.importError && (
                              <div className="mt-0.5 text-xs text-destructive">
                                {row.importError}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/30">
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-2 text-xs font-semibold text-muted-foreground"
                    >
                      TOTALS
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm font-bold">
                      R{fmt(claims.reduce((s, c) => s + c.amountClaimed, 0))}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm font-bold">
                      R{fmt(claims.reduce((s, c) => s + c.amountReceived, 0))}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-sm font-bold">
                      R{fmt(claims.reduce((s, c) => s + c.outstanding, 0))}
                    </td>
                    <td colSpan={isResult ? 2 : 1} />
                  </tr>
                </tfoot>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
