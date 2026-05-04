"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import * as React from "react";
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
  RotateCw,
  Search,
  X,
  Pencil,
  Plus,
  Printer,
  Package,
  User2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type EquipmentHolder = { id: string; name: string };
type EquipmentItem = {
  id: string;
  holderId: string | null;
  holder: EquipmentHolder | null;
  category: string;
  item: string;
  quantity: number;
  condition: string;
  notes: string | null;
  location: string | null;
};

type ItemForm = {
  item: string;
  category: string;
  quantity: number;
  condition: string;
  holderId: string;
  location: string;
  notes: string;
};

const CONDITIONS = ["Good", "Needs Service", "Beyond Repair", "Stolen"] as const;

const CONDITION_COLORS: Record<string, string> = {
  Good: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Needs Service": "bg-amber-100 text-amber-700 border-amber-200",
  "Beyond Repair": "bg-red-100 text-red-700 border-red-200",
  Stolen: "bg-slate-100 text-slate-600 border-slate-200",
};

const BLANK_FORM: ItemForm = {
  item: "",
  category: "",
  quantity: 1,
  condition: "Good",
  holderId: "__none__",
  location: "",
  notes: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipmentInventoryPage() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [holders, setHolders] = useState<EquipmentHolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeHolder, setActiveHolder] = useState<string>("__totals__");

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EquipmentItem | null>(null);
  const [editForm, setEditForm] = useState<ItemForm>(BLANK_FORM);
  const [editSaving, setEditSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<ItemForm>(BLANK_FORM);
  const [addSaving, setAddSaving] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([{ id: "category", desc: false }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 5 });
  const [totalsPage, setTotalsPage] = useState(0);
  const [totalsPageSize, setTotalsPageSize] = useState(5);

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/admin/equipment-inventory");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setItems(data.items ?? []);
      setHolders(data.holders ?? []);
    } catch {
      toast.error("Failed to load equipment inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setActiveHolder("__totals__"); }, [search]);
  useEffect(() => { setPagination((p) => ({ ...p, pageIndex: 0 })); setTotalsPage(0); }, [activeHolder]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.item.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.holder?.name ?? "").toLowerCase().includes(q) ||
        i.condition.toLowerCase().includes(q) ||
        (i.location ?? "").toLowerCase().includes(q) ||
        (i.notes ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const sortedHolders = useMemo(
    () =>
      [...holders].sort((a, b) => {
        if (a.name === "Office") return -1;
        if (b.name === "Office") return 1;
        return a.name.localeCompare(b.name);
      }),
    [holders],
  );

  const companyTotals = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const i of filteredItems) {
      if (!map.has(i.category)) map.set(i.category, new Map());
      const c = map.get(i.category)!;
      c.set(i.condition, (c.get(i.condition) ?? 0) + i.quantity);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, condMap]) => ({
        category,
        total: Array.from(condMap.values()).reduce((s, v) => s + v, 0),
        byCondition: condMap,
      }));
  }, [filteredItems]);

  const activeItems = useMemo(() => {
    if (activeHolder === "__totals__") return [];
    return filteredItems.filter(
      (i) => (i.holderId ?? "__unassigned__") === activeHolder,
    );
  }, [filteredItems, activeHolder]);

  const holderQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of filteredItems) {
      const k = i.holderId ?? "__unassigned__";
      m.set(k, (m.get(k) ?? 0) + i.quantity);
    }
    return m;
  }, [filteredItems]);

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const filteredQty = filteredItems.reduce((s, i) => s + i.quantity, 0);

  const totalsTotalPages = Math.max(1, Math.ceil(companyTotals.length / totalsPageSize));
  const paginatedTotals = companyTotals.slice(totalsPage * totalsPageSize, (totalsPage + 1) * totalsPageSize);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const openEdit = useCallback((item: EquipmentItem) => {
    setEditTarget(item);
    setEditForm({
      item: item.item,
      category: item.category,
      quantity: item.quantity,
      condition: item.condition,
      holderId: item.holderId ?? "__none__",
      location: item.location ?? "",
      notes: item.notes ?? "",
    });
    setEditOpen(true);
  }, []);

  async function handleEditSave() {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/app/admin/equipment-inventory/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...editForm,
          holderId: editForm.holderId === "__none__" ? null : editForm.holderId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed");
      toast.success("Item updated");
      setEditOpen(false);
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to save");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAddSave() {
    setAddSaving(true);
    try {
      const res = await fetch("/api/app/admin/equipment-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...addForm,
          holderId: addForm.holderId === "__none__" ? null : addForm.holderId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed");
      toast.success("Item added");
      setAddOpen(false);
      setAddForm(BLANK_FORM);
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to add");
    } finally {
      setAddSaving(false);
    }
  }

  // ── Print ─────────────────────────────────────────────────────────────────

  function handlePrint() {
    const date = new Date().toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const condBadge = (cond: string) => {
      const palette: Record<string, string> = {
        Good: "background:#d1fae5;color:#065f46",
        "Needs Service": "background:#fef3c7;color:#92400e",
        "Beyond Repair": "background:#fee2e2;color:#991b1b",
        Stolen: "background:#f1f5f9;color:#475569",
      };
      const style = palette[cond] ?? "background:#f1f5f9;color:#475569";
      return `<span style="${style};padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;border:1px solid rgba(0,0,0,.1)">${cond}</span>`;
    };

    const supervisorPage = (holderName: string, rows: EquipmentItem[]) => {
      const subtotal = rows.reduce((s, i) => s + i.quantity, 0);
      const rowsHtml = rows
        .sort((a, b) => a.category.localeCompare(b.category) || a.item.localeCompare(b.item))
        .map(
          (i, idx) => `
          <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"}">
            <td>${i.category}</td>
            <td>${i.item}</td>
            <td style="text-align:center;font-weight:700">${i.quantity}</td>
            <td>${condBadge(i.condition)}</td>
            <td>${i.location ?? "—"}</td>
            <td>${i.notes ?? "—"}</td>
          </tr>`,
        )
        .join("");

      return `
        <div class="supervisor-page">
          <div class="page-header">
            <div>
              <div class="company-name">FIRST CLASS PROJECTS</div>
              <div class="doc-title">Equipment Inventory — ${holderName}</div>
            </div>
            <div class="meta-right">
              <div class="meta-line">Printed: ${date}</div>
              <div class="meta-line">${subtotal} item${subtotal !== 1 ? "s" : ""}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Item</th>
                <th style="text-align:center;width:60px">Qty</th>
                <th style="width:130px">Condition</th>
                <th style="width:110px">Location</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="2"><strong>Total</strong></td>
                <td style="text-align:center;font-weight:700">${subtotal}</td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    };

    const pages = sortedHolders
      .map((h) => ({ name: h.name, rows: items.filter((i) => i.holderId === h.id) }))
      .filter((g) => g.rows.length > 0)
      .map((g) => supervisorPage(g.name, g.rows))
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Equipment Inventory — ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; }
    .supervisor-page { padding: 24px 28px; page-break-after: always; }
    .supervisor-page:last-child { page-break-after: avoid; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #1e293b; }
    .company-name { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
    .doc-title { font-size: 18px; font-weight: 700; color: #1e293b; }
    .meta-right { text-align: right; }
    .meta-line { font-size: 10px; color: #64748b; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; }
    thead tr { background: #1e293b; color: white; }
    th { text-align: left; padding: 7px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; border-right: 1px solid rgba(255,255,255,0.15); }
    td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #e2e8f0; vertical-align: middle; }
    tfoot tr { background: #f8fafc; border-top: 2px solid #e2e8f0; }
    tfoot td { font-weight: 600; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>${pages}</body>
</html>`;

    const w = window.open("", "_blank", "width=1000,height=750");
    if (!w) { toast.error("Pop-up blocked — allow pop-ups and try again"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  }

  // ── TanStack Table ────────────────────────────────────────────────────────

  const columns: ColumnDef<EquipmentItem>[] = useMemo(
    () => [
      {
        id: "category",
        accessorKey: "category",
        header: ({ column }) => {
          const sorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Category
              {sorted === "asc" ? <ChevronUp className="h-4 w-4" /> : sorted === "desc" ? <ChevronDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          );
        },
        cell: ({ row }) => (
          <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded">
            {row.original.category}
          </span>
        ),
      },
      {
        id: "item",
        accessorKey: "item",
        header: ({ column }) => {
          const sorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Item
              {sorted === "asc" ? <ChevronUp className="h-4 w-4" /> : sorted === "desc" ? <ChevronDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          );
        },
        cell: ({ row }) => <span className="font-medium">{row.original.item}</span>,
      },
      {
        id: "quantity",
        accessorKey: "quantity",
        size: 80,
        header: ({ column }) => {
          const sorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Qty
              {sorted === "asc" ? <ChevronUp className="h-4 w-4" /> : sorted === "desc" ? <ChevronDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          );
        },
        cell: ({ row }) => (
          <div className="text-center">
            <Badge variant="secondary" className="font-bold">
              {row.original.quantity}
            </Badge>
          </div>
        ),
      },
      {
        id: "condition",
        accessorKey: "condition",
        size: 160,
        header: ({ column }) => {
          const sorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Condition
              {sorted === "asc" ? <ChevronUp className="h-4 w-4" /> : sorted === "desc" ? <ChevronDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          );
        },
        cell: ({ row }) => (
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium border",
              CONDITION_COLORS[row.original.condition] ?? "bg-muted text-muted-foreground border-border",
            )}
          >
            {row.original.condition}
          </span>
        ),
      },
      {
        id: "location",
        accessorKey: "location",
        size: 130,
        header: ({ column }) => {
          const sorted = column.getIsSorted();
          return (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(sorted === "asc")}
            >
              Location
              {sorted === "asc" ? <ChevronUp className="h-4 w-4" /> : sorted === "desc" ? <ChevronDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          );
        },
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.location ?? "—"}</span>
        ),
      },
      {
        id: "notes",
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.notes ?? "—"}</span>
        ),
      },
      {
        id: "actions",
        size: 60,
        header: () => <div className="text-center">Edit</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openEdit(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [openEdit],
  );

  const table = useReactTable({
    data: activeItems,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      {/* Toolbar */}
      <div className="mb-2 rounded border border-zinc-200/50 bg-white/80 backdrop-blur-sm px-3 py-2 shadow-sm transition-all hover:shadow-md dark:border-zinc-700/50 dark:bg-card/40">
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <Input
              placeholder="Search item, category, supervisor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {loading
              ? "Loading…"
              : search
              ? `${filteredQty} of ${totalQty} items`
              : `${totalQty} items · ${holders.length} supervisors`}
          </span>

          <div className="flex items-center gap-1.5 ml-auto">
            <Button size="sm" className="h-8 gap-1.5 px-3" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
              onClick={handlePrint}
              disabled={loading || items.length === 0}
              title="Print all supervisors"
            >
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={fetchData}
            >
              <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Supervisor tab bar */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1 min-w-max">
          <button
            onClick={() => setActiveHolder("__totals__")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap border",
              activeHolder === "__totals__"
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-zinc-300",
            )}
          >
            <Package className="h-3.5 w-3.5" />
            Company Totals
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full",
                activeHolder === "__totals__"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300",
              )}
            >
              {companyTotals.length}
            </span>
          </button>

          {sortedHolders.map((h) => {
            const qty = holderQty.get(h.id) ?? 0;
            const isActive = activeHolder === h.id;
            return (
              <button
                key={h.id}
                onClick={() => setActiveHolder(h.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap border",
                  isActive
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-zinc-300",
                )}
              >
                <User2 className="h-3.5 w-3.5" />
                {h.name}
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300",
                  )}
                >
                  {qty}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table area */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RotateCw className="h-5 w-5 animate-spin mr-2" />
          Loading…
        </div>
      ) : activeHolder === "__totals__" ? (
        /* ── Company Totals ── */
        companyTotals.length === 0 ? (
          <div className="rounded border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
            <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-slate-950 flex items-center justify-center mb-4">
              <Package className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">No items found</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Add equipment items to see totals here.
            </p>
          </div>
        ) : (
          <div className="border bg-card">
            <div className="overflow-x-auto">
              <Table className="border-separate border-spacing-0">
                <TableHeader className="bg-muted/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="border border-zinc-200 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 px-3 py-1">
                      Category
                    </TableHead>
                    {CONDITIONS.map((c) => (
                      <TableHead
                        key={c}
                        className="border border-zinc-200 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 px-3 py-1 text-center"
                      >
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs border font-medium",
                            CONDITION_COLORS[c],
                          )}
                        >
                          {c}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="border border-zinc-200 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 px-3 py-1 text-right">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTotals.map((row) => (
                    <TableRow key={row.category} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                      <TableCell className="border border-zinc-200 dark:border-zinc-700 px-3 py-1 font-medium">
                        {row.category}
                      </TableCell>
                      {CONDITIONS.map((c) => {
                        const qty = row.byCondition.get(c) ?? 0;
                        return (
                          <TableCell key={c} className="border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-center">
                            {qty > 0 ? (
                              <span
                                className={cn(
                                  "inline-block px-2 py-0.5 rounded-md text-xs font-medium border",
                                  CONDITION_COLORS[c],
                                )}
                              >
                                {qty}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-right font-bold">
                        {row.total}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Company Totals pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
              <div className="text-muted-foreground hidden text-sm lg:flex">
                Showing {totalsPage * totalsPageSize + 1} to{" "}
                {Math.min((totalsPage + 1) * totalsPageSize, companyTotals.length)} of{" "}
                {companyTotals.length} categories
              </div>
              <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
                <div className="hidden items-center gap-2 lg:flex">
                  <span className="text-sm font-medium">Rows per page</span>
                  <Select
                    value={String(totalsPageSize)}
                    onValueChange={(v) => { setTotalsPageSize(Number(v)); setTotalsPage(0); }}
                  >
                    <SelectTrigger className="h-8 w-20">
                      <SelectValue placeholder={totalsPageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[5, 10, 25, 50].map((s) => (
                        <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-fit items-center justify-center text-sm font-medium">
                  Page {totalsPage + 1} of {totalsTotalPages}
                </div>
                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                  <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => setTotalsPage(0)} disabled={totalsPage === 0}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTotalsPage((p) => p - 1)} disabled={totalsPage === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTotalsPage((p) => p + 1)} disabled={totalsPage >= totalsTotalPages - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => setTotalsPage(totalsTotalPages - 1)} disabled={totalsPage >= totalsTotalPages - 1}>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        /* ── Per-supervisor TanStack table ── */
        activeItems.length === 0 ? (
          <div className="rounded border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
            <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-slate-950 flex items-center justify-center mb-4">
              <Package className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">No items found</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {search ? "No items match your search." : "No items for this supervisor."}
            </p>
          </div>
        ) : (
          <div className="border bg-card">
            <div className="overflow-x-auto">
              <Table className="border-separate border-spacing-0">
                <TableHeader className="bg-muted/60">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="hover:bg-transparent">
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          style={{ width: header.column.getSize() }}
                          className="border border-zinc-200 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 px-3 py-1"
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
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                          className="border border-zinc-200 dark:border-zinc-700 px-3 py-1"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
              <div className="text-muted-foreground hidden text-sm lg:flex">
                Showing{" "}
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}{" "}
                to{" "}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  activeItems.length,
                )}{" "}
                of {activeItems.length} items
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
                      {[5, 10, 25, 50, 100].map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
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
                    <span className="sr-only">First page</span>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Previous page</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Next page</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="hidden h-8 w-8 lg:flex"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Last page</span>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Equipment Item</DialogTitle>
          </DialogHeader>
          <ItemFormFields form={editForm} onChange={setEditForm} holders={sortedHolders} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={handleEditSave}
              disabled={editSaving || !editForm.item.trim() || !editForm.category.trim()}
            >
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Equipment Item</DialogTitle>
          </DialogHeader>
          <ItemFormFields form={addForm} onChange={setAddForm} holders={sortedHolders} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddSave}
              disabled={addSaving || !addForm.item.trim() || !addForm.category.trim()}
            >
              {addSaving ? "Adding…" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared form fields ───────────────────────────────────────────────────────

function ItemFormFields({
  form,
  onChange,
  holders,
}: {
  form: ItemForm;
  onChange: (f: ItemForm) => void;
  holders: EquipmentHolder[];
}) {
  const set = (patch: Partial<ItemForm>) => onChange({ ...form, ...patch });
  return (
    <div className="grid grid-cols-2 gap-4 py-2">
      <div className="space-y-1.5 col-span-2">
        <Label>Item Name</Label>
        <Input
          value={form.item}
          onChange={(e) => set({ item: e.target.value })}
          placeholder="e.g. 6ft Step Ladder"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Input
          value={form.category}
          onChange={(e) => set({ category: e.target.value })}
          placeholder="e.g. Ladders"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Quantity</Label>
        <Input
          type="number"
          min={0}
          value={form.quantity}
          onChange={(e) => set({ quantity: Number(e.target.value) })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Condition</Label>
        <Select value={form.condition} onValueChange={(v) => set({ condition: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITIONS.map((c) => (
              <SelectItem key={c} value={c}>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium border",
                    CONDITION_COLORS[c],
                  )}
                >
                  {c}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Holder / Supervisor</Label>
        <Select value={form.holderId} onValueChange={(v) => set({ holderId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unassigned</SelectItem>
            {holders.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>
          Location{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          value={form.location}
          onChange={(e) => set({ location: e.target.value })}
          placeholder="e.g. Cape Town"
        />
      </div>
      <div className="space-y-1.5">
        <Label>
          Notes{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          value={form.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Any additional notes"
        />
      </div>
    </div>
  );
}
