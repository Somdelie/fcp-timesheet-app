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
  Clock,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Check,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Hash,
  User,
  CalendarDays,
  Tag,
  DollarSign,
  Users,
  Timer,
  Calculator,
  Search,
  Printer,
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
import { printOvertimeEntries } from "@/lib/generateOvertimePrint";

/* ─── Types ─── */

type SiteDto = { id: string; name: string; code: string | null };
type ForemanDto = { id: string; name: string };
type OvertimePriceDto = {
  id: string;
  label: string;
  rate: number;
  isActive: boolean;
};

type OvertimeEntry = {
  id: string;
  siteId: string;
  siteName: string;
  siteCode: string | null;
  foremanId: string;
  foremanName: string;
  workDate: string;
  overtimePriceId: string;
  overtimePriceLabel: string;
  rateAtCreation: number;
  numberOfEmployees: number;
  hoursWorked: number;
  totalCost: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function siteLabel(name: string, code: string | null | undefined) {
  return code ? `${code} — ${name}` : name;
}

/* ─── Component ─── */

export default function OvertimeEntriesPage() {
  // Lookups
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [foremen, setForemen] = useState<ForemanDto[]>([]);
  const [prices, setPrices] = useState<OvertimePriceDto[]>([]);

  // Entries
  const [entries, setEntries] = useState<OvertimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Create sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formSiteId, setFormSiteId] = useState("");
  const [formForemanId, setFormForemanId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formPriceId, setFormPriceId] = useState("");
  const [formEmployees, setFormEmployees] = useState("");
  const [formHours, setFormHours] = useState("");
  const [formNote, setFormNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [foremanOpen, setForemanOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [filterSiteId, setFilterSiteId] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Pagination
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  /* ── Load lookups ── */
  useEffect(() => {
    async function load() {
      try {
        const [sitesRes, foremenRes, pricesRes] = await Promise.all([
          fetch("/api/app/admin/sites?fields=lite", {
            credentials: "include",
            headers: { accept: "application/json" },
          }),
          fetch("/api/app/admin/foremen", {
            credentials: "include",
            headers: { accept: "application/json" },
          }),
          fetch("/api/app/admin/overtime-prices?includeInactive=false", {
            credentials: "include",
            headers: { accept: "application/json" },
          }),
        ]);
        const [sitesJson, foremenJson, pricesJson] = await Promise.all([
          sitesRes.json().catch(() => null),
          foremenRes.json().catch(() => null),
          pricesRes.json().catch(() => null),
        ]);
        setSites(
          (sitesJson?.sites ?? sitesJson?.data ?? []).map((s: any) => ({
            id: s.id,
            name: s.name,
            code: s.code ?? null,
          })),
        );
        setForemen(
          (foremenJson?.foremen ?? foremenJson?.data ?? []).map((f: any) => ({
            id: f.foremanId ?? f.id,
            name: f.user?.name ?? f.name ?? "Unknown",
          })),
        );
        setPrices(pricesJson?.data ?? []);
      } catch {
        /* silently fail */
      }
    }
    load();
  }, []);

  /* ── Load entries ── */
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSiteId && filterSiteId !== "all")
        params.set("siteId", filterSiteId);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const res = await fetch(
        `/api/app/admin/overtime-entries?${params.toString()}`,
        { credentials: "include", headers: { accept: "application/json" } },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setEntries(json?.data ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load overtime entries");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterSiteId, filterFrom, filterTo]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  /* ── Submit new entry ── */
  async function handleSubmit() {
    if (!formSiteId) {
      toast.error("Select a site");
      return;
    }
    if (!formForemanId) {
      toast.error("Select a foreman");
      return;
    }
    if (!formDate) {
      toast.error("Select a date");
      return;
    }
    if (!formPriceId) {
      toast.error("Select an overtime price");
      return;
    }
    if (!formEmployees || Number(formEmployees) < 1) {
      toast.error("Enter number of employees (min 1)");
      return;
    }
    if (!formHours || Number(formHours) <= 0) {
      toast.error("Enter hours worked (must be > 0)");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/app/admin/overtime-entries", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          siteId: formSiteId,
          foremanId: formForemanId,
          workDate: formDate,
          overtimePriceId: formPriceId,
          numberOfEmployees: Number(formEmployees),
          hoursWorked: Number(formHours),
          note: formNote.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to create");
      toast.success("Overtime entry created");
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
      const res = await fetch(`/api/app/admin/overtime-entries/${deleteId}`, {
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
  const selectedPrice = prices.find((p) => p.id === formPriceId);
  const formPreviewTotal =
    selectedPrice && formEmployees && formHours
      ? selectedPrice.rate * Number(formEmployees) * Number(formHours)
      : 0;

  const totalCostAll = useMemo(
    () => entries.reduce((s, e) => s + e.totalCost, 0),
    [entries],
  );
  const totalEmployeesAll = useMemo(
    () => entries.reduce((s, e) => s + e.numberOfEmployees, 0),
    [entries],
  );

  /* ── Column defs (matches SitesTable pattern) ── */
  const columns: ColumnDef<OvertimeEntry>[] = useMemo(
    () => [
      {
        id: "workDate",
        accessorKey: "workDate",
        size: 120,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              Date
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
          <span className="text-xs whitespace-nowrap">
            {fmtDate(row.original.workDate)}
          </span>
        ),
      },
      {
        id: "site",
        accessorFn: (row) => siteLabel(row.siteName, row.siteCode),
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <Building2 className="h-4 w-4 text-sky-600" />
              Site
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
          <span className="font-semibold uppercase text-sm">
            {siteLabel(row.original.siteName, row.original.siteCode)}
          </span>
        ),
      },
      {
        id: "foreman",
        accessorKey: "foremanName",
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <User className="h-4 w-4 text-violet-600" />
              Foreman
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
          <span className="text-sm capitalize">{row.original.foremanName}</span>
        ),
      },
      {
        id: "priceType",
        accessorKey: "overtimePriceLabel",
        size: 140,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(isSorted === "asc")}
            >
              <Tag className="h-4 w-4 text-amber-600" />
              Price Type
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
          <span className="text-sm">{row.original.overtimePriceLabel}</span>
        ),
      },
      {
        id: "rate",
        accessorKey: "rateAtCreation",
        size: 110,
        header: () => (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Rate
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-medium">
            {formatCurrency(row.original.rateAtCreation)}/hr
          </span>
        ),
      },
      {
        id: "employees",
        accessorKey: "numberOfEmployees",
        size: 110,
        header: () => (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            Employees
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-center block">
            {row.original.numberOfEmployees}
          </span>
        ),
      },
      {
        id: "hours",
        accessorKey: "hoursWorked",
        size: 100,
        header: () => (
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-orange-600" />
            Hours
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-center block">
            {row.original.hoursWorked}h
          </span>
        ),
      },
      {
        id: "total",
        accessorKey: "totalCost",
        size: 120,
        header: () => (
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-rose-600" />
            Total
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-semibold">
            {formatCurrency(row.original.totalCost)}
          </span>
        ),
      },
      {
        id: "actions",
        size: 80,
        header: () => <div className="text-center">Actions</div>,
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
    setFormSiteId(sites[0]?.id ?? "");
    setFormForemanId("");
    setFormDate("");
    setFormPriceId("");
    setFormEmployees("");
    setFormHours("");
    setFormNote("");
    setSheetOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      {/* Controls bar (matches SitesList) */}
      <div className="rounded border border-border/50 bg-card/80 backdrop-blur-sm p-3 shadow-sm transition-all hover:shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row items-end sm:justify-between">
          <div className="flex-3">
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              Overtime Entries Record overtime worked at sites. Use the filters
              to narrow by site and date range.
            </label>
            <div className="flex gap-2 flex-wrap items-end">
              <div>
                <Select
                  value={filterSiteId}
                  onValueChange={(v) => {
                    setFilterSiteId(v);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                >
                  <SelectTrigger className="h-10 w-52">
                    <SelectValue placeholder="All sites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sites</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {siteLabel(s.name, s.code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => {
                    setFilterFrom(e.target.value);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                  className="h-10 w-40"
                />
              </div>
              <div>
                <Input
                  type="date"
                  value={filterTo}
                  onChange={(e) => {
                    setFilterTo(e.target.value);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                  className="h-10 w-40"
                />
              </div>
              <Button
                variant="outline"
                className="h-10"
                onClick={() => {
                  setFilterSiteId("all");
                  setFilterFrom("");
                  setFilterTo("");
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              size="lg"
              disabled={entries.length === 0}
              onClick={() => {
                const selectedSite =
                  filterSiteId !== "all"
                    ? sites.find((s) => s.id === filterSiteId)
                    : undefined;
                printOvertimeEntries(entries, {
                  filterSiteName: selectedSite
                    ? siteLabel(selectedSite.name, selectedSite.code)
                    : undefined,
                  filterFrom: filterFrom || undefined,
                  filterTo: filterTo || undefined,
                });
              }}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button className="gap-2" size="lg" onClick={openSheet}>
              <Plus className="h-4 w-4" />
              Add Overtime
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-3 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium">
            Total Entries
          </div>
          <div className="text-2xl font-bold mt-1">{entries.length}</div>
        </div>
        <div className="rounded border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-3 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium">
            Total Employees (OT)
          </div>
          <div className="text-2xl font-bold mt-1">{totalEmployeesAll}</div>
        </div>
        <div className="rounded border border-border/50 bg-card/80 backdrop-blur-sm px-4 py-3 shadow-sm">
          <div className="text-xs text-muted-foreground font-medium">
            Total Cost
          </div>
          <div className="text-2xl font-bold mt-1">
            {formatCurrency(totalCostAll)}
          </div>
        </div>
      </div>

      {/* Table (matches SitesTable) */}
      {loading ? (
        <div className="rounded border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <RotateCw className="h-6 w-6 text-muted-foreground animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Loading overtime entries…
          </h3>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            No overtime entries found
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your filters, or add a new overtime entry to get
            started.
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
                {table.getRowModel().rows?.length ? (
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

          {/* Pagination (matches SitesTable) */}
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
                    {[5, 10, 20, 50, 100].map((ps) => (
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

      {/* Create Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-105 overflow-y-auto border-l border-border bg-background p-0">
          {/* Header */}
          <div className="px-6 pt-6 pb-5 border-b border-border">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-8 w-8 rounded bg-foreground flex items-center justify-center">
                <Clock className="h-4 w-4 text-background" />
              </div>
              <SheetTitle className="text-base font-semibold text-foreground tracking-tight">
                Add Overtime Entry
              </SheetTitle>
            </div>
            <p className="text-xs text-muted-foreground ml-11">
              Fill in the details to log an overtime record.
            </p>
          </div>

          <div className="px-6 py-6 space-y-5">
            {/* Site */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Site
              </label>
              <Popover open={siteOpen} onOpenChange={setSiteOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={siteOpen}
                    className="w-full justify-between font-normal h-10 border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <span className="truncate text-sm">
                      {formSiteId ? (
                        (() => {
                          const s = sites.find((s) => s.id === formSiteId);
                          return s ? (
                            siteLabel(s.name, s.code)
                          ) : (
                            <span className="text-muted-foreground">
                              Select site
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground">
                          Select site
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
                      placeholder="Search site..."
                      className="text-sm text-foreground"
                    />
                    <CommandList>
                      <CommandEmpty className="text-xs text-muted-foreground py-4 text-center">
                        No site found.
                      </CommandEmpty>
                      <CommandGroup>
                        {sites.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={siteLabel(s.name, s.code)}
                            onSelect={() => {
                              setFormSiteId(s.id);
                              setSiteOpen(false);
                            }}
                            className="text-sm text-foreground"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5 text-foreground",
                                formSiteId === s.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {siteLabel(s.name, s.code)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Date
              </label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="h-10 border-border bg-background text-foreground text-sm hover:border-foreground/30 focus:border-foreground transition-colors"
              />
            </div>

            {/* Divider */}
            <div className="border-t border-border pt-1" />

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
                    aria-expanded={foremanOpen}
                    className="w-full justify-between font-normal h-10 border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
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
                      className="text-sm text-foreground"
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
                            className="text-sm text-foreground"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5 text-foreground",
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

            {/* Overtime Rate */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Overtime Rate
              </label>
              <Popover open={priceOpen} onOpenChange={setPriceOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={priceOpen}
                    className="w-full justify-between font-normal h-10 border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <span className="truncate text-sm">
                      {formPriceId ? (
                        (() => {
                          const p = prices.find((p) => p.id === formPriceId);
                          return p ? (
                            `${p.label} — ${formatCurrency(p.rate)}/hr`
                          ) : (
                            <span className="text-muted-foreground">
                              Select rate
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground">
                          Select rate
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
                      placeholder="Search rate..."
                      className="text-sm text-foreground"
                    />
                    <CommandList>
                      <CommandEmpty className="text-xs text-muted-foreground py-4 text-center">
                        No rate found.
                      </CommandEmpty>
                      <CommandGroup>
                        {prices.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.label} ${formatCurrency(p.rate)}`}
                            onSelect={() => {
                              setFormPriceId(p.id);
                              setPriceOpen(false);
                            }}
                            className="text-sm text-foreground"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5 text-foreground",
                                formPriceId === p.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <span>{p.label}</span>
                            <span className="ml-auto text-muted-foreground font-mono text-xs">
                              {formatCurrency(p.rate)}/hr
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Divider */}
            <div className="border-t border-border pt-1" />

            {/* Employees + Hours side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Employees
                </label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 5"
                  value={formEmployees}
                  onChange={(e) => setFormEmployees(e.target.value)}
                  className="h-10 border-border bg-background text-foreground text-sm placeholder:text-muted-foreground hover:border-foreground/30 focus:border-foreground transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Hours
                </label>
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder="e.g. 2"
                  value={formHours}
                  onChange={(e) => setFormHours(e.target.value)}
                  className="h-10 border-border bg-background text-foreground text-sm placeholder:text-muted-foreground hover:border-foreground/30 focus:border-foreground transition-colors"
                />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Note{" "}
                <span className="normal-case font-normal text-muted-foreground/50">
                  (optional)
                </span>
              </label>
              <Input
                placeholder="Add a note..."
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                className="h-10 border-border bg-background text-foreground text-sm placeholder:text-muted-foreground hover:border-foreground/30 focus:border-foreground transition-colors"
              />
            </div>

            {/* Cost Preview */}
            {formPreviewTotal > 0 && (
              <div className="rounded border border-border bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Cost Preview
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(selectedPrice?.rate ?? 0)}/hr &times;{" "}
                      {formEmployees} employees &times; {formHours}h
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-foreground tabular-nums">
                      {formatCurrency(formPreviewTotal)}
                    </div>
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
                "Save Overtime Entry"
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
        title="Delete Overtime Entry"
        description="Are you sure you want to delete this overtime entry? This cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
