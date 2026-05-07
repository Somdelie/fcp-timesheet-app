"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Search,
  X,
  RotateCw,
  Printer,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  FileText,
  ShieldCheck,
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
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

type PpeOrderStatus = "PENDING" | "APPROVED" | "PARTIALLY_FULFILLED" | "FULFILLED" | "CANCELLED";

type PpeOrderItem = {
  id: string;
  quantity: number;
  size: string | null;
  color: string | null;
  note: string | null;
  product: {
    id: string;
    name: string;
    thumbnailUrl: string | null;
    colors: string[];
    isDeductible: boolean;
    deductionSplits: number;
    supplierPrices: { price: number; supplierId: string }[];
  };
};

type PpeOrder = {
  id: string;
  status: PpeOrderStatus;
  note: string | null;
  createdAt: string;
  foreman: { id: string; user: { id: string; name: string | null } };
  site: { id: string; name: string; code: string } | null;
  createdByUser: { id: string; name: string | null } | null;
  items: PpeOrderItem[];
};

type Employee = { id: string; firstName: string; lastName: string };

const STATUS_CONFIG: Record<PpeOrderStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300" },
  APPROVED: { label: "Approved", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  PARTIALLY_FULFILLED: { label: "Part. Fulfilled", className: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" },
  FULFILLED: { label: "Fulfilled", className: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300" },
  CANCELLED: { label: "Cancelled", className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

function shortId(id: string) {
  return id.slice(-6).toUpperCase();
}

export function PpeOrdersTab() {
  const [orders, setOrders] = useState<PpeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<PpeOrderStatus | "ALL">("ALL");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const [deleteTarget, setDeleteTarget] = useState<PpeOrder | null>(null);
  const [deductOrder, setDeductOrder] = useState<PpeOrder | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [deductEmployeeId, setDeductEmployeeId] = useState("");
  const [deductSplit, setDeductSplit] = useState<"auto" | "1" | "2">("auto");
  const [deductApplyTo, setDeductApplyTo] = useState<"CURRENT" | "NEXT">("CURRENT");
  const [submittingDeduct, setSubmittingDeduct] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/admin/ppe-orders", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setOrders(json.data ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load PPE orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadEmployees() {
    setLoadingEmployees(true);
    try {
      const res = await fetch(`/api/employees?show=active`, { credentials: "include" });
      const json = await res.json();
      if (res.ok) setEmployees(json.employees ?? json.data ?? []);
    } catch {
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }

  function openDeductDialog(order: PpeOrder) {
    setDeductOrder(order);
    setDeductEmployeeId("");
    setDeductSplit("auto");
    setDeductApplyTo("CURRENT");
    loadEmployees();
  }

  async function handlePrint(order: PpeOrder) {
    const data = {
      orderNumber: `PPE-${shortId(order.id)}`,
      issuedDate: fmtDate(order.createdAt),
      foremanName: order.foreman.user.name ?? "Unknown",
      siteName: order.site?.name ?? "Unknown Site",
      siteCode: order.site?.code ?? null,
      issuedBy: order.createdByUser?.name ?? null,
      items: order.items.map((item) => {
        const priceEntry = item.product.supplierPrices?.[0];
        const unitPrice = priceEntry ? Number((priceEntry.price as any).toString?.() ?? priceEntry.price) : null;
        return {
          productName: item.product.name,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          unitPrice: item.product.isDeductible ? unitPrice : null,
          deductible: item.product.isDeductible,
          note: item.note,
        };
      }),
    };
    try {
      const res = await fetch("/api/app/admin/ppe-order/pdf", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF");
    }
  }

  async function handleApplyDeductions() {
    if (!deductOrder || !deductEmployeeId) { toast.error("Please select an employee"); return; }
    setSubmittingDeduct(true);
    try {
      const splitOverride = deductSplit === "1" ? 1 : deductSplit === "2" ? 2 : undefined;
      const res = await fetch(`/api/app/admin/ppe-orders/${deductOrder.id}/deductions`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employeeId: deductEmployeeId, foremanId: deductOrder.foreman.id, splitOverride, applyTo: deductApplyTo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create deductions");
      toast.success(`${json.deductions?.length ?? 0} deduction(s) created`);
      setDeductOrder(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create deductions");
    } finally {
      setSubmittingDeduct(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/app/admin/ppe-orders/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      toast.success("Order deleted");
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete order");
    }
  }

  const filtered = orders.filter((o) => {
    if (filterStatus !== "ALL" && o.status !== filterStatus) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      o.foreman.user.name?.toLowerCase().includes(term) ||
      o.site?.name.toLowerCase().includes(term) ||
      o.site?.code.toLowerCase().includes(term) ||
      shortId(o.id).toLowerCase().includes(term)
    );
  });

  const columns: ColumnDef<PpeOrder>[] = [
    {
      id: "orderNum",
      header: () => <span>Order #</span>,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-muted-foreground">PPE-{shortId(row.original.id)}</span>
      ),
      enableSorting: false,
    },
    {
      id: "createdAt",
      accessorFn: (r) => r.createdAt,
      header: ({ column }) => {
        const s = column.getIsSorted();
        return (
          <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => column.toggleSorting(s === "asc")}>
            Date
            {s === "asc" ? <ChevronUp className="h-4 w-4" /> : s === "desc" ? <ChevronDown className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        );
      },
      cell: ({ row }) => <span className="text-sm">{fmtDate(row.original.createdAt)}</span>,
    },
    {
      id: "foreman",
      header: () => <span>Foreman</span>,
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.foreman.user.name ?? "—"}</span>,
      enableSorting: false,
    },
    {
      id: "site",
      header: () => <span>Site</span>,
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.site ? (
            <><span className="font-medium">{row.original.site.name}</span><span className="ml-1 text-xs text-muted-foreground">({row.original.site.code})</span></>
          ) : <span className="text-muted-foreground">—</span>}
        </div>
      ),
      enableSorting: false,
    },
    {
      id: "items",
      header: () => <span>Items</span>,
      cell: ({ row }) => {
        const items = row.original.items;
        const deductible = items.filter((i) => i.product.isDeductible).length;
        return (
          <div className="text-sm">
            <span className="font-semibold">{items.length}</span>
            {deductible > 0 && <span className="ml-1 text-xs text-muted-foreground">({deductible} deductible)</span>}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "status",
      header: () => <span>Status</span>,
      cell: ({ row }) => {
        const cfg = STATUS_CONFIG[row.original.status] ?? STATUS_CONFIG.PENDING;
        return <Badge className={`${cfg.className} hover:${cfg.className} border-0`}>{cfg.label}</Badge>;
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const order = row.original;
        const canDeduct = order.status !== "CANCELLED" && order.status !== "FULFILLED" && order.items.some((i) => i.product.isDeductible);
        return (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" title="Print order" onClick={() => handlePrint(order)}>
              <Printer className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Apply deductions" disabled={!canDeduct} onClick={() => openDeductDialog(order)}>
              <ShieldCheck className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive" title="Delete" onClick={() => setDeleteTarget(order)} disabled={order.status === "FULFILLED"}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data: filtered, columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const deductionPreview = deductOrder
    ? deductOrder.items
        .filter((i) => i.product.isDeductible && i.product.supplierPrices?.[0])
        .map((i) => {
          const unitPrice = Number((i.product.supplierPrices[0].price as any).toString?.() ?? i.product.supplierPrices[0].price);
          const splits = deductSplit === "2" ? 2 : deductSplit === "1" ? 1 : (i.product.deductionSplits ?? 1);
          const label = [i.color, i.size].filter(Boolean).join("-") || "";
          return { name: i.product.name + (label ? ` (${label})` : ""), qty: i.quantity, unitPrice, total: unitPrice * i.quantity, splits };
        })
    : [];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search foreman, site…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {(Object.keys(STATUS_CONFIG) as PpeOrderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={load}><RotateCw className="h-4 w-4" /></Button>
      </div>

      {/* Table */}
      {!loading && filtered.length === 0 ? (
        <div className="border border-dashed border-zinc-300 dark:border-zinc-700/50 bg-white/50 dark:bg-card/30 p-12 text-center rounded-lg">
          <FileText className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="font-semibold">No PPE orders found</p>
          <p className="mt-1 text-sm text-muted-foreground">Adjust your filters or create an order from the foreman app.</p>
        </div>
      ) : (
        <div className="border bg-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="border-collapse">
              <TableHeader className="bg-muted/60">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent">
                    {hg.headers.map((h) => (
                      <TableHead key={h.id} className="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No results.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
            <div className="text-muted-foreground hidden text-sm lg:flex">
              Showing {filtered.length === 0 ? 0 : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filtered.length)} of {filtered.length} orders
            </div>
            <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
              <div className="flex w-fit items-center justify-center text-sm font-medium">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
              </div>
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}><ChevronsLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}><ChevronsRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete PPE Order"
        description={`Delete order PPE-${deleteTarget ? shortId(deleteTarget.id) : ""}? This cannot be undone.`}
        onConfirm={handleDelete} confirmText="Delete" variant="destructive"
      />

      {/* Apply Deductions dialog */}
      <Dialog open={!!deductOrder} onOpenChange={(o) => !o && setDeductOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply Deductions — PPE-{deductOrder ? shortId(deductOrder.id) : ""}</DialogTitle>
            <DialogDescription>Select the employee to deduct. Only deductible items with a price will be processed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Employee *</label>
              {loadingEmployees ? (
                <div className="text-sm text-muted-foreground py-2">Loading…</div>
              ) : (
                <Select value={deductEmployeeId || "NONE"} onValueChange={(v) => setDeductEmployeeId(v === "NONE" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select employee…" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="NONE">Select employee…</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Apply to fortnight</label>
              <Select value={deductApplyTo} onValueChange={(v) => setDeductApplyTo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CURRENT">Current fortnight</SelectItem>
                  <SelectItem value="NEXT">Next fortnight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Deduction split</label>
              <Select value={deductSplit} onValueChange={(v) => setDeductSplit(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (per product setting)</SelectItem>
                  <SelectItem value="1">Full in 1 fortnight</SelectItem>
                  <SelectItem value="2">Half / half over 2 fortnights</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {deductionPreview.length > 0 ? (
              <div className="rounded border border-border overflow-hidden">
                <div className="bg-muted/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deduction Preview</div>
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Item</th>
                      <th className="px-3 py-1.5 text-center font-medium">Qty</th>
                      <th className="px-3 py-1.5 text-right font-medium">Unit</th>
                      <th className="px-3 py-1.5 text-right font-medium">Total</th>
                      <th className="px-3 py-1.5 text-center font-medium">Split</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deductionPreview.map((row, i) => (
                      <tr key={i} className={i % 2 !== 0 ? "bg-muted/20" : ""}>
                        <td className="px-3 py-1.5 font-medium">{row.name}</td>
                        <td className="px-3 py-1.5 text-center tabular-nums">{row.qty}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">R {row.unitPrice.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold">R {row.total.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-center text-muted-foreground">{row.splits}×</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/40 border-t border-border">
                    <tr>
                      <td className="px-3 py-1.5 font-semibold" colSpan={3}>Total deduction</td>
                      <td className="px-3 py-1.5 text-right font-bold tabular-nums">R {deductionPreview.reduce((s, r) => s + r.total, 0).toFixed(2)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="rounded border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                No deductible items with prices in this order.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeductOrder(null)}>Cancel</Button>
            <Button onClick={handleApplyDeductions} disabled={submittingDeduct || !deductEmployeeId || deductionPreview.length === 0}>
              {submittingDeduct ? "Creating…" : "Create Deductions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
