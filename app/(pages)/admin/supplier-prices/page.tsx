"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  RotateCw,
  DollarSign,
  Pencil,
  Trash2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SupplierPrice = {
  id: string;
  supplierId: string;
  productId: string;
  uom: string | null;
  unitSize: number | null;
  price: number;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
  supplier: { id: string; name: string };
  product: {
    id: string;
    name: string;
    sku: string | null;
    uom: string | null;
    unitSize: number | null;
  };
};

type LookupItem = { id: string; name: string; sku?: string | null };
type UomOption = { value: string; label: string; group: string };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const UOM_LABELS: Record<string, string> = {
  MM: "mm",
  CM: "cm",
  M: "m",
  M2: "m²",
  M3: "m³",
  G: "g",
  KG: "kg",
  TON: "ton",
  ML: "ml",
  L: "L",
  UNIT: "unit",
  EACH: "each",
  PIECE: "piece",
  PACK: "pack",
  BOX: "box",
  BAG: "bag",
  BUCKET: "bucket",
  DRUM: "drum",
  CAN: "can",
  BOTTLE: "bottle",
  TUBE: "tube",
  BAR: "bar",
  ROLL: "roll",
  SHEET: "sheet",
  BUNDLE: "bundle",
  PALLET: "pallet",
  HOUR: "hour",
  DAY: "day",
};

