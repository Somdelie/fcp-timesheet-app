"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
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
  User,
  CalendarDays,
  Tag,
  DollarSign,
  Users,
  Timer,
  Calculator,
  Printer,
  Pencil,
  CreditCard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
import {
  printOvertimeEntries,
  type OvertimePrintColumnId,
} from "@/lib/generateOvertimePrint";

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
  supervisorId: string | null;
  supervisorName: string | null;
  workDate: string;
  overtimePriceId: string;
  overtimePriceLabel: string;
  rateAtCreation: number;
  numberOfEmployees: number;
  hoursWorked: number;
  totalCost: number;
  note: string | null;
  paidAt: string | null;
  paidBy: string | null;
  createdBy: string | null;
  createdAt: string;
};

const OVERTIME_PRINT_COLUMN_OPTIONS: Array<{
  id: OvertimePrintColumnId;
  label: string;
}> = [
  { id: "date", label: "Date" },
  { id: "site", label: "Site" },
  { id: "foreman", label: "Foreman" },
  { id: "supervisor", label: "Supervisor" },
  { id: "priceType", label: "Price Type" },
  { id: "rate", label: "Rate" },
  { id: "employees", label: "Guys" },
  { id: "hours", label: "Hours" },
  { id: "total", label: "Total" },
];

const DEFAULT_OVERTIME_PRINT_COLUMNS = OVERTIME_PRINT_COLUMN_OPTIONS.map(
  (column) => column.id,
);

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

