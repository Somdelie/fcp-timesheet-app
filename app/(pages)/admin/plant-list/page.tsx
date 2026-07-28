"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Search,
  X,
  RotateCw,
  Wrench,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Upload,
  RotateCcw,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type PlantItem = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  isReturnable: boolean;
  colors: string[];
  sizes: string[];
  stockQty: number;
  variantStocks?: {
    id: string;
    size: string | null;
    color: string | null;
    condition: "NEW" | "OLD";
    qty: number;
  }[];
  deployedQty: number;
  duplicateCount?: number;
  duplicateIds?: string[];
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  _count: { orderItems: number; plantAssignments: number };
};

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };

type Condition = "NEW" | "OLD";
const CONDITIONS: Condition[] = ["NEW", "OLD"];

function variantKey(size: string, condition: Condition) {
  return `${size.trim()}\x00${condition}`;
}

// Always emits a NEW and an OLD row per size (or, with no sizes, one flat
// NEW/OLD pair) — a blank input is just qty 0, not "no row".
function buildVariantStocks(sizes: string[], qtys: Record<string, string>) {
  const sizeList = sizes.length > 0 ? sizes : [""];
  return sizeList.flatMap((size) =>
    CONDITIONS.map((condition) => ({
      size: size || null,
      color: null,
      condition,
      qty: Math.max(0, Number(qtys[variantKey(size, condition)]) || 0),
    })),
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function PlantListPage() {
  const [items, setItems] = useState<PlantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Create/Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlantItem | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    categoryId: "",
    supplierId: "",
    thumbnailUrl: "",
    isReturnable: true,
    sizesRaw: "",
    colorsRaw: "",
    variantQtys: {} as Record<string, string>,
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<PlantItem | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const formSizes = parseTags(form.sizesRaw);
  const displayedStockQty = buildVariantStocks(
    formSizes,
    form.variantQtys,
  ).reduce((sum, v) => sum + v.qty, 0);

  /* -------- load lookups -------- */
  useEffect(() => {
    async function loadLookups() {
      try {
        const [catRes, supRes] = await Promise.all([
          fetch("/api/app/admin/product-categories", {
            credentials: "include",
          }),
          fetch("/api/app/admin/suppliers?includeInactive=false", {
            credentials: "include",
          }),
        ]);
        const [catJson, supJson] = await Promise.all([
          catRes.json(),
          supRes.json(),
        ]);
        if (catRes.ok) setCategories(catJson.data ?? []);
        if (supRes.ok) setSuppliers(supJson.data ?? []);
      } catch {}
    }
    loadLookups();
  }, []);

  /* -------- load plant items -------- */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ productType: "PLANT" });
      if (filterCategory) params.set("categoryId", filterCategory);
      const res = await fetch(`/api/app/admin/procurement-products?${params}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setItems(json.data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load plant items");
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    load();
  }, [load]);

  /* -------- CRUD helpers -------- */
  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      sku: "",
      description: "",
      categoryId: "",
      supplierId: "",
      thumbnailUrl: "",
      isReturnable: true,
      sizesRaw: "",
      colorsRaw: "",
      variantQtys: {},
    });
    setDialogOpen(true);
  }

  function openEdit(p: PlantItem) {
    const variantQtys: Record<string, string> = {};
    for (const variant of p.variantStocks ?? []) {
      variantQtys[variantKey(variant.size ?? "", variant.condition)] = String(
        variant.qty,
      );
    }
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      description: p.description ?? "",
      categoryId: p.category?.id ?? "",
      supplierId: p.supplier?.id ?? "",
      thumbnailUrl: p.thumbnailUrl ?? "",
      isReturnable: p.isReturnable,
      sizesRaw: (p.sizes ?? []).join(", "),
      colorsRaw: (p.colors ?? []).join(", "),
      variantQtys,
    });
    setDialogOpen(true);
  }

  async function handleThumbnailUpload(file: File) {
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "plant-items");
      const res = await fetch("/api/uploads/image", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Upload failed");
      setForm((f) => ({ ...f, thumbnailUrl: payload.url ?? "" }));
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) handleThumbnailUpload(file);
    else toast.error("Please drop an image file");
  }

  function parseTags(raw: string) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const sizes = parseTags(form.sizesRaw);
    const colors = parseTags(form.colorsRaw);
    const variantStocks = buildVariantStocks(sizes, form.variantQtys);
    const stockQty = variantStocks.reduce((sum, variant) => sum + variant.qty, 0);
    setSubmitting(true);
    try {
      const url = editing
        ? `/api/app/admin/procurement-products/${editing.id}`
        : `/api/app/admin/procurement-products`;
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          sku: form.sku.trim() || null,
          description: form.description.trim() || null,
          categoryId: form.categoryId || null,
          supplierId: form.supplierId || null,
          thumbnailUrl: form.thumbnailUrl || null,
          productType: "PLANT",
          isReturnable: form.isReturnable,
          sizes,
          colors,
          stockQty,
          variantStocks,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");
      toast.success(editing ? "Item updated" : "Item added to plant list");
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/app/admin/procurement-products/${deleteTarget.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      toast.success("Item removed");
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  }

  /* -------- table -------- */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.sizes ?? []).some((s) => s.toLowerCase().includes(term)),
    );
  }, [items, search]);

  const columns: ColumnDef<PlantItem>[] = [
    {
      id: "thumbnail",
      size: 50,
      header: () => <span className="sr-only">Image</span>,
      cell: ({ row }) =>
        row.original.thumbnailUrl ? (
          <img
            src={row.original.thumbnailUrl}
            alt={row.original.name}
            className="h-10 w-10 rounded object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </div>
        ),
      enableSorting: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        const s = column.getIsSorted();
        return (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting(s === "asc")}
          >
            Item
            {s === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : s === "desc" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        );
      },
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      id: "sizes",
      header: () => <span>Sizes</span>,
      cell: ({ row }) => {
        const sizes = row.original.sizes ?? [];
        if (!sizes.length)
          return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {sizes.map((s) => (
              <span
                key={s}
                className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-xs font-medium"
              >
                {s}
              </span>
            ))}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "colors",
      header: () => <span>Colors</span>,
      cell: ({ row }) => {
        const colors = row.original.colors ?? [];
        if (!colors.length)
          return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {colors.slice(0, 4).map((c) => (
              <span key={c} className="text-xs text-muted-foreground">
                {c}
              </span>
            ))}
            {colors.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{colors.length - 4}
              </span>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "category",
      header: () => <span>Category</span>,
      cell: ({ row }) =>
        row.original.category ? (
          <Badge variant="outline">{row.original.category.name}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      enableSorting: false,
    },
    {
      id: "returnable",
      header: () => <span>Returnable</span>,
      cell: ({ row }) =>
        row.original.isReturnable ? (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <RotateCcw className="h-3 w-3" /> Yes
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No</span>
        ),
      enableSorting: false,
    },
    {
      id: "stockQty",
      header: () => <span>Total Owned</span>,
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.stockQty ?? 0}</Badge>
      ),
      enableSorting: false,
    },
    {
      id: "deployedQty",
      header: () => <span>Deployed</span>,
      cell: ({ row }) => {
        const qty = row.original.deployedQty ?? 0;
        return qty > 0 ? (
          <Badge variant="outline">{qty}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
      enableSorting: false,
    },
    {
      id: "atOffice",
      header: () => <span>At Office</span>,
      cell: ({ row }) => {
        const total = row.original.stockQty ?? 0;
        const deployed = row.original.deployedQty ?? 0;
        const atOffice = total - deployed;
        if (atOffice < 0)
          return (
            <span className="text-xs font-medium text-destructive">
              {atOffice}
            </span>
          );
        if (atOffice === 0)
          return <span className="text-xs text-muted-foreground">0</span>;
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 border-0">
            {atOffice}
          </Badge>
        );
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
            disabled={(row.original.duplicateCount ?? 1) > 1}
            title={
              (row.original.duplicateCount ?? 1) > 1
                ? "Merged duplicate rows must be cleaned up before editing"
                : "Edit"
            }
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => setDeleteTarget(row.original)}
            disabled={
              (row.original.duplicateCount ?? 1) > 1 ||
              (row.original._count?.plantAssignments ?? 0) > 0
            }
            title={
              (row.original.duplicateCount ?? 1) > 1
                ? "Merged duplicate rows must be cleaned up before deleting"
                : (row.original._count?.plantAssignments ?? 0) > 0
                  ? "Cannot delete: currently deployed"
                  : "Delete"
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  /* ================================================================== */
  return (
    <div className="mx-auto space-y-2">
      {/* ---- Header + Toolbar ---- */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold">Plant Catalogue</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, SKU, size…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select
            value={filterCategory}
            onValueChange={(v) => setFilterCategory(v === "ALL" ? "" : v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={load}>
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button onClick={openCreate} size="sm" variant="outline">
            <Plus className="mr-1 h-4 w-4" /> Add Plant Item
          </Button>
        </div>
      </div>

      {/* ---- Catalogue table ---- */}
      {!loading && filtered.length === 0 ? (
        <div className="border border-dashed border-border bg-card/30 p-12 text-center rounded">
          <Wrench className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <h3 className="text-lg font-semibold">No plant items found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add step ladders, compressors, generators, safety harnesses and
            other equipment.
          </p>
        </div>
      ) : (
        <div className="rounded border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/60">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent">
                    {hg.headers.map((h) => (
                      <TableHead
                        key={h.id}
                        className="text-xs font-semibold uppercase tracking-wide"
                      >
                        {h.isPlaceholder
                          ? null
                          : flexRender(
                              h.column.columnDef.header,
                              h.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
            <div className="text-muted-foreground hidden text-sm lg:flex">
              Showing{" "}
              {filtered.length === 0
                ? 0
                : table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                  1}{" "}
              to{" "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) *
                  table.getState().pagination.pageSize,
                filtered.length,
              )}{" "}
              of {filtered.length} items
            </div>
            <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-sm font-medium">Rows per page</span>
                <Select
                  value={String(table.getState().pagination.pageSize)}
                  onValueChange={(v) => table.setPageSize(Number(v))}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 25, 50].map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-fit items-center justify-center text-sm font-medium">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount() || 1}
              </div>
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden h-8 w-8 lg:flex"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden h-8 w-8 lg:flex"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Create / Edit Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Plant Item" : "Add Plant Item"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update details for this plant/equipment item."
                : "Add equipment such as step ladders, compressors, generators, harnesses, etc."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Image */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Image (optional)</label>
              {form.thumbnailUrl ? (
                <div className="rounded border-2 border-dashed border-primary/40 bg-primary/5 p-3">
                  <div className="flex items-end gap-3">
                    <img
                      src={form.thumbnailUrl}
                      alt="Thumbnail"
                      className="h-20 w-20 rounded object-cover shadow-sm"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-primary">
                        ✓ Image uploaded
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, thumbnailUrl: "" })}
                      className="rounded bg-card p-1.5 hover:bg-destructive/10 text-destructive transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative rounded border-2 border-dashed transition-colors p-4 text-center cursor-pointer ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/30 hover:border-primary/50"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleThumbnailUpload(f);
                      e.target.value = "";
                    }}
                    disabled={uploading}
                  />
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Upload className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-medium">
                      {uploading
                        ? "Uploading…"
                        : "Click to upload or drag image"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG up to 5MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Name + SKU */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Step Ladder 3m"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">SKU / Code</label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Category + Supplier */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={form.categoryId || "NONE"}
                  onValueChange={(v) =>
                    setForm({ ...form, categoryId: v === "NONE" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Supplier / Owner</label>
                <Select
                  value={form.supplierId || "NONE"}
                  onValueChange={(v) =>
                    setForm({ ...form, supplierId: v === "NONE" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sizes */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Sizes{" "}
                <span className="text-muted-foreground font-normal">
                  (comma-separated)
                </span>
              </label>
              <Input
                value={form.sizesRaw}
                onChange={(e) => setForm({ ...form, sizesRaw: e.target.value })}
                placeholder="e.g. 3m, 5m, 8m  or  Small, Medium, Large"
              />
              {form.sizesRaw && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {parseTags(form.sizesRaw).map((s) => (
                    <span
                      key={s}
                      className="rounded border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Colors */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Colors{" "}
                <span className="text-muted-foreground font-normal">
                  (comma-separated, optional)
                </span>
              </label>
              <Input
                value={form.colorsRaw}
                onChange={(e) =>
                  setForm({ ...form, colorsRaw: e.target.value })
                }
                placeholder="e.g. Yellow, Silver, Red"
              />
            </div>

            {/* Quantity by condition (and size, if any) */}
            <div className="space-y-2 rounded border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium">
                  {formSizes.length > 0
                    ? "Quantity by Size & Condition"
                    : "Quantity by Condition"}
                </label>
                <Badge variant="secondary">Total {displayedStockQty}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Total owned = New + Old, deployed units + units at the office
                combined.
              </p>
              {formSizes.length > 0 ? (
                <div className="overflow-x-auto rounded border border-border">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="border-b border-border px-2 py-1.5 text-left font-medium">
                          Size
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-center font-medium">
                          New
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-center font-medium">
                          Old
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {formSizes.map((size) => (
                        <tr key={size}>
                          <td className="border-b border-border px-2 py-1.5 font-medium">
                            {size}
                          </td>
                          {CONDITIONS.map((condition) => (
                            <td
                              key={condition}
                              className="border-b border-border px-2 py-1.5 text-center"
                            >
                              <Input
                                type="number"
                                min={0}
                                value={
                                  form.variantQtys[
                                    variantKey(size, condition)
                                  ] ?? ""
                                }
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    variantQtys: {
                                      ...form.variantQtys,
                                      [variantKey(size, condition)]:
                                        e.target.value,
                                    },
                                  })
                                }
                                placeholder="0"
                                className="h-7 w-16 text-center text-xs"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {CONDITIONS.map((condition) => (
                    <label key={condition} className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {condition === "NEW" ? "New" : "Old"}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        value={form.variantQtys[variantKey("", condition)] ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            variantQtys: {
                              ...form.variantQtys,
                              [variantKey("", condition)]: e.target.value,
                            },
                          })
                        }
                        placeholder="0"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Returnable */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Return Policy</label>
              <label className="flex items-center gap-2 cursor-pointer rounded border border-border px-3 py-2 hover:bg-muted/40">
                <Checkbox
                  checked={form.isReturnable}
                  onCheckedChange={(v) =>
                    setForm({ ...form, isReturnable: !!v })
                  }
                />
                <span className="text-sm">
                  Must be returned to office after use
                </span>
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Notes / Description</label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving…" : editing ? "Update" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove Plant Item"
        description={`Remove "${deleteTarget?.name}" from the plant list? This cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Remove"
        variant="destructive"
      />
    </div>
  );
}