function uomLabel(uom: string) {
  return UOM_LABELS[uom] ?? uom;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SupplierPricesPage() {
  const [prices, setPrices] = useState<SupplierPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProduct, setFilterProduct] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [filterProductSearch, setFilterProductSearch] = useState("");

  // Lookups
  const [products, setProducts] = useState<LookupItem[]>([]);
  const [suppliers, setSuppliers] = useState<LookupItem[]>([]);
  const [uomOptions, setUomOptions] = useState<UomOption[]>([]);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierPrice | null>(null);
  const [form, setForm] = useState({
    supplierId: "",
    productId: "",
    uom: "",
    unitSize: "",
    price: "",
    startsOn: "",
    endsOn: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const [dialogProductSearch, setDialogProductSearch] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<SupplierPrice | null>(null);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  // Load lookups
  useEffect(() => {
    async function loadLookups() {
      try {
        const [pRes, sRes, uomRes] = await Promise.all([
          fetch("/api/app/admin/procurement-products?includeInactive=true", {
            credentials: "include",
          }),
          fetch("/api/app/admin/suppliers?includeInactive=false", {
            credentials: "include",
          }),
          fetch("/api/app/admin/product-uoms", { credentials: "include" }),
        ]);
        const [pJson, sJson, uomJson] = await Promise.all([
          pRes.json(),
          sRes.json(),
          uomRes.json(),
        ]);
        if (pRes.ok)
          setProducts(
            (pJson.data ?? []).map((p: any) => ({
              id: p.id,
              name: p.name,
              sku: p.sku ?? null,
            })),
          );
        if (sRes.ok)
          setSuppliers(
            (sJson.data ?? []).map((s: any) => ({ id: s.id, name: s.name })),
          );
        if (uomRes.ok) setUomOptions(uomJson.data ?? []);
      } catch {
        // Silently fail
      }
    }
    loadLookups();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterProduct) params.set("productId", filterProduct);
      if (filterSupplier) params.set("supplierId", filterSupplier);
      if (showInactive) params.set("includeInactive", "true");

      const res = await fetch(`/api/app/admin/supplier-prices?${params}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setPrices(json.data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load prices");
    } finally {
      setLoading(false);
    }
  }, [filterProduct, filterSupplier, showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      supplierId: "",
      productId: "",
      uom: "",
      unitSize: "",
      price: "",
      startsOn: "",
      endsOn: "",
    });
    setDialogOpen(true);
  }

  function openEdit(p: SupplierPrice) {
    setEditing(p);
    setForm({
      supplierId: p.supplierId,
      productId: p.productId,
      uom: p.uom ?? "",
      unitSize: p.unitSize != null ? String(p.unitSize) : "",
      price: String(p.price),
      startsOn: p.startsOn ? p.startsOn.slice(0, 10) : "",
      endsOn: p.endsOn ? p.endsOn.slice(0, 10) : "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.supplierId) {
      toast.error("Supplier is required");
      return;
    }
    if (!form.productId) {
      toast.error("Product is required");
      return;
    }
    const priceNum = Number(form.price);
    if (!form.price || !Number.isFinite(priceNum) || priceNum < 0) {
      toast.error("Price must be a valid number");
      return;
    }
    setSubmitting(true);
    try {
      const url = editing
        ? `/api/app/admin/supplier-prices/${editing.id}`
        : `/api/app/admin/supplier-prices`;
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: form.supplierId,
          productId: form.productId,
          uom: form.uom || null,
          unitSize: form.unitSize ? Number(form.unitSize) : null,
          price: priceNum,
          startsOn: form.startsOn || null,
          endsOn: form.endsOn || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");

      toast.success(editing ? "Price updated" : "Price created");
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save price");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/app/admin/supplier-prices/${deleteTarget.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      toast.success("Price deleted");
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete price");
    }
  }

  const columns = useMemo<ColumnDef<SupplierPrice>[]>(
    () => [
      {
        id: "product",
        accessorFn: (row) => row.product.name,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              Product
              {isSorted === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="font-medium leading-tight">
              {row.original.product.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.product.sku ?? "No SKU"}
            </div>
          </div>
        ),
      },
      {
        id: "supplier",
        accessorFn: (row) => row.supplier.name,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              Supplier
              {isSorted === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => (
          <span className="text-sm">{row.original.supplier.name}</span>
        ),
      },
      {
        id: "size",
        header: () => <span>Size</span>,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.uom
              ? `${row.original.unitSize ?? ""}${uomLabel(row.original.uom)}`
              : "" + "" + "—"}
          </span>
        ),
      },
      {
        id: "price",
        accessorKey: "price",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors justify-end w-full"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <span>Price</span>
              {isSorted === "asc" ? (
                <ChevronUp className="h-4 w-4" />
              ) : isSorted === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        },
        cell: ({ row }) => (
          <span className="block text-right font-medium">
            {formatCurrency(row.original.price)}
          </span>
        ),
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
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: prices,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Supplier Prices</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Price
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filterProduct || "ALL"}
          onValueChange={(v) => setFilterProduct(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-50">
            <SelectValue placeholder="All products" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1.5">
              <Input
                placeholder="Search products..."
                value={filterProductSearch}
                onChange={(e) => setFilterProductSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="h-8 text-xs"
              />
            </div>
            <SelectItem value="ALL">All products</SelectItem>
            {products
              .filter((p) => {
                const term = filterProductSearch.trim().toLowerCase();
                if (!term) return true;
                return (
                  p.name.toLowerCase().includes(term) ||
                  (p.sku?.toLowerCase().includes(term) ?? false)
                );
              })
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.sku ? `${p.name} (${p.sku})` : p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={filterSupplier || "ALL"}
          onValueChange={(v) => setFilterSupplier(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-50">
            <SelectValue placeholder="All suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" onClick={load}>
          <RotateCw className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant={showInactive ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowInactive((v) => !v)}
        >
          {showInactive ? "Showing active + inactive" : "Active only"}
        </Button>
      </div>

      {/* Table */}
      {!loading && prices.length === 0 ? (
        <div className="border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
          <DollarSign className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            No prices found
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Adjust your filters, or add a new supplier price.
          </p>
        </div>
      ) : (
        <div className="border bg-card">
          <div className="overflow-x-auto">
            <Table className="border-collapse">
              <TableHeader className="bg-muted/60">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
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
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="border border-zinc-200 px-3 py-2 dark:border-zinc-700"
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

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
            <div className="text-muted-foreground hidden text-sm lg:flex gap-2">
              <span>
                Showing{" "}
                {prices.length === 0
                  ? 0
                  : table.getState().pagination.pageIndex *
                      table.getState().pagination.pageSize +
                    1}{" "}
                to{" "}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) *
                    table.getState().pagination.pageSize,
                  prices.length,
                )}{" "}
                of {prices.length} prices
              </span>
            </div>
            <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-sm font-medium">Rows per page</span>
                <Select
                  value={String(table.getState().pagination.pageSize)}
                  onValueChange={(value) => {
                    table.setPageSize(Number(value));
                  }}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue
                      placeholder={table.getState().pagination.pageSize}
                    />
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
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden h-8 w-8 lg:flex"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Supplier Price" : "Add Supplier Price"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the price this supplier charges for the selected product."
                : "Set the price a supplier charges for a specific product."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {editing ? (
              <div className="rounded border bg-muted/40 px-3 py-2 text-sm space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Supplier
                  </span>
                  <span className="font-medium">{editing.supplier.name}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Product
                  </span>
                  <div className="text-right">
                    <div className="font-medium leading-tight">
                      {editing.product.name}
                    </div>
                    {editing.product.sku && (
                      <div className="text-[11px] text-muted-foreground">
                        SKU: {editing.product.sku}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Supplier *</label>
                  <Select
                    value={form.supplierId || "NONE"}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        supplierId: v === "NONE" ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Select supplier...</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Product *</label>
                  <Select
                    value={form.productId || "NONE"}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        productId: v === "NONE" ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1.5">
                        <Input
                          placeholder="Search products..."
                          value={dialogProductSearch}
                          onChange={(e) =>
                            setDialogProductSearch(e.target.value)
                          }
                          onKeyDown={(e) => e.stopPropagation()}
                          className="h-8 text-xs"
                        />
                      </div>
                      <SelectItem value="NONE">Select product...</SelectItem>
                      {products
                        .filter((p) => {
                          const term = dialogProductSearch.trim().toLowerCase();
                          if (!term) return true;
                          return (
                            p.name.toLowerCase().includes(term) ||
                            (p.sku?.toLowerCase().includes(term) ?? false)
                          );
                        })
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.sku ? `${p.name} (${p.sku})` : p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Unit of Measure</label>
                <Select
                  value={form.uom || "NONE"}
                  onValueChange={(v) =>
                    setForm({ ...form, uom: v === "NONE" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No UOM</SelectItem>
                    {(() => {
                      const groups = uomOptions.reduce<
                        Record<string, UomOption[]>
                      >((acc, opt) => {
                        (acc[opt.group] ??= []).push(opt);
                        return acc;
                      }, {});
                      return Object.entries(groups).map(([group, opts]) => (
                        <div key={group}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            {group}
                          </div>
                          {opts.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label} ({opt.value})
                            </SelectItem>
                          ))}
                        </div>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Unit Size</label>
                <Input
                  type="number"
                  step="any"
                  value={form.unitSize}
                  onChange={(e) =>
                    setForm({ ...form, unitSize: e.target.value })
                  }
                  placeholder="e.g. 5 for 5L"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Price (ZAR) *</label>
              <Input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Price"
        description={`Are you sure you want to delete this price entry for "${deleteTarget?.product.name}" from "${deleteTarget?.supplier.name}"?`}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
