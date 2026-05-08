"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Plus,
  Trash2,
  RotateCw,
  MinusCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Check,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  User,
  CalendarDays,
  DollarSign,
  Package,
  HardHat,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatCurrency";

/* ─── Types ─── */

type EmployeeDto = { id: string; name: string };
type ForemanDto = { id: string; name: string };
type ProductDto = { id: string; name: string; price: number };

type DeductionRow = {
  id: string;
  type: "CASH" | "PRODUCT";
  applyTo: "CURRENT" | "NEXT";
  employee: { id: string; name: string };
  foreman: { id: string; name: string };
  product: { id: string; name: string; price: string } | null;
  quantity: number | null;
  amount: string;
  note: string | null;
  createdAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ─── Component ─── */

export default function DeductionsPage() {
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [foremen, setForemen] = useState<ForemanDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);

  const [entries, setEntries] = useState<DeductionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterApplyTo, setFilterApplyTo] = useState("all");
  const [filterForemanId, setFilterForemanId] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Create sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formForemanId, setFormForemanId] = useState("");
  const [formType, setFormType] = useState<"CASH" | "PRODUCT">("CASH");
  const [formApplyTo, setFormApplyTo] = useState<"CURRENT" | "NEXT">("CURRENT");
  const [formAmount, setFormAmount] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formNote, setFormNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Combobox open states
  const [empOpen, setEmpOpen] = useState(false);
  const [foremanOpen, setForemanOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Table
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  /* ── Load lookups ── */
  useEffect(() => {
    async function load() {
      try {
        const [empRes, foremenRes, productsRes] = await Promise.all([
          fetch("/api/employees?show=active", { credentials: "include" }),
          fetch("/api/app/admin/foremen", {
            credentials: "include",
            headers: { accept: "application/json" },
          }),
          fetch("/api/app/admin/products", {
            credentials: "include",
            headers: { accept: "application/json" },
          }),
        ]);
        const [empJson, foremenJson, productsJson] = await Promise.all([
          empRes.json().catch(() => null),
          foremenRes.json().catch(() => null),
          productsRes.json().catch(() => null),
        ]);
        setEmployees(
          (empJson?.employees ?? []).map((e: any) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`.trim(),
          })),
        );
        setForemen(
          (foremenJson?.foremen ?? foremenJson?.data ?? []).map((f: any) => ({
            id: f.foremanId ?? f.id,
            name: f.user?.name ?? f.name ?? "Unknown",
          })),
        );
        setProducts(
          (productsJson?.products ?? productsJson?.data ?? [])
            .filter((p: any) => p.isActive !== false)
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              price: Number(p.price ?? 0),
            })),
        );
      } catch {
        /* silently fail */
      }
    }
    load();
  }, []);

  /* ── Load deductions ── */
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterApplyTo !== "all") params.set("applyTo", filterApplyTo);
      if (filterForemanId !== "all") params.set("foremanId", filterForemanId);
      if (filterFrom) params.set("startISO", filterFrom);
      if (filterTo) params.set("endISO", filterTo);

      const res = await fetch(
        `/api/app/admin/deductions?${params.toString()}`,
        { credentials: "include", headers: { accept: "application/json" } },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setEntries(json?.deductions ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load deductions");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterApplyTo, filterForemanId, filterFrom, filterTo]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  /* ── Submit ── */
  async function handleSubmit() {
    if (!formEmployeeId) {
      toast.error("Select an employee");
      return;
    }
    if (!formForemanId) {
      toast.error("Select a foreman");
      return;
    }
    if (formType === "CASH" && (!formAmount || Number(formAmount) <= 0)) {
      toast.error("Enter a valid cash amount");
      return;
    }
    if (formType === "PRODUCT" && !formProductId) {
      toast.error("Select a product");
      return;
    }
    if (formType === "PRODUCT" && (!formQuantity || Number(formQuantity) < 1)) {
      toast.error("Enter quantity (min 1)");
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        employeeId: formEmployeeId,
        foremanId: formForemanId,
        type: formType,
        applyTo: formApplyTo,
        note: formNote.trim() || undefined,
      };
      if (formType === "CASH") {
        body.amount = Number(formAmount);
      } else {
        body.productId = formProductId;
        body.quantity = Number(formQuantity);
      }

      const res = await fetch("/api/app/admin/deductions", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to create");
      toast.success("Deduction created");
      setSheetOpen(false);
      loadEntries();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Delete ── */
  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/app/admin/deductions/${deleteId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      toast.success("Deleted");
      setDeleteId(null);
      loadEntries();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  }

  /* ── Computed ── */
  const totalCash = useMemo(
    () =>
      entries
        .filter((e) => e.type === "CASH")
        .reduce((s, e) => s + Number(e.amount), 0),
    [entries],
  );
  const totalProduct = useMemo(
    () =>
      entries
        .filter((e) => e.type === "PRODUCT")
        .reduce((s, e) => s + Number(e.amount), 0),
    [entries],
  );
  const selectedProduct = products.find((p) => p.id === formProductId);
  const formPreviewAmount =
    formType === "PRODUCT" && selectedProduct && formQuantity
      ? selectedProduct.price * Number(formQuantity)
      : formType === "CASH" && formAmount
        ? Number(formAmount)
        : 0;

  /* ── Columns ── */
  const columns: ColumnDef<DeductionRow>[] = useMemo(
    () => [
      {
        id: "createdAt",
        accessorKey: "createdAt",
        size: 120,
        header: ({ column }) => {
          const s = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(s === "asc")}
            >
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              Date
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
          <span className="text-xs whitespace-nowrap">
            {fmtDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "employee",
        accessorFn: (r) => r.employee.name,
        header: ({ column }) => {
          const s = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(s === "asc")}
            >
              <User className="h-4 w-4 text-sky-600" />
              Employee
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
          <span className="font-semibold text-sm capitalize">
            {row.original.employee.name}
          </span>
        ),
      },
      {
        id: "foreman",
        accessorFn: (r) => r.foreman.name,
        size: 140,
        header: ({ column }) => {
          const s = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(s === "asc")}
            >
              <HardHat className="h-4 w-4 text-amber-600" />
              Foreman
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
          <span className="text-sm capitalize">
            {row.original.foreman.name}
          </span>
        ),
      },
      {
        id: "type",
        accessorKey: "type",
        size: 100,
        header: () => (
          <div className="flex items-center gap-1">
            <Package className="h-4 w-4 text-violet-600" />
            Type
          </div>
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded",
              row.original.type === "CASH"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-violet-100 text-violet-800",
            )}
          >
            {row.original.type}
          </span>
        ),
      },
      {
        id: "applyTo",
        accessorKey: "applyTo",
        size: 100,
        header: () => <div>Period</div>,
        cell: ({ row }) => (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded",
              row.original.applyTo === "CURRENT"
                ? "bg-blue-100 text-blue-800"
                : "bg-orange-100 text-orange-800",
            )}
          >
            {row.original.applyTo === "CURRENT" ? "Current" : "Next"}
          </span>
        ),
      },
      {
        id: "detail",
        size: 180,
        header: () => <div>Detail</div>,
        cell: ({ row }) => {
          const r = row.original;
          if (r.type === "PRODUCT" && r.product) {
            return (
              <span className="text-xs text-muted-foreground">
                {r.product.name} × {r.quantity ?? 1}
              </span>
            );
          }
          return (
            <span className="text-xs text-muted-foreground">
              {r.note ?? "—"}
            </span>
          );
        },
      },
      {
        id: "amount",
        accessorKey: "amount",
        size: 110,
        header: () => (
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-rose-600" />
            Amount
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-semibold">
            {formatCurrency(Number(row.original.amount))}
          </span>
        ),
      },
      {
        id: "actions",
        size: 70,
        header: () => <div className="text-center">Del</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteId(row.original.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  function openSheet() {
    setFormEmployeeId("");
    setFormForemanId("");
    setFormType("CASH");
    setFormApplyTo("CURRENT");
    setFormAmount("");
    setFormProductId("");
    setFormQuantity("");
    setFormNote("");
    setSheetOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      {/* Controls bar */}
      <div className="rounded border border-border/50 bg-card/80 backdrop-blur-sm p-3 shadow-sm transition-all hover:shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row items-end sm:justify-between">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              Deductions — foreman reductions for cash penalties or product/PPE
              issuances.
            </label>
            <div className="flex gap-2 flex-wrap items-end">
              <Select
                value={filterType}
                onValueChange={(v) => {
                  setFilterType(v);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              >
                <SelectTrigger className="h-10 w-36">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="PRODUCT">Product</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterApplyTo}
                onValueChange={(v) => {
                  setFilterApplyTo(v);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              >
                <SelectTrigger className="h-10 w-36">
                  <SelectValue placeholder="All periods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All periods</SelectItem>
                  <SelectItem value="CURRENT">Current</SelectItem>
                  <SelectItem value="NEXT">Next</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterForemanId}
                onValueChange={(v) => {
                  setFilterForemanId(v);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              >
                <SelectTrigger className="h-10 w-48">
                  <SelectValue placeholder="All foremen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All foremen</SelectItem>
                  {foremen.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={filterFrom}
                onChange={(e) => {
                  setFilterFrom(e.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                className="h-10 w-40"
              />
              <Input
                type="date"
                value={filterTo}
                onChange={(e) => {
                  setFilterTo(e.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                className="h-10 w-40"
              />
              <Button
                variant="outline"
                className="h-10"
                onClick={() => {
                  setFilterType("all");
                  setFilterApplyTo("all");
                  setFilterForemanId("all");
                  setFilterFrom("");
                  setFilterTo("");
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button className="gap-2 shrink-0" size="lg" onClick={openSheet}>
            <Plus className="h-4 w-4" />
            Add Deduction
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <RotateCw className="h-6 w-6 text-muted-foreground animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Loading deductions…
          </h3>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <MinusCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            No deductions found
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust your filters, or add a new deduction to get started.
          </p>
        </div>
      ) : (
        <div className="border bg-card">
          <div className="overflow-x-auto">
            <Table className="border-collapse">
              <TableHeader className="bg-muted/60">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent">
                    {hg.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        style={{
                          width:
                            header.column.getSize() !== 150
                              ? header.column.getSize()
                              : undefined,
                        }}
                        className="border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
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
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/50">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{
                            width:
                              cell.column.getSize() !== 150
                                ? cell.column.getSize()
                                : undefined,
                          }}
                          className="border border-border px-3 py-1"
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
            <div className="text-muted-foreground hidden text-sm lg:flex">
              Showing{" "}
              {table.getState().pagination.pageIndex *
                table.getState().pagination.pageSize +
                1}{" "}
              to{" "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) *
                  table.getState().pagination.pageSize,
                entries.length,
              )}{" "}
              of {entries.length} entries
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
                    {[5, 10, 20, 50].map((ps) => (
                      <SelectItem key={ps} value={String(ps)}>
                        {ps}
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

      {/* Create Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-105 overflow-y-auto border-l border-border bg-background p-0">
          <div className="px-6 pt-6 pb-5 border-b border-border">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-8 w-8 rounded bg-foreground flex items-center justify-center">
                <MinusCircle className="h-4 w-4 text-background" />
              </div>
              <SheetTitle className="text-base font-semibold text-foreground tracking-tight">
                Add Deduction
              </SheetTitle>
            </div>
            <p className="text-xs text-muted-foreground ml-11">
              Apply a cash penalty or product-based deduction to an employee.
            </p>
          </div>

          <div className="px-6 py-6 space-y-5">
            {/* Employee */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Employee
              </label>
              <Popover open={empOpen} onOpenChange={setEmpOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal h-10 border-border bg-background text-foreground hover:bg-accent transition-colors"
                  >
                    <span className="truncate text-sm">
                      {formEmployeeId ? (
                        (employees.find((e) => e.id === formEmployeeId)
                          ?.name ?? (
                          <span className="text-muted-foreground">
                            Select employee
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">
                          Select employee
                        </span>
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0 shadow-lg border-border bg-popover"
                  align="start"
                >
                  <Command className="bg-popover">
                    <CommandInput
                      placeholder="Search employee..."
                      className="text-sm"
                    />
                    <CommandList>
                      <CommandEmpty className="text-xs text-muted-foreground py-4 text-center">
                        No employee found.
                      </CommandEmpty>
                      <CommandGroup>
                        {employees.map((e) => (
                          <CommandItem
                            key={e.id}
                            value={e.name}
                            onSelect={() => {
                              setFormEmployeeId(e.id);
                              setEmpOpen(false);
                            }}
                            className="text-sm"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5",
                                formEmployeeId === e.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {e.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Foreman */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Foreman
              </label>
              <Popover open={foremanOpen} onOpenChange={setForemanOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal h-10 border-border bg-background text-foreground hover:bg-accent transition-colors"
                  >
                    <span className="truncate text-sm">
                      {formForemanId ? (
                        (foremen.find((f) => f.id === formForemanId)?.name ?? (
                          <span className="text-muted-foreground">
                            Select foreman
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">
                          Select foreman
                        </span>
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0 shadow-lg border-border bg-popover"
                  align="start"
                >
                  <Command className="bg-popover">
                    <CommandInput
                      placeholder="Search foreman..."
                      className="text-sm"
                    />
                    <CommandList>
                      <CommandEmpty className="text-xs text-muted-foreground py-4 text-center">
                        No foreman found.
                      </CommandEmpty>
                      <CommandGroup>
                        {foremen.map((f) => (
                          <CommandItem
                            key={f.id}
                            value={f.name}
                            onSelect={() => {
                              setFormForemanId(f.id);
                              setForemanOpen(false);
                            }}
                            className="text-sm"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5",
                                formForemanId === f.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {f.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="border-t border-border pt-1" />

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Type
              </label>
              <Select
                value={formType}
                onValueChange={(v) => setFormType(v as "CASH" | "PRODUCT")}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">
                    Cash — direct amount deduction
                  </SelectItem>
                  <SelectItem value="PRODUCT">
                    Product — based on PPE/product price
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Apply To */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Apply To
              </label>
              <Select
                value={formApplyTo}
                onValueChange={(v) => setFormApplyTo(v as "CURRENT" | "NEXT")}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CURRENT">Current fortnight</SelectItem>
                  <SelectItem value="NEXT">Next fortnight</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-border pt-1" />

            {/* CASH fields */}
            {formType === "CASH" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Amount (R)
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 150.00"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="h-10 border-border bg-background text-sm placeholder:text-muted-foreground"
                />
              </div>
            )}

            {/* PRODUCT fields */}
            {formType === "PRODUCT" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Product
                  </label>
                  <Popover open={productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal h-10 border-border bg-background text-foreground hover:bg-accent transition-colors"
                      >
                        <span className="truncate text-sm">
                          {formProductId ? (
                            products.find((p) => p.id === formProductId) ? (
                              `${products.find((p) => p.id === formProductId)!.name} — ${formatCurrency(products.find((p) => p.id === formProductId)!.price)}`
                            ) : (
                              <span className="text-muted-foreground">
                                Select product
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground">
                              Select product
                            </span>
                          )}
                        </span>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0 shadow-lg border-border bg-popover"
                      align="start"
                    >
                      <Command className="bg-popover">
                        <CommandInput
                          placeholder="Search product..."
                          className="text-sm"
                        />
                        <CommandList>
                          <CommandEmpty className="text-xs text-muted-foreground py-4 text-center">
                            No product found.
                          </CommandEmpty>
                          <CommandGroup>
                            {products.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={p.name}
                                onSelect={() => {
                                  setFormProductId(p.id);
                                  setProductOpen(false);
                                }}
                                className="text-sm"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-3.5 w-3.5",
                                    formProductId === p.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <span>{p.name}</span>
                                <span className="ml-auto text-muted-foreground font-mono text-xs">
                                  {formatCurrency(p.price)}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Quantity
                  </label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 2"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    className="h-10 border-border bg-background text-sm placeholder:text-muted-foreground"
                  />
                </div>
              </>
            )}

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Note{" "}
                <span className="normal-case font-normal text-muted-foreground/50">
                  (optional)
                </span>
              </label>
              <Input
                placeholder="Reason for deduction..."
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                className="h-10 border-border bg-background text-sm placeholder:text-muted-foreground"
              />
            </div>

            {/* Preview */}
            {formPreviewAmount > 0 && (
              <div className="rounded border border-border bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {formType === "PRODUCT"
                        ? "Cost Preview"
                        : "Deduction Amount"}
                    </div>
                    {formType === "PRODUCT" &&
                      selectedProduct &&
                      formQuantity && (
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(selectedProduct.price)} ×{" "}
                          {formQuantity} units
                        </div>
                      )}
                  </div>
                  <div className="text-xl font-bold text-foreground tabular-nums">
                    {formatCurrency(formPreviewAmount)}
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <Button
              className="w-full h-11 bg-foreground hover:bg-foreground/80 text-background text-sm font-semibold tracking-wide rounded transition-colors mt-2"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-background/30 border-t-background animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save Deduction"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete Deduction"
        description="Are you sure you want to delete this deduction? This cannot be undone and may revert linked order status."
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
