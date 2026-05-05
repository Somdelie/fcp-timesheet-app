"use client";

import * as React from "react";
import { toast } from "react-toastify";
import {
  Search,
  X,
  RotateCw,
  Package,
  Wrench,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatCurrency";
import ProductRowActions from "@/components/products/ProductRowActions";

export interface AdminProductDto {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price: string;
  isActive: boolean;
  category: "PPE" | "TOOL";
  sizes: string[];
  colors: string[];
  stockQty: number;
  thumbnailUrl: string | null;
  variants: { id: string; size: string | null; color: string | null; qty: number }[];
}

type Tab = "PPE" | "TOOL";

function ColorDot({ color }: { color: string }) {
  const isHex = /^#[0-9a-f]{3,6}$/i.test(color);
  return (
    <span
      title={color}
      className="inline-block h-3 w-3 rounded-full border border-border shrink-0"
      style={isHex ? { backgroundColor: color } : { backgroundColor: "#e5e7eb" }}
    />
  );
}

function makeColumns(tab: Tab): ColumnDef<AdminProductDto>[] {
  return [
    {
      id: "thumbnail",
      size: 48,
      header: () => <span className="sr-only">Image</span>,
      cell: ({ row }) =>
        row.original.thumbnailUrl ? (
          <img
            src={row.original.thumbnailUrl}
            alt={row.original.name}
            className="h-9 w-9 rounded object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded bg-muted">
            {tab === "PPE"
              ? <Package className="h-4 w-4 text-muted-foreground" />
              : <Wrench className="h-4 w-4 text-muted-foreground" />}
          </div>
        ),
      enableSorting: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting(isSorted === "asc")}
          >
            Name
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
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="min-w-[160px]">
            <div className="font-medium leading-tight">{p.name}</div>
            {p.sku && (
              <div className="text-[10px] text-muted-foreground mt-0.5">SKU: {p.sku}</div>
            )}
          </div>
        );
      },
    },
    {
      id: "variants",
      header: () => <span>Sizes / Colors</span>,
      cell: ({ row }) => {
        const { sizes, colors } = row.original;
        if (sizes.length === 0 && colors.length === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-col gap-1 min-w-[120px]">
            {sizes.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {sizes.slice(0, 4).map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                    {s}
                  </Badge>
                ))}
                {sizes.length > 4 && (
                  <span className="text-[10px] text-muted-foreground">+{sizes.length - 4}</span>
                )}
              </div>
            )}
            {colors.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {colors.slice(0, 6).map((c) => <ColorDot key={c} color={c} />)}
                {colors.length > 6 && (
                  <span className="text-[10px] text-muted-foreground">+{colors.length - 6}</span>
                )}
              </div>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "stock",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting(isSorted === "asc")}
          >
            In Stock
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
      accessorFn: (row) => row.stockQty,
      cell: ({ row }) => {
        const qty = row.original.stockQty ?? 0;
        return (
          <Badge variant={qty > 0 ? "secondary" : "outline"} className="tabular-nums">
            {qty}
          </Badge>
        );
      },
      sortingFn: (a, b) => (a.original.stockQty ?? 0) - (b.original.stockQty ?? 0),
    },
    {
      accessorKey: "price",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting(isSorted === "asc")}
          >
            Price
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
        <span className="text-sm font-medium tabular-nums">
          {formatCurrency(Number(row.original.price))}
        </span>
      ),
      sortingFn: (a, b) => Number(a.original.price) - Number(b.original.price),
    },
    {
      accessorKey: "isActive",
      header: () => <span>Status</span>,
      cell: ({ row }) =>
        row.original.isActive ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-500/20 dark:text-slate-400">
            Inactive
          </span>
        ),
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => <div className="text-center">Actions</div>,
      cell: ({ row }) => (
        <div className="text-center">
          <ProductRowActions product={row.original} />
        </div>
      ),
      enableSorting: false,
    },
  ];
}

interface ProductsListProps {
  ppeProducts: AdminProductDto[];
  toolProducts: AdminProductDto[];
}

function ProductTable({
  products,
  tab,
  onReload,
  loading,
}: {
  products: AdminProductDto[];
  tab: Tab;
  onReload: () => void;
  loading: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  const columns = React.useMemo(() => makeColumns(tab), [tab]);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term)),
    );
  }, [products, q]);

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

  const label = tab === "PPE" ? "PPE items" : "tools";

  return (
    <div className="flex flex-col min-h-0 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search ${label}…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-9"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={onReload}
            className="gap-1.5"
          >
            <RotateCw className={`h-4 w-4 ${loading ? "animate-spin text-muted-foreground" : ""}`} />
            <span className="text-xs font-medium">{loading ? "Loading" : "Refresh"}</span>
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent("admin-products:create", { detail: { category: tab } }),
              )
            }
          >
            Add {tab === "PPE" ? "PPE" : "Tool"}
          </Button>
        </div>
      </div>

      {!loading && filtered.length === 0 ? (
        <div className="border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">No {label} found</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Adjust your search or add a new item.
          </p>
        </div>
      ) : (
        <div className="border bg-card">
          <div className="overflow-x-auto">
            <Table className="border-collapse">
              <TableHeader className="bg-muted/60">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
                : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}{" "}
              to{" "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                filtered.length,
              )}{" "}
              of {filtered.length} {label}
            </div>
            <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-sm font-medium">Rows per page</span>
                <Select
                  value={String(table.getState().pagination.pageSize)}
                  onValueChange={(v) => table.setPageSize(Number(v))}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue placeholder={table.getState().pagination.pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[5, 10, 25, 50, 100].map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
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
                  variant="outline" size="icon" className="hidden h-8 w-8 lg:flex"
                  onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="icon" className="hidden h-8 w-8 lg:flex"
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
    </div>
  );
}

export default function ProductsList({ ppeProducts, toolProducts }: ProductsListProps) {
  const [tab, setTab] = React.useState<Tab>("PPE");
  const [ppe, setPpe] = React.useState<AdminProductDto[]>(ppeProducts);
  const [tools, setTools] = React.useState<AdminProductDto[]>(toolProducts);
  const [loading, setLoading] = React.useState(false);

  async function reload() {
    try {
      setLoading(true);
      const res = await fetch("/api/app/admin/products?includeInactive=true", {
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const json = await res.json().catch(() => null as any);
      if (!res.ok) throw new Error(json?.error ?? `Failed to load (${res.status})`);
      if (json?.ok && Array.isArray(json.products)) {
        setPpe(json.products.filter((p: AdminProductDto) => p.category === "PPE"));
        setTools(json.products.filter((p: AdminProductDto) => p.category === "TOOL"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    const handler = () => void reload();
    document.addEventListener("admin-products:reload", handler);
    return () => document.removeEventListener("admin-products:reload", handler);
  }, []);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "PPE", label: "PPE", count: ppe.length },
    { key: "TOOL", label: "Tools", count: tools.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex border-b border-zinc-200 dark:border-zinc-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-zinc-300"
            }`}
          >
            {t.key === "PPE" ? <Package className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
            {t.label}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "PPE" ? (
        <ProductTable products={ppe} tab="PPE" onReload={reload} loading={loading} />
      ) : (
        <ProductTable products={tools} tab="TOOL" onReload={reload} loading={loading} />
      )}
    </div>
  );
}
