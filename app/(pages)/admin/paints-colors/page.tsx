"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Trash2,
  Edit,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Upload,
  Loader2,
  FileText,
  Play,
  Save,
  AlertTriangle,
  Palette,
  ListChecks,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { ColorBaseType } from "@/generated/prisma/client";

/* ── Types ────────────────────────────────────────────────────────── */

type DedupColor = {
  colorName: string;
  baseType: ColorBaseType;
  colorCode: string | null;
  isTinted: boolean;
  supplier: { id: string; name: string } | null;
  products: {
    id: string;
    name: string;
    sku: string | null;
    category: { id: string; name: string } | null;
  }[];
  productCount: number;
};

const BASE_TYPE_LABELS: Record<ColorBaseType, string> = {
  DEEP: "Deep Base",
  PASTEL: "T/Base Pastel",
  WHITE: "White Base",
  CLEAR: "Clear Base",
  NEUTRAL: "",
};

const BASE_TYPE_COLORS: Record<ColorBaseType, string> = {
  DEEP: "bg-blue-100 text-blue-800",
  PASTEL: "bg-pink-100 text-pink-800",
  WHITE: "bg-gray-100 text-gray-800",
  CLEAR: "bg-cyan-100 text-cyan-800",
  NEUTRAL: "bg-yellow-100 text-yellow-800",
};

/* ── Local Text Component ────────────────────────────────────────── */

function Text(
  props: React.HTMLAttributes<HTMLSpanElement> & {
    children?: React.ReactNode;
  },
) {
  const { children, className, ...rest } = props;
  return (
    <span className={className} {...rest}>
      {children}
    </span>
  );
}

function ColorSwatch({ colorCode }: { colorCode: string | null }) {
  const backgroundColor = colorCode || "transparent";

  return (
    <span
      className="h-5 w-5 shrink-0 rounded border border-border bg-muted"
      style={{ backgroundColor }}
    />
  );
}

function colorDisplayName(colorName: string, colorCode: string | null) {
  const name = colorName.trim().toUpperCase();
  const code = colorCode?.trim().toUpperCase();
  if (!code || name.includes(code)) return name;
  return `${name} ${code}`;
}

function isUnspecifiedBase(baseType: ColorBaseType, colorCode: string | null) {
  return (
    baseType === "NEUTRAL" ||
    (baseType === "DEEP" &&
      !!colorCode?.match(/^\d{1,2}[A-Z]{1,3}\d{1,3}\/\d{1,4}$/i))
  );
}

function BaseBadge({
  baseType,
  colorCode,
}: {
  baseType: ColorBaseType;
  colorCode: string | null;
}) {
  const label = isUnspecifiedBase(baseType, colorCode)
    ? ""
    : BASE_TYPE_LABELS[baseType];
  if (!label) return <Text className="text-muted-foreground">&nbsp;</Text>;
  return (
    <Badge className={`${BASE_TYPE_COLORS[baseType]} font-medium`}>
      <Text>{label}</Text>
    </Badge>
  );
}

/* ── Page wrapper with tabs ─────────────────────────────────────── */