function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function dateFromMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export default function OvertimeEntriesPage() {
  // Lookups
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [foremen, setForemen] = useState<ForemanDto[]>([]);
  const [prices, setPrices] = useState<OvertimePriceDto[]>([]);
  const [supervisors, setSupervisors] = useState<
    { id: string; name: string }[]
  >([]);

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
  const [formDateKeys, setFormDateKeys] = useState<string[]>([]);
  const [formEmployeesByDate, setFormEmployeesByDate] = useState<
    Record<string, string>
  >({});
  const [formHoursByDate, setFormHoursByDate] = useState<
    Record<string, string>
  >({});
  const [batchCalendarMonth, setBatchCalendarMonth] = useState(new Date());
  const [formNote, setFormNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [siteOpen, setSiteOpen] = useState(false);
  const [foremanOpen, setForemanOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [printOptionsOpen, setPrintOptionsOpen] = useState(false);
  const [printColumnIds, setPrintColumnIds] = useState<
    OvertimePrintColumnId[]
  >(DEFAULT_OVERTIME_PRINT_COLUMNS);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [filterSiteId, setFilterSiteId] = useState("all");
  const [filterSupervisorId, setFilterSupervisorId] = useState("ALL");
  const [filterPaid, setFilterPaid] = useState("ALL");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Pagination
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  /* ── Load lookups ── */
  useEffect(() => {
    async function load() {
      try {
        const [sitesRes, foremenRes, pricesRes, supervisorsRes] =
          await Promise.all([
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
            fetch("/api/app/admin/supervisors", {
              credentials: "include",
              headers: { accept: "application/json" },
            }),
          ]);
        const [sitesJson, foremenJson, pricesJson, supervisorsJson] =
          await Promise.all([
            sitesRes.json().catch(() => null),
            foremenRes.json().catch(() => null),
            pricesRes.json().catch(() => null),
            supervisorsRes.json().catch(() => null),
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
        setSupervisors(
          (supervisorsJson?.supervisors ?? []).map((s: any) => ({
            id: s.id,
            name: s.name ?? "Supervisor",
          })),
        );
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
      if (filterSupervisorId && filterSupervisorId !== "ALL")
        params.set("supervisorId", filterSupervisorId);
      if (filterPaid && filterPaid !== "ALL") params.set("paid", filterPaid);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const res = await fetch(
        `/api/app/admin/overtime-entries?${params.toString()}`,
        { credentials: "include", headers: { accept: "application/json" } },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setEntries(json?.data ?? []);
      setRowSelection({});
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load overtime entries");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterSiteId, filterSupervisorId, filterPaid, filterFrom, filterTo]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  /* ── Submit new entry ── */
  function setBatchDates(dates: Date[] | undefined) {
    const keys = Array.from(
      new Set((dates ?? []).map((date) => dateKeyFromDate(date))),
    ).sort();
    setFormDateKeys(keys);
    setFormEmployeesByDate((prev) =>
      Object.fromEntries(
        keys.map((key) => [key, prev[key] ?? (formEmployees || "1")]),
      ),
    );
    setFormHoursByDate((prev) =>
      Object.fromEntries(
        keys.map((key) => [key, prev[key] ?? (formHours || "1")]),
      ),
    );
  }

  function setBatchDefaultHours(value: string) {
    setFormHours(value);
    if (!editId) {
      setFormHoursByDate((prev) =>
        Object.fromEntries(Object.keys(prev).map((key) => [key, value])),
      );
    }
  }

  function setBatchDefaultEmployees(value: string) {
    setFormEmployees(value);
    if (!editId) {
      setFormEmployeesByDate((prev) =>
        Object.fromEntries(Object.keys(prev).map((key) => [key, value])),
      );
    }
  }

  function removeBatchDate(key: string) {
    setFormDateKeys((prev) => prev.filter((dateKey) => dateKey !== key));
    setFormEmployeesByDate((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormHoursByDate((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit() {
    if (!formSiteId) {
      toast.error("Select a site");
      return;
    }
    if (!formForemanId) {
      toast.error("Select a foreman");
      return;
    }
    if (editId && !formDate) {
      toast.error("Select a date");
      return;
    }
    if (!editId && formDateKeys.length === 0) {
      toast.error("Select at least one date");
      return;
    }
    if (!formPriceId) {
      toast.error("Select an overtime price");
      return;
    }
    if (editId && (!formEmployees || Number(formEmployees) < 1)) {
      toast.error("Enter number of guys (min 1)");
      return;
    }
    if (
      !editId &&
      formDateKeys.some((dateKey) => Number(formEmployeesByDate[dateKey]) < 1)
    ) {
      toast.error("Enter guys for each date");
      return;
    }
    if (editId && (!formHours || Number(formHours) <= 0)) {
      toast.error("Enter hours worked (must be > 0)");
      return;
    }
    if (
      !editId &&
      formDateKeys.some((dateKey) => Number(formHoursByDate[dateKey]) <= 0)
    ) {
      toast.error("Enter hours worked for each date");
      return;
    }

    setSubmitting(true);
    try {
      const body = editId
        ? {
            siteId: formSiteId,
            foremanId: formForemanId,
            workDate: formDate,
            overtimePriceId: formPriceId,
            numberOfEmployees: Number(formEmployees),
            hoursWorked: Number(formHours),
            note: formNote.trim() || undefined,
          }
        : {
            siteId: formSiteId,
            foremanId: formForemanId,
            overtimePriceId: formPriceId,
            numberOfEmployees: Number(formEmployees),
            entries: formDateKeys.map((dateKey) => ({
              workDate: dateKey,
              numberOfEmployees: Number(formEmployeesByDate[dateKey]),
              hoursWorked: Number(formHoursByDate[dateKey]),
            })),
            note: formNote.trim() || undefined,
          };
      const res = await fetch(
        editId
          ? `/api/app/admin/overtime-entries/${editId}`
          : "/api/app/admin/overtime-entries",
        {
          method: editId ? "PATCH" : "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");
      toast.success(
        editId
          ? "Overtime entry updated"
          : `${formDateKeys.length} overtime ${formDateKeys.length === 1 ? "entry" : "entries"} created`,
      );
      setSheetOpen(false);
      setEditId(null);
      loadEntries();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePaid(entry: OvertimeEntry, paid: boolean) {
    try {
      const res = await fetch(`/api/app/admin/overtime-entries/${entry.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ action: paid ? "MARK_PAID" : "MARK_UNPAID" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error ?? "Failed to update paid status");
      toast.success(paid ? "Marked as paid" : "Marked as unpaid");
      loadEntries();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update paid status");
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
  const selectedDateRows = formDateKeys.map((dateKey) => ({
    dateKey,
    employees: formEmployeesByDate[dateKey] ?? formEmployees,
    hours: formHoursByDate[dateKey] ?? formHours,
  }));
  const previewEmployeeHours = editId
    ? Number(formEmployees || 0) * Number(formHours || 0)
    : selectedDateRows.reduce(
        (sum, row) => sum + Number(row.employees || 0) * Number(row.hours || 0),
        0,
      );
  const formPreviewTotal =
    selectedPrice && previewEmployeeHours > 0
      ? selectedPrice.rate * previewEmployeeHours
      : 0;

  /* ── Column defs (matches SitesTable pattern) ── */
  const columns: ColumnDef<OvertimeEntry>[] = [
    {
      id: "select",
      size: 48,
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all overtime entries on this page"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select overtime entry"
          />
        </div>
      ),
      enableSorting: false,
    },
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
      id: "supervisor",
      accessorKey: "supervisorName",
      size: 150,
      header: () => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-600" />
          Supervisor
        </div>
      ),
      cell: ({ row }) => (
        <span className="text-sm capitalize">
          {row.original.supervisorName ?? "-"}
        </span>
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
          Guys
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
      id: "paid",
      accessorFn: (row) => (row.paidAt ? "Paid" : "Unpaid"),
      size: 110,
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => {
        const paid = Boolean(row.original.paidAt);
        return (
          <div className="text-center">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                paid
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700",
              )}
              title={
                row.original.paidAt
                  ? `Paid${row.original.paidBy ? ` by ${row.original.paidBy}` : ""}`
                  : "Unpaid"
              }
            >
              {paid ? "Paid" : "Unpaid"}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      size: 130,
      header: () => <div className="text-center">Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Edit overtime entry"
            onClick={() => openEdit(row.original)}
          >
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={row.original.paidAt ? "Mark unpaid" : "Mark paid"}
            onClick={() => handlePaid(row.original, !row.original.paidAt)}
          >
            <CreditCard
              className={cn(
                "h-4 w-4",
                row.original.paidAt
                  ? "text-emerald-600"
                  : "text-muted-foreground",
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete overtime entry"
            onClick={() => setDeleteId(row.original.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting, pagination, rowSelection },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const selectedEntries = table
    .getSelectedRowModel()
    .rows.map((row) => row.original);

  function togglePrintColumn(id: OvertimePrintColumnId, checked: boolean) {
    setPrintColumnIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      const next = prev.filter((columnId) => columnId !== id);
      return next.length > 0 ? next : prev;
    });
  }

  function printSelectedOvertimeEntries() {
    const selectedSite =
      filterSiteId !== "all"
        ? sites.find((s) => s.id === filterSiteId)
        : undefined;

    printOvertimeEntries(selectedEntries, {
      filterSiteName: selectedSite
        ? siteLabel(selectedSite.name, selectedSite.code)
        : undefined,
      filterFrom: filterFrom || undefined,
      filterTo: filterTo || undefined,
      columns: printColumnIds,
    });
    setPrintOptionsOpen(false);
  }

  function openSheet() {
    setEditId(null);
    setFormSiteId(sites[0]?.id ?? "");
    setFormForemanId("");
    setFormDate("");
    setFormPriceId("");
    setFormEmployees("1");
    setFormHours("1");
    setFormDateKeys([]);
    setFormEmployeesByDate({});
    setFormHoursByDate({});
    setBatchCalendarMonth(
      filterFrom ? dateFromDateKey(filterFrom) : new Date(),
    );
    setFormNote("");
    setSheetOpen(true);
  }

  function openEdit(entry: OvertimeEntry) {
    setEditId(entry.id);
    setFormSiteId(entry.siteId);
    setFormForemanId(entry.foremanId);
    setFormDate(entry.workDate);
    setFormPriceId(entry.overtimePriceId);
    setFormEmployees(String(entry.numberOfEmployees));
    setFormHours(String(entry.hoursWorked));
    setFormDateKeys([]);
    setFormEmployeesByDate({});
    setFormHoursByDate({});
    setFormNote(entry.note ?? "");
    setSheetOpen(true);
  }

  return (
    <div className="mx-auto w-full space-y-5">
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
                <Select
                  value={filterSupervisorId}
                  onValueChange={(v) => {
                    setFilterSupervisorId(v);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                >
                  <SelectTrigger className="h-10 w-52">
                    <SelectValue placeholder="All supervisors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All supervisors</SelectItem>
                    {supervisors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select
                  value={filterPaid}
                  onValueChange={(v) => {
                    setFilterPaid(v);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                >
                  <SelectTrigger className="h-10 w-36">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All status</SelectItem>
                    <SelectItem value="UNPAID">Unpaid</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
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
                  setFilterSupervisorId("ALL");
                  setFilterPaid("ALL");
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
            <Popover open={printOptionsOpen} onOpenChange={setPrintOptionsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2"
                  size="lg"
                  disabled={selectedEntries.length === 0}
                >
                  <Printer className="h-4 w-4" />
                  Print Selected
                  {selectedEntries.length > 0
                    ? ` (${selectedEntries.length})`
                    : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="end">
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Print Columns
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Choose what should appear on the printed report.
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {OVERTIME_PRINT_COLUMN_OPTIONS.map((column) => (
                      <label
                        key={column.id}
                        className="flex cursor-pointer items-center gap-2 rounded border border-border px-2 py-2 text-sm"
                      >
                        <Checkbox
                          checked={printColumnIds.includes(column.id)}
                          onCheckedChange={(checked) =>
                            togglePrintColumn(column.id, checked === true)
                          }
                        />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-between gap-2 border-t border-border pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPrintColumnIds(DEFAULT_OVERTIME_PRINT_COLUMNS)
                      }
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-2"
                      onClick={printSelectedOvertimeEntries}
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button className="gap-2" size="lg" onClick={openSheet}>
              <Plus className="h-4 w-4" />
              Add Overtime
            </Button>
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
        <SheetContent
          side="bottom"
          className="w-full h-full p-0 m-0 gap-0 overflow-hidden"
        >
          {/* Header */}
          <div className="shrink-0 px-6 pt-4 pb-4 border-b border-border">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-8 w-8 rounded bg-foreground flex items-center justify-center">
                <Clock className="h-4 w-4 text-background" />
              </div>
              <SheetTitle className="text-base font-semibold text-foreground tracking-tight">
                {editId ? "Edit Overtime Entry" : "Add Overtime Entry"}
              </SheetTitle>
            </div>
            <p className="text-xs text-muted-foreground ml-11">
              {editId
                ? "Update the overtime record values."
                : "Fill in the details to log an overtime record."}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-5">
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

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            {/* Date */}
            {editId ? (
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
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Dates
                  </label>
                  {formDateKeys.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {formDateKeys.length} selected
                    </span>
                  )}
                </div>
                <Input
                  type="month"
                  value={monthKeyFromDate(batchCalendarMonth)}
                  onChange={(e) => {
                    if (e.target.value) {
                      setBatchCalendarMonth(dateFromMonthKey(e.target.value));
                    }
                  }}
                  className="h-10 border-border bg-background text-foreground text-sm hover:border-foreground/30 focus:border-foreground transition-colors"
                />
                <div className="rounded border border-border bg-background">
                  <Calendar
                    mode="multiple"
                    month={batchCalendarMonth}
                    onMonthChange={setBatchCalendarMonth}
                    selected={formDateKeys.map(dateFromDateKey)}
                    onSelect={setBatchDates}
                    className="mx-auto"
                  />
                </div>
              </div>
            )}

            <div className="space-y-5">

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

            {/* Guys + Hours side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {editId ? "Guys" : "Default Guys"}
                </label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 5"
                  value={formEmployees}
                  onChange={(e) => setBatchDefaultEmployees(e.target.value)}
                  className="h-10 border-border bg-background text-foreground text-sm placeholder:text-muted-foreground hover:border-foreground/30 focus:border-foreground transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {editId ? "Hours" : "Default Hours"}
                </label>
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder="e.g. 2"
                  value={formHours}
                  onChange={(e) => setBatchDefaultHours(e.target.value)}
                  className="h-10 border-border bg-background text-foreground text-sm placeholder:text-muted-foreground hover:border-foreground/30 focus:border-foreground transition-colors"
                />
              </div>
            </div>

            {!editId && selectedDateRows.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Guys + Hours Per Date
                </label>
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_84px_84px_36px] gap-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <span>Date</span>
                    <span>Guys</span>
                    <span>Hours</span>
                    <span />
                  </div>
                  {selectedDateRows.map((row) => (
                    <div
                      key={row.dateKey}
                      className="grid grid-cols-[1fr_84px_84px_36px] items-center gap-2 rounded border border-border bg-muted/30 p-2"
                    >
                      <div className="text-sm font-medium text-foreground">
                        {fmtDate(row.dateKey)}
                      </div>
                      <Input
                        type="number"
                        min="1"
                        value={row.employees}
                        onChange={(e) =>
                          setFormEmployeesByDate((prev) => ({
                            ...prev,
                            [row.dateKey]: e.target.value,
                          }))
                        }
                        className="h-9 border-border bg-background text-sm"
                      />
                      <Input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={row.hours}
                        onChange={(e) =>
                          setFormHoursByDate((prev) => ({
                            ...prev,
                            [row.dateKey]: e.target.value,
                          }))
                        }
                        className="h-9 border-border bg-background text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => removeBatchDate(row.dateKey)}
                        title="Remove date"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
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
                placeholder="Add a note..."
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                className="h-10 border-border bg-background text-foreground text-sm placeholder:text-muted-foreground hover:border-foreground/30 focus:border-foreground transition-colors"
              />
            </div>
            </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-background px-6 py-3">
            <div className="ml-auto flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              {formPreviewTotal > 0 && (
                <div className="rounded border border-border bg-muted/50 px-3 py-2 sm:min-w-52">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Cost Preview
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {previewEmployeeHours} employee-hours
                    </span>
                    <span className="text-base font-bold text-foreground tabular-nums">
                      {formatCurrency(formPreviewTotal)}
                    </span>
                  </div>
                </div>
              )}

              <Button
                className="h-11 bg-foreground px-8 text-sm font-semibold tracking-wide text-background transition-colors hover:bg-foreground/80 sm:min-w-64"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-background/30 border-t-background animate-spin" />
                    Saving...
                  </span>
                ) : editId ? (
                  "Update Overtime Entry"
                ) : formDateKeys.length > 0 ? (
                  `Save ${formDateKeys.length} Overtime ${formDateKeys.length === 1 ? "Entry" : "Entries"}`
                ) : (
                  "Save Overtime Entries"
                )}
              </Button>
            </div>
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
