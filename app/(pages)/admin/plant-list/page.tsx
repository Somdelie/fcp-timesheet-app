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
  Truck,
  MapPin,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import PlantDeployPOS, {
  type PlantSiteDto,
  type PlantItemDto,
} from "@/components/orders/PlantDeployPOS";

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
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  _count: { orderItems: number; plantAssignments: number };
};

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };

type Assignment = {
  id: string;
  quantity: number;
  status: string;
  deployedOn: string;
  note: string | null;
  product: { id: string; name: string; thumbnailUrl: string | null };
  site: { id: string; name: string; code: string | null };
  assignedByUser: { id: string; name: string | null } | null;
};

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

  // Deploy sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sites, setSites] = useState<PlantSiteDto[]>([]);

  // Assignments list
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

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
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<PlantItem | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  /* -------- load lookups -------- */
  useEffect(() => {
    async function loadLookups() {
      try {
        const [catRes, supRes, siteRes] = await Promise.all([
          fetch("/api/app/admin/product-categories", { credentials: "include" }),
          fetch("/api/app/admin/suppliers?includeInactive=false", { credentials: "include" }),
          fetch("/api/app/admin/sites", { credentials: "include" }),
        ]);
        const [catJson, supJson, siteJson] = await Promise.all([
          catRes.json(),
          supRes.json(),
          siteRes.json(),
        ]);
        if (catRes.ok) setCategories(catJson.data ?? []);
        if (supRes.ok) setSuppliers(supJson.data ?? []);
        if (siteRes.ok) {
          const siteData: PlantSiteDto[] = (siteJson.data ?? []).map(
            (s: any) => ({ id: s.id, name: s.name, code: s.code ?? null }),
          );
          setSites(siteData);
        }
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

  /* -------- load assignments -------- */
  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    try {
      const res = await fetch("/api/app/admin/plant-assignments", {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load assignments");
      setAssignments(json.data ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load assignments");
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

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
    });
    setDialogOpen(true);
  }

  function openEdit(p: PlantItem) {
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
          sizes: parseTags(form.sizesRaw),
          colors: parseTags(form.colorsRaw),
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
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.sku && (
            <div className="text-xs text-muted-foreground">
              SKU: {row.original.sku}
            </div>
          )}
          {row.original.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {row.original.description}
            </div>
          )}
        </div>
      ),
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
      id: "deployed",
      header: () => <span>In Use</span>,
      cell: ({ row }) => {
        const count = row.original._count?.plantAssignments ?? 0;
        return count > 0 ? (
          <Badge variant="secondary">
            {count} site{count !== 1 ? "s" : ""}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Idle</span>
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
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => setDeleteTarget(row.original)}
            disabled={(row.original._count?.plantAssignments ?? 0) > 0}
            title={
              (row.original._count?.plantAssignments ?? 0) > 0
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

  /* -------- plant items for POS -------- */
  const plantItemDtos: PlantItemDto[] = useMemo(
    () =>
      items.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        thumbnailUrl: p.thumbnailUrl,
        sizes: p.sizes ?? [],
      })),
    [items],
  );

  /* -------- assignment status colour -------- */
  function statusClass(status: string) {
    switch (status) {
      case "DEPLOYED":
        return "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300";
      case "RETURNED":
        return "bg-muted text-muted-foreground";
      case "DAMAGED":
        return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300";
      case "LOST":
        return "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  /* ================================================================== */
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-semibold">Plant List</h1>
        <Button onClick={() => setSheetOpen(true)} size="sm">
          <Truck className="mr-1 h-4 w-4" /> Deploy Plant
        </Button>
      </div>

      {/* ---- Catalogue toolbar ---- */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
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
        </div>
        <Button onClick={openCreate} size="sm" variant="outline">
          <Plus className="mr-1 h-4 w-4" /> Add Plant Item
        </Button>
      </div>

      {/* ---- Catalogue table ---- */}
      {!loading && filtered.length === 0 ? (
        <div className="border border-dashed border-border bg-card/30 p-12 text-center rounded-lg">
          <Wrench className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <h3 className="text-lg font-semibold">No plant items found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add step ladders, compressors, generators, safety harnesses and
            other equipment.
          </p>
        </div>
      ) : (
        <div className="border bg-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="border-collapse">
              <TableHeader className="bg-muted/60">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent">
                    {hg.headers.map((h) => (
                      <TableHead
                        key={h.id}
                        className="border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide"
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
                        <TableCell
                          key={cell.id}
                          className="border border-border px-3 py-2"
                        >
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
                    <TableCell colSpan={columns.length} className="h-24 text-center">
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

      {/* ---- Assignments list ---- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Active Deployments</h2>
          <Button variant="ghost" size="icon" onClick={loadAssignments}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="border bg-card rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Site
                  </span>
                </TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Deployed On</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignmentsLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : assignments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <Wrench className="mx-auto h-6 w-6 mb-1 opacity-30" />
                    No deployments yet
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((a) => (
                  <TableRow key={a.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      {a.product.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{a.site.name}</div>
                      {a.site.code && (
                        <div className="text-xs text-muted-foreground">
                          {a.site.code}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{a.quantity}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusClass(a.status)}`}
                      >
                        {a.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(a.deployedOn)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {a.note || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ---- Deploy Sheet ---- */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-full lg:max-w-[85vw] p-0 overflow-y-auto"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Deploy Plant to Site</SheetTitle>
          </SheetHeader>
          <PlantDeployPOS
            sites={sites}
            items={plantItemDtos}
            onDeployed={() => {
              setSheetOpen(false);
              loadAssignments();
              load();
            }}
          />
        </SheetContent>
      </Sheet>

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
                onChange={(e) =>
                  setForm({ ...form, sizesRaw: e.target.value })
                }
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
                <span className="text-sm">Must be returned to office after use</span>
              </label>
            </div>

            {/* Description */}
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