export default function PaintColorsAdminPage() {
  return (
    <div className="flex flex-col h-full p-6 bg-background">
      <Tabs defaultValue="list" className="w-full">
        <TabsContent value="list">
          <PaintColorsListTab
            tabsList={
              <PaintColorsTabsList />
            }
          />
        </TabsContent>
        <TabsContent value="seed">
          <SeedFromPdfsTab
            tabsList={
              <PaintColorsTabsList />
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function interleaveColorsBySupplier(colors: DedupColor[]) {
  const buckets = new Map<string, DedupColor[]>();
  for (const color of colors) {
    const supplier = color.supplier?.name ?? "Unassigned";
    const bucket = buckets.get(supplier) ?? [];
    bucket.push(color);
    buckets.set(supplier, bucket);
  }

  const suppliers = Array.from(buckets.keys()).sort((a, b) =>
    a.localeCompare(b),
  );
  const result: DedupColor[] = [];
  let index = 0;

  while (result.length < colors.length) {
    let added = false;
    for (const supplier of suppliers) {
      const color = buckets.get(supplier)?.[index];
      if (color) {
        result.push(color);
        added = true;
      }
    }
    if (!added) break;
    index += 1;
  }

  return result;
}

function PaintColorsTabsList() {
  return (
    <TabsList className="rounded border bg-muted/40 p-1">
      <TabsTrigger value="list" className="rounded">
        <ListChecks className="mr-2 h-4 w-4" />
        Colour List
      </TabsTrigger>
      <TabsTrigger value="seed" className="rounded">
        <Upload className="mr-2 h-4 w-4" />
        Seed from PDFs
      </TabsTrigger>
    </TabsList>
  );
}

/* ── List tab ────────────────────────────────────────────────────── */

function PaintColorsListTab({ tabsList }: { tabsList: React.ReactNode }) {
  const [colors, setColors] = useState<DedupColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  // Fetch deduplicated colors
  useEffect(() => {
    const fetchColors = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/procurement-products/colors/dedup");
        if (!res.ok) throw new Error("Failed to fetch colors");
        const data = await res.json();
        setColors(data || []);
      } catch (error) {
        console.error("Error fetching colors:", error);
        toast.error("Failed to load colors");
      } finally {
        setLoading(false);
      }
    };
    fetchColors();
  }, []);

  const supplierOptions = Array.from(
    new Set(colors.map((c) => c.supplier?.name).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));

  // Filter colors by search and main supplier
  const filtered = colors.filter((c) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      c.colorName.toLowerCase().includes(searchLower) ||
      (c.colorCode && c.colorCode.toLowerCase().includes(searchLower)) ||
      c.baseType.toLowerCase().includes(searchLower) ||
      (c.supplier?.name && c.supplier.name.toLowerCase().includes(searchLower));
    const matchesSupplier =
      supplierFilter === "all" || c.supplier?.name === supplierFilter;

    return matchesSearch && matchesSupplier;
  });

  const displayColors =
    supplierFilter === "all" ? interleaveColorsBySupplier(filtered) : filtered;

  const pageCount = Math.max(
    1,
    Math.ceil(displayColors.length / pagination.pageSize),
  );
  const currentPageIndex = Math.min(pagination.pageIndex, pageCount - 1);
  const pageStart = currentPageIndex * pagination.pageSize;
  const pageEnd = Math.min(pageStart + pagination.pageSize, displayColors.length);
  const paginatedColors = displayColors.slice(pageStart, pageEnd);

  // Delete color (all variants with this colorName + baseType)
  const handleDelete = async (colorName: string, baseType: ColorBaseType) => {
    if (deleting) return;
    if (!confirm(`Delete color "${colorName}" (${baseType})?`)) return;

    try {
      setDeleting(`${colorName}||${baseType}`);
      const res = await fetch(
        `/api/admin/procurement-products/colors?colorName=${encodeURIComponent(colorName)}&baseType=${encodeURIComponent(baseType)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete color");
      setColors(
        colors.filter(
          (c) => !(c.colorName === colorName && c.baseType === baseType),
        ),
      );
      toast.success(`Deleted "${colorName}"`);
    } catch (error) {
      console.error("Error deleting color:", error);
      toast.error("Failed to delete color");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            <Text>Paint Colors</Text>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <Text>Manage available paint colors and bases</Text>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {tabsList}
          <Link href="/admin/paints-colors/create">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              <Text>New Color</Text>
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by color name, code, base, or supplier..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          className="max-w-md"
        />
        <Select
          value={supplierFilter}
          onValueChange={(value) => {
            setSupplierFilter(value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="w-55">
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {supplierOptions.map((supplier) => (
              <SelectItem key={supplier} value={supplier}>
                {supplier}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Text>Loading colors...</Text>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Text>
              {search ? "No colors match your search" : "No colors created yet"}
            </Text>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 border-b border-r border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Text>Color</Text>
                    </TableHead>
                    <TableHead className="h-8 border-b border-r border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Text>Base</Text>
                    </TableHead>
                    <TableHead className="h-8 border-b border-r border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Text>Supplier</Text>
                    </TableHead>
                    <TableHead className="h-8 border-b border-border px-3 py-1 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Text>Actions</Text>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedColors.map((color) => {
                    const key = `${color.colorName}||${color.baseType}`;
                    const isDeleting = deleting === key;
                    return (
                      <TableRow
                        key={key}
                        className="border-b border-border/70 transition-colors last:border-b-0 hover:bg-muted/35"
                      >
                        {/* Color Name */}
                        <TableCell className="border-r border-border px-3 py-1.5 align-middle">
                          <div className="flex items-center gap-2">
                            <ColorSwatch colorCode={color.colorCode} />
                            <Text className="font-medium text-foreground">
                              {colorDisplayName(
                                color.colorName,
                                color.colorCode,
                              )}
                            </Text>
                            {color.isTinted && (
                              <Badge
                                variant="secondary"
                                className="h-5 text-[10px]"
                              >
                                <Text>Tinted</Text>
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Base Type */}
                        <TableCell className="border-r border-border px-3 py-1.5 align-middle">
                          <BaseBadge
                            baseType={color.baseType}
                            colorCode={color.colorCode}
                          />
                        </TableCell>

                        {/* Supplier */}
                        <TableCell className="border-r border-border px-3 py-1.5 align-middle">
                          <Text className="text-foreground">
                            {color.supplier?.name || "—"}
                          </Text>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="px-3 py-1.5 text-right align-middle">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                disabled={isDeleting}
                              >
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">
                                  <Text>Open menu</Text>
                                </span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/admin/paints-colors/${encodeURIComponent(key)}`}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  <Text>Edit</Text>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleDelete(color.colorName, color.baseType)
                                }
                                disabled={isDeleting}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <Text>
                                  {isDeleting ? "Deleting..." : "Delete"}
                                </Text>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
              <div className="hidden text-sm text-muted-foreground lg:flex">
                <Text>
                  Showing {filtered.length === 0 ? 0 : pageStart + 1} to{" "}
                  {pageEnd} of {filtered.length} colors
                </Text>
              </div>
              <div className="flex items-center gap-6 lg:gap-8">
                <div className="hidden items-center gap-2 lg:flex">
                  <span className="text-sm font-medium">
                    <Text>Rows per page</Text>
                  </span>
                  <Select
                    value={String(pagination.pageSize)}
                    onValueChange={(value) => {
                      setPagination({ pageIndex: 0, pageSize: Number(value) });
                    }}
                  >
                    <SelectTrigger className="h-8 w-20">
                      <SelectValue placeholder={pagination.pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[5, 10, 25, 50, 100].map((pageSize) => (
                        <SelectItem key={pageSize} value={String(pageSize)}>
                          {pageSize}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-fit items-center justify-center text-sm font-medium">
                  <Text>
                    Page {currentPageIndex + 1} of {pageCount}
                  </Text>
                </div>
                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="hidden h-8 w-8 lg:flex"
                    onClick={() =>
                      setPagination((p) => ({ ...p, pageIndex: 0 }))
                    }
                    disabled={currentPageIndex === 0}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setPagination((p) => ({
                        ...p,
                        pageIndex: Math.max(0, currentPageIndex - 1),
                      }))
                    }
                    disabled={currentPageIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setPagination((p) => ({
                        ...p,
                        pageIndex: Math.min(
                          pageCount - 1,
                          currentPageIndex + 1,
                        ),
                      }))
                    }
                    disabled={currentPageIndex >= pageCount - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="hidden h-8 w-8 lg:flex"
                    onClick={() =>
                      setPagination((p) => ({
                        ...p,
                        pageIndex: pageCount - 1,
                      }))
                    }
                    disabled={currentPageIndex >= pageCount - 1}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Seed from PDFs tab ──────────────────────────────────────────── */

type PendingFile = { id: string; file: File };

type ParsedColorPreview = {
  colorName: string;
  baseType: ColorBaseType;
  colorCode: string | null;
  isTinted: boolean;
  suppliers: string[];
  sourceCount: number;
  examples: string[];
};

type ParsedSupplierPreview = {
  normalisedName: string;
  rawNames: string[];
  vendorCode: string | null;
};

type ParsedPricePreview = {
  brand: "PLASCON" | "DULUX";
  productCode: string | null;
  productLabel: string;
  baseType: ColorBaseType;
  unitSizeL: number | null;
  priceZar: number | null;
  sourceFile: string;
};

type ParseResponse = {
  action: "parse";
  summary: {
    orderPdfs: number;
    priceListPdfs: number;
    extractedColors: number;
    uniqueColors: number;
    suppliersDetected: number;
    priceRows: number;
    parseFailures: number;
  };
  colors: ParsedColorPreview[];
  suppliers: ParsedSupplierPreview[];
  prices: ParsedPricePreview[];
  parseFailures: { fileName: string; reason: string }[];
};

type ImportResponse = {
  action: "import";
  summary: {
    orderPdfs: number;
    priceListPdfs: number;
    uniqueColors: number;
    variantsCreated: number;
    variantsSkipped: number;
    suppliersTouched: number;
    orderPriceLinksCreated: number;
    priceListRows: number;
    priceListImported: number;
    priceListUnmatched: number;
    priceListDuplicateMatches?: number;
    parseFailures: number;
  };
  createdVariants: { colorName: string; baseType: ColorBaseType; id: string }[];
  skippedVariants: {
    colorName: string;
    baseType: ColorBaseType;
    reason: string;
  }[];
  parseFailures: { fileName: string; reason: string }[];
  unmatchedPriceLabels: string[];
};

type ImportProgress = {
  done: number;
  total: number;
  phase: string;
  message: string;
  log: string[];
};

type SeederBatch = {
  orderFile?: PendingFile;
  priceFile?: PendingFile;
};

function SeedFromPdfsTab({ tabsList }: { tabsList: React.ReactNode }) {
  const orderInputRef = useRef<HTMLInputElement | null>(null);
  const priceInputRef = useRef<HTMLInputElement | null>(null);
  const [orderFiles, setOrderFiles] = useState<PendingFile[]>([]);
  const [priceFiles, setPriceFiles] = useState<PendingFile[]>([]);
  const [dragActive, setDragActive] = useState<"" | "orders" | "prices">("");
  const [busy, setBusy] = useState<"" | "parsing" | "importing">("");
  const [preview, setPreview] = useState<ParseResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  function addOrderFiles(list: FileList | File[]) {
    const accepted = Array.from(list).filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    setOrderFiles((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      for (const f of accepted) {
        const id = `${f.name}-${f.size}-${f.lastModified}`;
        if (!seen.has(id)) merged.push({ id, file: f });
      }
      return merged;
    });
    setPreview(null);
    setImportResult(null);
  }

  function addPriceFiles(list: FileList | File[]) {
    const accepted = Array.from(list).filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    setPriceFiles((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      for (const f of accepted) {
        const id = `${f.name}-${f.size}-${f.lastModified}`;
        if (!seen.has(id)) merged.push({ id, file: f });
      }
      return merged;
    });
    setPreview(null);
    setImportResult(null);
  }

  function handleDragEnter(
    e: React.DragEvent<HTMLElement>,
    target: "orders" | "prices",
  ) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(target);
  }

  function handleDragOver(
    e: React.DragEvent<HTMLElement>,
    target: "orders" | "prices",
  ) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDragActive(target);
  }

  function handleDragLeave(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    const nextTarget = e.relatedTarget as Node | null;
    if (nextTarget && e.currentTarget.contains(nextTarget)) return;
    setDragActive("");
  }

  function handleDrop(
    e: React.DragEvent<HTMLElement>,
    target: "orders" | "prices",
  ) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive("");
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    if (target === "orders") addOrderFiles(files);
    else addPriceFiles(files);
  }

  function removeOrderFile(id: string) {
    setOrderFiles((prev) => prev.filter((f) => f.id !== id));
    setPreview(null);
    setImportResult(null);
  }
  function removePriceFile(id: string) {
    setPriceFiles((prev) => prev.filter((f) => f.id !== id));
    setPreview(null);
    setImportResult(null);
  }
  function clearAll() {
    setOrderFiles([]);
    setPriceFiles([]);
    setPreview(null);
    setImportResult(null);
  }

  async function postSeederBatch(
    action: "parse" | "import",
    batch: SeederBatch,
  ) {
    const fd = new FormData();
    fd.append("action", action);
    if (batch.orderFile) {
      fd.append("pdfs", batch.orderFile.file, batch.orderFile.file.name);
    }
    if (batch.priceFile) {
      fd.append("priceList", batch.priceFile.file, batch.priceFile.file.name);
    }

    const res = await fetch("/api/admin/paints-colors/seed-from-pdfs", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let message = text;
      try {
        message = JSON.parse(text).error ?? text;
      } catch {
        // Netlify/platform errors often arrive as plain text or HTML.
      }
      throw new Error(message || `Request failed (${res.status})`);
    }

    return res;
  }

  function mergeParseResponses(responses: ParseResponse[]): ParseResponse {
    const colorMap = new Map<string, ParsedColorPreview>();
    const supplierMap = new Map<string, ParsedSupplierPreview>();

    for (const response of responses) {
      for (const color of response.colors) {
        const key = `${color.colorName.trim().toLowerCase()}||${color.baseType}`;
        const existing = colorMap.get(key);
        if (!existing) {
          colorMap.set(key, {
            ...color,
            suppliers: [...color.suppliers],
            examples: [...color.examples],
          });
        } else {
          if (!existing.colorCode && color.colorCode) existing.colorCode = color.colorCode;
          if (color.isTinted) existing.isTinted = true;
          existing.sourceCount += color.sourceCount;
          existing.suppliers = Array.from(new Set([...existing.suppliers, ...color.suppliers]));
          existing.examples = Array.from(new Set([...existing.examples, ...color.examples])).slice(0, 3);
        }
      }

      for (const supplier of response.suppliers) {
        const existing = supplierMap.get(supplier.normalisedName);
        if (!existing) {
          supplierMap.set(supplier.normalisedName, {
            ...supplier,
            rawNames: [...supplier.rawNames],
          });
        } else {
          existing.rawNames = Array.from(new Set([...existing.rawNames, ...supplier.rawNames]));
          if (!existing.vendorCode && supplier.vendorCode) existing.vendorCode = supplier.vendorCode;
        }
      }
    }

    const colors = Array.from(colorMap.values());
    const suppliers = Array.from(supplierMap.values());
    const prices = responses.flatMap((r) => r.prices);
    const parseFailures = responses.flatMap((r) => r.parseFailures);

    return {
      action: "parse",
      summary: {
        orderPdfs: orderFiles.length,
        priceListPdfs: priceFiles.length,
        extractedColors: responses.reduce((n, r) => n + r.summary.extractedColors, 0),
        uniqueColors: colors.length,
        suppliersDetected: suppliers.length,
        priceRows: prices.length,
        parseFailures: parseFailures.length,
      },
      colors,
      suppliers,
      prices,
      parseFailures,
    };
  }

  async function readImportDone(res: Response): Promise<ImportResponse> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Import response stream unavailable");
    const decoder = new TextDecoder();
    let buffer = "";
    let result: ImportResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "done") result = event as ImportResponse;
        if (event.type === "error") throw new Error(event.error);
      }
    }

    if (!result) throw new Error("No import result returned");
    return result;
  }

  function mergeImportResponses(responses: ImportResponse[]): ImportResponse {
    const parseFailures = responses.flatMap((r) => r.parseFailures);
    return {
      action: "import",
      summary: {
        orderPdfs: orderFiles.length,
        priceListPdfs: priceFiles.length,
        uniqueColors: preview?.summary.uniqueColors ?? 0,
        variantsCreated: responses.reduce((n, r) => n + r.summary.variantsCreated, 0),
        variantsSkipped: responses.reduce((n, r) => n + r.summary.variantsSkipped, 0),
        suppliersTouched: responses.reduce((n, r) => n + r.summary.suppliersTouched, 0),
        orderPriceLinksCreated: responses.reduce((n, r) => n + r.summary.orderPriceLinksCreated, 0),
        priceListRows: responses.reduce((n, r) => n + r.summary.priceListRows, 0),
        priceListImported: responses.reduce((n, r) => n + r.summary.priceListImported, 0),
        priceListUnmatched: responses.reduce((n, r) => n + r.summary.priceListUnmatched, 0),
        priceListDuplicateMatches: responses.reduce(
          (n, r) => n + (r.summary.priceListDuplicateMatches ?? 0),
          0,
        ),
        parseFailures: parseFailures.length,
      },
      createdVariants: responses.flatMap((r) => r.createdVariants),
      skippedVariants: responses.flatMap((r) => r.skippedVariants),
      parseFailures,
      unmatchedPriceLabels: Array.from(new Set(responses.flatMap((r) => r.unmatchedPriceLabels))),
    };
  }

  async function callApiBatched(action: "parse" | "import") {
    const batches: SeederBatch[] = [
      ...orderFiles.map((orderFile) => ({ orderFile })),
      ...priceFiles.map((priceFile) => ({ priceFile })),
    ];

    setBusy(action === "parse" ? "parsing" : "importing");
    try {
      if (action === "parse") {
        const responses: ParseResponse[] = [];
        for (const batch of batches) {
          const res = await postSeederBatch("parse", batch);
          responses.push((await res.json()) as ParseResponse);
        }
        const merged = mergeParseResponses(responses);
        setPreview(merged);
        setImportResult(null);
        toast.success(
          `Parsed ${merged.summary.uniqueColors} unique colours from ${merged.summary.orderPdfs} PDF(s)`,
        );
      } else {
        setProgress({
          done: 0,
          total: batches.length,
          phase: "uploading",
          message: "Uploading PDFs one at a time...",
          log: [],
        });
        const responses: ImportResponse[] = [];
        for (let i = 0; i < batches.length; i++) {
          const file = batches[i].orderFile?.file ?? batches[i].priceFile?.file;
          setProgress((current) => ({
            done: i,
            total: batches.length,
            phase: "uploading",
            message: `Uploading ${file?.name ?? `PDF ${i + 1}`}`,
            log: current?.log ?? [],
          }));
          const res = await postSeederBatch("import", batches[i]);
          responses.push(await readImportDone(res));
        }
        const merged = mergeImportResponses(responses);
        setImportResult(merged);
        setProgress((current) =>
          current
            ? { ...current, done: batches.length, message: "Import complete" }
            : current,
        );
        toast.success(`Saved ${merged.summary.variantsCreated} new colour variants`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy("");
    }
  }

  async function callApi(action: "parse" | "import") {
    if (!orderFiles.length && !priceFiles.length) {
      toast.error("Add at least one PDF first");
      return;
    }
    if (action === "import" && !preview) {
      toast.error("Run Parse before Save");
      return;
    }
    if (orderFiles.length + priceFiles.length > 1) {
      await callApiBatched(action);
      return;
    }
    setBusy(action === "parse" ? "parsing" : "importing");
    if (action === "import") {
      setProgress({
        done: 0,
        total: 0,
        phase: "starting",
        message: "Starting…",
        log: [],
      });
      setImportResult(null);
    }
    try {
      const fd = new FormData();
      fd.append("action", action);
      for (const f of orderFiles) fd.append("pdfs", f.file, f.file.name);
      for (const f of priceFiles) fd.append("priceList", f.file, f.file.name);

      const res = await fetch("/api/admin/paints-colors/seed-from-pdfs", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = text;
        try {
          message = JSON.parse(text).error ?? text;
        } catch {
          // Platform errors may not be JSON.
        }
        throw new Error(message || `Request failed (${res.status})`);
      }

      if (action === "parse") {
        const data = await res.json();
        setPreview(data as ParseResponse);
        setImportResult(null);
        toast.success(
          `Parsed ${data.summary.uniqueColors} unique colours from ${data.summary.orderPdfs} PDF(s)`,
        );
      } else {
        // Stream NDJSON progress events
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const logLines: string[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop()!;
          for (const line of lines) {
            if (!line.trim()) continue;
            let event: any;
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }
            if (event.type === "start") {
              setProgress({
                done: 0,
                total: event.total,
                phase: "starting",
                message: `Total ${event.total} steps`,
                log: [],
              });
            } else if (event.type === "progress") {
              const logEntry = `[${event.phase}] ${event.message}`;
              logLines.push(logEntry);
              if (logLines.length > 200) logLines.shift();
              setProgress({
                done: event.done,
                total: event.total,
                phase: event.phase,
                message: event.message,
                log: [...logLines],
              });
            } else if (event.type === "done") {
              setImportResult(event as ImportResponse);
              toast.success(
                `Saved ${event.summary.variantsCreated} new colour variants`,
              );
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          }
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            <Text>Seed Colours from PDFs</Text>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <Text>
              Drop BuildSmart order PDFs to extract colour names, codes and
              bases. Optionally include a Plascon/Dulux price list to seed
              supplier prices.
            </Text>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {tabsList}
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            <Text>PDF batch import</Text>
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Order PDFs</CardTitle>
            <CardDescription>
              Each PO line is scanned for "T/Base &lt;Base&gt; - &lt;Colour&gt;
              &lt;Code&gt;" patterns. Supplier comes from the PDF vendor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragEnter={(e) => handleDragEnter(e, "orders")}
              onDragOver={(e) => handleDragOver(e, "orders")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "orders")}
              className={cn(
                "rounded border-2 border-dashed p-6 text-center transition",
                dragActive === "orders"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              <Upload className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">
                Drop ORDER xxxxx.pdf files here
              </p>
              <p className="text-xs text-muted-foreground">
                Or pick them from your computer.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <Button
                  onClick={() => orderInputRef.current?.click()}
                  size="sm"
                  className="rounded"
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Choose Order PDFs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  disabled={!orderFiles.length && !priceFiles.length}
                  className="rounded"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              </div>
              <input
                ref={orderInputRef}
                type="file"
                multiple
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addOrderFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <ScrollArea className="h-48 rounded border bg-muted/10 p-2">
              {orderFiles.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No order PDFs queued.
                </div>
              ) : (
                <ul className="space-y-1">
                  {orderFiles.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1.5"
                    >
                      <span className="flex items-center gap-2 truncate text-sm">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{f.file.name}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOrderFile(f.id)}
                        className="h-6 w-6"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="rounded border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Price List PDF (optional)</CardTitle>
            <CardDescription>
              Used to also seed Plascon/Dulux supplier prices for known
              products.
            </CardDescription>
          </CardHeader>
          <CardContent
            className={cn(
              "space-y-3 rounded border-2 border-dashed p-6 transition",
              dragActive === "prices"
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
            )}
            onDragEnter={(e) => handleDragEnter(e, "prices")}
            onDragOver={(e) => handleDragOver(e, "prices")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "prices")}
          >
            <div className="text-center">
              <Upload className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">
                Drop price list PDF files here
              </p>
              <p className="text-xs text-muted-foreground">
                Or pick them from your computer.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => priceInputRef.current?.click()}
              size="sm"
              className="w-full rounded"
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Choose Price List PDF(s)
            </Button>
            <input
              ref={priceInputRef}
              type="file"
              multiple
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addPriceFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <ScrollArea className="h-40 rounded border bg-muted/10 p-2">
              {priceFiles.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No price list selected.
                </div>
              ) : (
                <ul className="space-y-1">
                  {priceFiles.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1.5"
                    >
                      <span className="flex items-center gap-2 truncate text-sm">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{f.file.name}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePriceFile(f.id)}
                        className="h-6 w-6"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => callApi("parse")}
          disabled={!!busy || (!orderFiles.length && !priceFiles.length)}
          className="rounded"
        >
          {busy === "parsing" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {busy === "parsing" ? "Parsing..." : "Parse & Preview"}
        </Button>
        <Button
          variant="default"
          onClick={() => callApi("import")}
          disabled={!preview || !!busy}
          className="rounded"
        >
          {busy === "importing" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {busy === "importing" ? "Saving..." : "Save to Database"}
        </Button>
      </div>

      {busy === "importing" && progress && (
        <ImportProgressPanel progress={progress} />
      )}

      {preview && !importResult && busy !== "importing" && (
        <PreviewPanel preview={preview} />
      )}

      {importResult && <ImportResultPanel result={importResult} />}
    </div>
  );
}

function ImportProgressPanel({ progress }: { progress: ImportProgress }) {
  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;
  return (
    <Card className="rounded border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving to database…
        </CardTitle>
        <CardDescription>
          {progress.done} / {progress.total} steps · {pct}%{" "}
          {progress.phase ? `· ${progress.phase}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-2 w-full overflow-hidden rounded bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {progress.message}
        </div>
        <ScrollArea className="h-48 rounded border bg-muted/10 p-2">
          <ul className="space-y-0.5 text-[11px] font-mono leading-tight">
            {progress.log.slice(-200).map((line, i) => (
              <li key={i} className="truncate">
                {line}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function PreviewPanel({ preview }: { preview: ParseResponse }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="rounded border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-4 w-4" /> Detected Colours
            <Badge variant="secondary" className="rounded-full text-xs">
              {preview.summary.uniqueColors}
            </Badge>
          </CardTitle>
          <CardDescription>
            Deduplicated by colour + base. Each row will become a
            ProductColorVariant under the shared "Paint Tint Catalogue"
            placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 rounded border bg-muted/10">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur">
                <TableRow>
                  <TableHead className="px-3 py-1.5 text-xs">Colour</TableHead>
                  <TableHead className="px-3 py-1.5 text-xs">Base</TableHead>
                  <TableHead className="px-3 py-1.5 text-xs">Code</TableHead>
                  <TableHead className="px-3 py-1.5 text-xs">
                    Suppliers
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.colors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-xs py-6">
                      No colours detected.
                    </TableCell>
                  </TableRow>
                ) : (
                  preview.colors.map((c) => (
                    <TableRow key={`${c.colorName}|${c.baseType}`}>
                      <TableCell className="px-3 py-1.5 text-sm font-medium">
                        {colorDisplayName(c.colorName, c.colorCode)}
                        {c.isTinted && (
                          <Badge
                            variant="secondary"
                            className="ml-2 h-4 text-[10px]"
                          >
                            Tinted
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-1.5">
                        <BaseBadge
                          baseType={c.baseType}
                          colorCode={c.colorCode}
                        />
                      </TableCell>
                      <TableCell className="px-3 py-1.5 text-xs text-muted-foreground">
                        {c.colorCode ?? "—"}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 text-xs">
                        {c.suppliers.join(", ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="rounded border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Suppliers & Prices</CardTitle>
          <CardDescription>
            Suppliers will be auto-created if missing. Price-list rows are
            matched to existing procurement products where possible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Order PDFs" value={preview.summary.orderPdfs} />
            <Stat label="Price PDFs" value={preview.summary.priceListPdfs} />
            <Stat
              label="Suppliers detected"
              value={preview.summary.suppliersDetected}
            />
            <Stat label="Price rows" value={preview.summary.priceRows} />
            <Stat
              label="Parse failures"
              value={preview.summary.parseFailures}
            />
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Suppliers</div>
            <ScrollArea className="h-32 rounded border bg-muted/10 p-2">
              {preview.suppliers.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  No suppliers detected.
                </div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {preview.suppliers.map((s) => (
                    <li key={s.normalisedName}>
                      <span className="font-medium">{s.normalisedName}</span>
                      {s.vendorCode && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({s.vendorCode})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
          {preview.prices.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">
                Price rows (preview)
              </div>
              <ScrollArea className="h-40 rounded border bg-muted/10 p-2">
                <ul className="space-y-1 text-xs">
                  {preview.prices.slice(0, 50).map((p, i) => (
                    <li key={i} className="truncate">
                      <Badge variant="outline" className="mr-2 text-[10px]">
                        {p.brand}
                      </Badge>
                      <span className="font-medium">
                        {p.productCode ?? p.productLabel}
                      </span>{" "}
                      — {BASE_TYPE_LABELS[p.baseType]}{" "}
                      {p.unitSizeL ? `${p.unitSizeL}L` : ""} :{" "}
                      {p.priceZar != null ? `R ${p.priceZar.toFixed(2)}` : "—"}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
          {preview.parseFailures.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2 flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Failures
              </div>
              <ul className="space-y-1 text-xs text-amber-700">
                {preview.parseFailures.map((f) => (
                  <li key={f.fileName}>
                    {f.fileName}: {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ImportResultPanel({ result }: { result: ImportResponse }) {
  return (
    <Card className="rounded border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Import Result</CardTitle>
        <CardDescription>
          {result.summary.variantsCreated} new colour variants created,{" "}
          {result.summary.variantsSkipped} already existed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
          <Stat
            label="Colours created"
            value={result.summary.variantsCreated}
          />
          <Stat
            label="Colours skipped"
            value={result.summary.variantsSkipped}
          />
          <Stat
            label="Suppliers touched"
            value={result.summary.suppliersTouched}
          />
          <Stat
            label="Order price links"
            value={result.summary.orderPriceLinksCreated}
          />
          <Stat
            label="Price-list imported"
            value={result.summary.priceListImported}
          />
          <Stat
            label="Price-list unmatched"
            value={result.summary.priceListUnmatched}
          />
        </div>
        {result.unmatchedPriceLabels.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">
              Unmatched price-list rows
            </div>
            <ScrollArea className="h-32 rounded border bg-muted/10 p-2">
              <ul className="space-y-1 text-xs text-muted-foreground">
                {result.unmatchedPriceLabels.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}
        {result.parseFailures.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-1 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Failures
            </div>
            <ul className="space-y-1 text-xs text-amber-700">
              {result.parseFailures.map((f) => (
                <li key={f.fileName}>
                  {f.fileName}: {f.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-muted/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
