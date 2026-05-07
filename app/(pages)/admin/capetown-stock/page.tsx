"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  Plus,
  Pencil,
  Truck,
  ShoppingCart,
  Package,
  Shield,
  Wrench,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown as ExpandIcon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "PPE" | "TOOL";
type OrderStatus = "PENDING" | "ORDERED" | "RECEIVED" | "CANCELLED";

type Variant = {
  id: string;
  size: string | null;
  color: string | null;
  qty: number;
};

type Deployment = {
  id: string;
  qty: number;
  size: string | null;
  color: string | null;
  deployedTo: string;
  notes: string | null;
  deployedAt: string;
};

type StockOrder = {
  id: string;
  qty: number;
  size: string | null;
  color: string | null;
  supplier: string | null;
  status: OrderStatus;
  notes: string | null;
  orderedAt: string;
};

type StockItem = {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  unit: string | null;
  notes: string | null;
  sizes: string[];
  colors: string[];
  variants: Variant[];
  deployments: Deployment[];
  orders: StockOrder[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  PENDING: { label: "Pending", icon: Clock, cls: "bg-amber-100 text-amber-700 border-amber-200" },
  ORDERED: { label: "Ordered", icon: Truck, cls: "bg-blue-100 text-blue-700 border-blue-200" },
  RECEIVED: { label: "Received", icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Cancelled", icon: XCircle, cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg = ORDER_STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cfg.cls)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function variantLabel(size: string | null | undefined, color: string | null | undefined) {
  return [size, color].filter(Boolean).join(" / ") || "—";
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Tags input ───────────────────────────────────────────────────────────────

function TagsInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed)) { setInput(""); return; }
    onChange([...value, trimmed]);
    setInput("");
  }

  return (
    <div className="space-y-1.5">
      <Label>{label} <span className="text-muted-foreground font-normal">(optional)</span></Label>
      <div className="flex gap-1">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
        <Button type="button" size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Variant qty grid ─────────────────────────────────────────────────────────

function VariantGrid({ item }: { item: StockItem }) {
  const { variants, sizes, colors } = item;
  if (variants.length === 0) return null;

  // Both dimensions
  if (sizes.length > 0 && colors.length > 0) {
    return (
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="border border-zinc-200 bg-muted/60 px-2 py-1 text-left font-semibold">Size \ Color</th>
              {colors.map((c) => (
                <th key={c} className="border border-zinc-200 bg-muted/60 px-2 py-1 text-center font-semibold">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((s) => (
              <tr key={s}>
                <td className="border border-zinc-200 px-2 py-1 font-medium bg-muted/30">{s}</td>
                {colors.map((c) => {
                  const v = variants.find((vv) => vv.size === s && vv.color === c);
                  const qty = v?.qty ?? 0;
                  return (
                    <td key={c} className="border border-zinc-200 px-2 py-1 text-center">
                      <span className={cn(
                        "font-bold tabular-nums",
                        qty === 0 && "text-red-500",
                        qty > 0 && qty <= 3 && "text-amber-600",
                        qty > 3 && "text-emerald-700",
                      )}>
                        {qty}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Size only
  if (sizes.length > 0) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {variants.map((v) => (
          <span key={v.id} className={cn(
            "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium",
            v.qty === 0 && "bg-red-50 border-red-200 text-red-700",
            v.qty > 0 && v.qty <= 3 && "bg-amber-50 border-amber-200 text-amber-700",
            v.qty > 3 && "bg-emerald-50 border-emerald-200 text-emerald-700",
          )}>
            {v.size}
            <span className="font-bold">{v.qty}</span>
          </span>
        ))}
      </div>
    );
  }

  // Color only
  return (
    <div className="flex flex-wrap gap-1.5">
      {variants.map((v) => (
        <span key={v.id} className={cn(
          "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium",
          v.qty === 0 && "bg-red-50 border-red-200 text-red-700",
          v.qty > 0 && v.qty <= 3 && "bg-amber-50 border-amber-200 text-amber-700",
          v.qty > 3 && "bg-emerald-50 border-emerald-200 text-emerald-700",
        )}>
          {v.color}
          <span className="font-bold">{v.qty}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CapeTownStockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Category>("PPE");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addCategory, setAddCategory] = useState<Category>("PPE");
  const [addForm, setAddForm] = useState({ name: "", quantity: 0, unit: "", notes: "", sizes: [] as string[], colors: [] as string[] });
  const [addSaving, setAddSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StockItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", quantity: 0, unit: "", notes: "", sizes: [] as string[], colors: [] as string[] });
  const [editSaving, setEditSaving] = useState(false);

  // Deploy dialog
  const [deployOpen, setDeployOpen] = useState(false);
  const [deployTarget, setDeployTarget] = useState<StockItem | null>(null);
  const [deployForm, setDeployForm] = useState({ qty: 1, deployedTo: "", notes: "", size: "", color: "" });
  const [deploySaving, setDeploySaving] = useState(false);

  // Order dialog
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderTarget, setOrderTarget] = useState<StockItem | null>(null);
  const [orderForm, setOrderForm] = useState({ qty: 1, supplier: "", notes: "", size: "", color: "" });
  const [orderSaving, setOrderSaving] = useState(false);

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<StockItem | null>(null);
  const [historyTab, setHistoryTab] = useState<"deployments" | "orders">("deployments");
  const [orderStatusChanging, setOrderStatusChanging] = useState<string | null>(null);

  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/admin/capetown-stock");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setItems(data.items ?? []);
      // Update history target if open
      setHistoryTarget((prev) => {
        if (!prev) return null;
        return (data.items as StockItem[]).find((i) => i.id === prev.id) ?? null;
      });
    } catch {
      toast.error("Failed to load Cape Town stock");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPagination((p) => ({ ...p, pageIndex: 0 })); }, [search, activeTab]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const tabItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => i.category === activeTab)
      .filter(
        (i) =>
          !q ||
          i.name.toLowerCase().includes(q) ||
          (i.unit ?? "").toLowerCase().includes(q) ||
          (i.notes ?? "").toLowerCase().includes(q),
      );
  }, [items, activeTab, search]);

  const ppeCnt = items.filter((i) => i.category === "PPE").length;
  const toolCnt = items.filter((i) => i.category === "TOOL").length;
  const pendingOrders = items.flatMap((i) => i.orders).filter((o) => o.status === "PENDING" || o.status === "ORDERED").length;

  // ── Deploy helpers ────────────────────────────────────────────────────────

  function getDeployVariantQty(item: StockItem | null, size: string, color: string): number {
    if (!item) return 0;
    if (item.variants.length === 0) return item.quantity;
    const v = item.variants.find(
      (vv) => (vv.size ?? "") === size && (vv.color ?? "") === color,
    );
    return v?.qty ?? 0;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!addForm.name.trim()) return;
    setAddSaving(true);
    try {
      const res = await fetch("/api/app/admin/capetown-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addForm, category: addCategory }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed");
      toast.success("Item added");
      setAddOpen(false);
      setAddForm({ name: "", quantity: 0, unit: "", notes: "", sizes: [], colors: [] });
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleEdit() {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/app/admin/capetown-stock/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed");
      toast.success("Item updated");
      setEditOpen(false);
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeploy() {
    if (!deployTarget) return;
    setDeploySaving(true);
    try {
      const hasVariants = deployTarget.variants.length > 0;
      const payload: Record<string, unknown> = { ...deployForm };
      if (!hasVariants) { delete payload.size; delete payload.color; }
      else {
        payload.size = deployForm.size || null;
        payload.color = deployForm.color || null;
      }

      const res = await fetch(`/api/app/admin/capetown-stock/${deployTarget.id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed");
      toast.success("Deployed successfully");
      setDeployOpen(false);
      setDeployForm({ qty: 1, deployedTo: "", notes: "", size: "", color: "" });
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed");
    } finally {
      setDeploySaving(false);
    }
  }

  async function handleOrder() {
    if (!orderTarget) return;
    setOrderSaving(true);
    try {
      const hasVariants = orderTarget.variants.length > 0;
      const payload: Record<string, unknown> = { ...orderForm };
      if (!hasVariants) { delete payload.size; delete payload.color; }
      else {
        payload.size = orderForm.size || null;
        payload.color = orderForm.color || null;
      }

      const res = await fetch(`/api/app/admin/capetown-stock/${orderTarget.id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed");
      toast.success("Order placed");
      setOrderOpen(false);
      setOrderForm({ qty: 1, supplier: "", notes: "", size: "", color: "" });
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed");
    } finally {
      setOrderSaving(false);
    }
  }

  async function handleOrderStatus(item: StockItem, orderId: string, status: OrderStatus) {
    setOrderStatusChanging(orderId);
    try {
      const res = await fetch(`/api/app/admin/capetown-stock/${item.id}/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed");
      toast.success(status === "RECEIVED" ? "Order received — stock updated" : "Order updated");
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed");
    } finally {
      setOrderStatusChanging(null);
    }
  }

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns: ColumnDef<StockItem>[] = useMemo(
    () => [
      {
        id: "expand",
        size: 36,
        header: () => null,
        cell: ({ row }) => {
          const hasVariants = row.original.variants.length > 0;
          if (!hasVariants) return null;
          const isExpanded = expandedRows.has(row.original.id);
          return (
            <button
              onClick={() => setExpandedRows((prev) => {
                const next = new Set(prev);
                isExpanded ? next.delete(row.original.id) : next.add(row.original.id);
                return next;
              })}
              className="text-muted-foreground hover:text-foreground"
            >
              <ExpandIcon className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
            </button>
          );
        },
      },
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => {
          const s = column.getIsSorted();
          return (
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => column.toggleSorting(s === "asc")}>
              Item Name
              {s === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : s === "desc" ? <ChevronDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          );
        },
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.name}</span>
            {(row.original.sizes.length > 0 || row.original.colors.length > 0) && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {row.original.sizes.map((s) => (
                  <span key={s} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0">{s}</span>
                ))}
                {row.original.colors.map((c) => (
                  <span key={c} className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0">{c}</span>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "quantity",
        accessorKey: "quantity",
        size: 110,
        header: ({ column }) => {
          const s = column.getIsSorted();
          return (
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => column.toggleSorting(s === "asc")}>
              Total Stock
              {s === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : s === "desc" ? <ChevronDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          );
        },
        cell: ({ row }) => {
          const qty = row.original.quantity;
          return (
            <Badge variant="secondary" className={cn(
              "font-bold tabular-nums",
              qty === 0 && "bg-red-100 text-red-700 border-red-200",
              qty > 0 && qty <= 5 && "bg-amber-100 text-amber-700 border-amber-200",
              qty > 5 && "bg-emerald-100 text-emerald-700 border-emerald-200",
            )}>
              {qty}{row.original.unit ? ` ${row.original.unit}` : ""}
            </Badge>
          );
        },
      },
      {
        id: "onOrder",
        size: 100,
        header: "On Order",
        cell: ({ row }) => {
          const pending = row.original.orders.filter((o) => o.status === "PENDING" || o.status === "ORDERED");
          const total = pending.reduce((s, o) => s + o.qty, 0);
          return total > 0 ? (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium">+{total}</Badge>
          ) : <span className="text-muted-foreground/40">—</span>;
        },
      },
      {
        id: "notes",
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.notes ?? "—"}</span>,
      },
      {
        id: "actions",
        size: 190,
        header: () => <div className="text-center">Actions</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              size="sm" variant="outline"
              className="h-7 gap-1 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
              onClick={() => {
                setDeployTarget(row.original);
                setDeployForm({ qty: 1, deployedTo: "", notes: "", size: "", color: "" });
                setDeployOpen(true);
              }}
            >
              <Truck className="h-3 w-3" />Deploy
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-7 gap-1 px-2 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => {
                setOrderTarget(row.original);
                setOrderForm({ qty: 1, supplier: "", notes: "", size: "", color: "" });
                setOrderOpen(true);
              }}
            >
              <ShoppingCart className="h-3 w-3" />Order
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="History"
              onClick={() => { setHistoryTarget(row.original); setHistoryTab("deployments"); setHistoryOpen(true); }}
            >
              <ClipboardList className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
              onClick={() => {
                setEditTarget(row.original);
                setEditForm({ name: row.original.name, quantity: row.original.quantity, unit: row.original.unit ?? "", notes: row.original.notes ?? "", sizes: [...row.original.sizes], colors: [...row.original.colors] });
                setEditOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [expandedRows],
  );

  const table = useReactTable({
    data: tabItems,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // ── Derived variant selectors ─────────────────────────────────────────────

  const deployAvailableQty = useMemo(
    () => getDeployVariantQty(deployTarget, deployForm.size, deployForm.color),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deployTarget, deployForm.size, deployForm.color],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const hasVariantsAdd = addForm.sizes.length > 0 || addForm.colors.length > 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cape Town Stock</h1>
          <p className="text-sm text-muted-foreground">PPE & Tools inventory for Cape Town</p>
        </div>
        {pendingOrders > 0 && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {pendingOrders} order{pendingOrders !== 1 ? "s" : ""} pending
          </Badge>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
            <Shield className="h-3.5 w-3.5" /> PPE Items
          </div>
          <div className="text-2xl font-bold">{ppeCnt}</div>
        </div>
        <div className="rounded border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
            <Wrench className="h-3.5 w-3.5" /> Tool Items
          </div>
          <div className="text-2xl font-bold">{toolCnt}</div>
        </div>
        <div className="rounded border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
            <ShoppingCart className="h-3.5 w-3.5" /> Pending Orders
          </div>
          <div className="text-2xl font-bold">{pendingOrders}</div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Category)}>
        <div className="flex items-center gap-3 mb-2">
          <TabsList>
            <TabsTrigger value="PPE" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />PPE
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{ppeCnt}</span>
            </TabsTrigger>
            <TabsTrigger value="TOOL" className="gap-1.5">
              <Wrench className="h-3.5 w-3.5" />Tools
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{toolCnt}</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 ml-auto">
            <div className="relative w-52">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <Input placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
            </div>
            {search && <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
            <Button size="sm" className="h-8 gap-1.5 px-3" onClick={() => { setAddCategory(activeTab); setAddForm({ name: "", quantity: 0, unit: "", notes: "", sizes: [], colors: [] }); setAddOpen(true); }}>
              <Plus className="h-3.5 w-3.5" />Add {activeTab === "PPE" ? "PPE" : "Tool"}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchData}>
              <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {(["PPE", "TOOL"] as Category[]).map((cat) => (
          <TabsContent key={cat} value={cat} className="mt-0">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <RotateCw className="h-5 w-5 animate-spin mr-2" />Loading…
              </div>
            ) : tabItems.length === 0 ? (
              <div className="rounded border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
                <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-slate-950 flex items-center justify-center mb-4">
                  <Package className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="text-lg font-semibold">No {cat === "PPE" ? "PPE" : "tool"} items</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search ? "No items match your search." : `Add your first ${cat === "PPE" ? "PPE" : "tool"} item.`}
                </p>
                {!search && (
                  <Button size="sm" className="mt-4 gap-1.5" onClick={() => { setAddCategory(cat); setAddForm({ name: "", quantity: 0, unit: "", notes: "", sizes: [], colors: [] }); setAddOpen(true); }}>
                    <Plus className="h-3.5 w-3.5" />Add {cat === "PPE" ? "PPE" : "Tool"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="border bg-card">
                <div className="overflow-x-auto">
                  <Table className="border-separate border-spacing-0">
                    <TableHeader className="bg-muted/60">
                      {table.getHeaderGroups().map((hg) => (
                        <TableRow key={hg.id} className="hover:bg-transparent">
                          {hg.headers.map((h) => (
                            <TableHead key={h.id} style={{ width: h.column.getSize() }} className="border border-zinc-200 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 px-3 py-1">
                              {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.map((row) => (
                        <>
                          <TableRow key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id} style={{ width: cell.column.getSize() }} className="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                          {expandedRows.has(row.original.id) && (
                            <TableRow key={`${row.id}-expand`} className="bg-zinc-50/70 dark:bg-zinc-900/20">
                              <TableCell colSpan={columns.length} className="border border-zinc-200 dark:border-zinc-700 px-4 py-3">
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Stock by Variant</p>
                                  <VariantGrid item={row.original} />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
                  <div className="text-muted-foreground hidden text-sm lg:flex">
                    Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
                    {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, tabItems.length)} of{" "}
                    {tabItems.length} items
                  </div>
                  <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
                    <div className="hidden items-center gap-2 lg:flex">
                      <span className="text-sm font-medium">Rows per page</span>
                      <Select value={String(table.getState().pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
                        <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                        <SelectContent side="top">
                          {[10, 25, 50].map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
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
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Add Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add {addCategory === "PPE" ? "PPE" : "Tool"} Item</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Item Name *</Label>
              <Input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder={addCategory === "PPE" ? "e.g. Hard Hat, Safety Vest" : "e.g. Hammer, Extension Lead"} autoFocus />
            </div>
            <div className="col-span-2">
              <TagsInput label="Sizes" value={addForm.sizes} onChange={(v) => setAddForm((f) => ({ ...f, sizes: v }))} placeholder="e.g. S, M, L, XL — press Enter" />
            </div>
            <div className="col-span-2">
              <TagsInput label="Colours" value={addForm.colors} onChange={(v) => setAddForm((f) => ({ ...f, colors: v }))} placeholder="e.g. Yellow, White, Orange — press Enter" />
            </div>
            {!hasVariantsAdd && (
              <div className="space-y-1.5">
                <Label>Initial Quantity</Label>
                <Input type="number" min={0} value={addForm.quantity} onChange={(e) => setAddForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
            )}
            <div className={hasVariantsAdd ? "col-span-2" : ""}>
              <div className="space-y-1.5">
                <Label>Unit <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={addForm.unit} onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))} placeholder="pcs, pairs, sets…" />
              </div>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any additional info" />
            </div>
            {hasVariantsAdd && (
              <div className="col-span-2 rounded bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                Variants will be created for all size × colour combinations. Set quantities per variant when placing orders.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addSaving || !addForm.name.trim()}>{addSaving ? "Adding…" : "Add Item"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Item Name *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="col-span-2">
              <TagsInput label="Sizes" value={editForm.sizes} onChange={(v) => setEditForm((f) => ({ ...f, sizes: v }))} placeholder="e.g. S, M, L, XL" />
            </div>
            <div className="col-span-2">
              <TagsInput label="Colours" value={editForm.colors} onChange={(v) => setEditForm((f) => ({ ...f, colors: v }))} placeholder="e.g. Yellow, White" />
            </div>
            {editForm.sizes.length === 0 && editForm.colors.length === 0 && (
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" min={0} value={editForm.quantity} onChange={(e) => setEditForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
            )}
            <div className={editForm.sizes.length === 0 && editForm.colors.length === 0 ? "" : "col-span-2"}>
              <div className="space-y-1.5">
                <Label>Unit <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))} />
              </div>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editSaving || !editForm.name.trim()}>{editSaving ? "Saving…" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deploy Dialog ── */}
      <Dialog open={deployOpen} onOpenChange={setDeployOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-600" />
              Deploy — {deployTarget?.name}
            </DialogTitle>
          </DialogHeader>

          {deployTarget && deployTarget.variants.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {deployTarget.sizes.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Size *</Label>
                  <Select value={deployForm.size} onValueChange={(v) => setDeployForm((f) => ({ ...f, size: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent>
                      {deployTarget.sizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {deployTarget.colors.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Colour *</Label>
                  <Select value={deployForm.color} onValueChange={(v) => setDeployForm((f) => ({ ...f, color: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select colour" /></SelectTrigger>
                    <SelectContent>
                      {deployTarget.colors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(deployForm.size || deployForm.color) && (
                <div className="col-span-2 text-sm">
                  Available:{" "}
                  <span className={cn("font-bold", deployAvailableQty === 0 && "text-red-600", deployAvailableQty > 0 && "text-emerald-700")}>
                    {deployAvailableQty} {deployTarget.unit ?? ""}
                  </span>
                </div>
              )}
            </div>
          )}

          {deployTarget && deployTarget.variants.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Available: <span className="font-semibold text-foreground">{deployTarget.quantity} {deployTarget.unit ?? ""}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 py-1">
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input
                type="number" min={1}
                max={deployTarget?.variants.length ? deployAvailableQty : deployTarget?.quantity}
                value={deployForm.qty}
                onChange={(e) => setDeployForm((f) => ({ ...f, qty: Number(e.target.value) }))}
                autoFocus={!deployTarget?.variants.length}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Deploy To *</Label>
              <Input value={deployForm.deployedTo} onChange={(e) => setDeployForm((f) => ({ ...f, deployedTo: e.target.value }))} placeholder="Name or site" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={deployForm.notes} onChange={(e) => setDeployForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeployOpen(false)}>Cancel</Button>
            <Button
              onClick={handleDeploy}
              disabled={
                deploySaving ||
                deployForm.qty <= 0 ||
                !deployForm.deployedTo.trim() ||
                (!!deployTarget?.sizes.length && !deployForm.size) ||
                (!!deployTarget?.colors.length && !deployForm.color)
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {deploySaving ? "Deploying…" : "Confirm Deploy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Order Dialog ── */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
              Place Order — {orderTarget?.name}
            </DialogTitle>
          </DialogHeader>

          {orderTarget && orderTarget.variants.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {orderTarget.sizes.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Size *</Label>
                  <Select value={orderForm.size} onValueChange={(v) => setOrderForm((f) => ({ ...f, size: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent>
                      {orderTarget.sizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {orderTarget.colors.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Colour *</Label>
                  <Select value={orderForm.color} onValueChange={(v) => setOrderForm((f) => ({ ...f, color: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select colour" /></SelectTrigger>
                    <SelectContent>
                      {orderTarget.colors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 py-1">
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input type="number" min={1} value={orderForm.qty} onChange={(e) => setOrderForm((f) => ({ ...f, qty: Number(e.target.value) }))} autoFocus={!orderTarget?.variants.length} />
            </div>
            <div className="space-y-1.5">
              <Label>Supplier <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={orderForm.supplier} onChange={(e) => setOrderForm((f) => ({ ...f, supplier: e.target.value }))} placeholder="Supplier name" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={orderForm.notes} onChange={(e) => setOrderForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderOpen(false)}>Cancel</Button>
            <Button
              onClick={handleOrder}
              disabled={
                orderSaving ||
                orderForm.qty <= 0 ||
                (!!orderTarget?.sizes.length && !orderForm.size) ||
                (!!orderTarget?.colors.length && !orderForm.color)
              }
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {orderSaving ? "Placing…" : "Place Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── History Dialog ── */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              History — {historyTarget?.name}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={historyTab} onValueChange={(v) => setHistoryTab(v as "deployments" | "orders")} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-fit">
              <TabsTrigger value="deployments" className="gap-1.5">
                <Truck className="h-3.5 w-3.5" />Deployments
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{historyTarget?.deployments.length ?? 0}</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5" />Orders
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{historyTarget?.orders.length ?? 0}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deployments" className="flex-1 overflow-y-auto mt-3">
              {(historyTarget?.deployments.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No deployments yet.</p>
              ) : (
                <div className="space-y-2">
                  {historyTarget?.deployments.map((d) => (
                    <div key={d.id} className="flex items-start justify-between rounded border px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{d.deployedTo}</span>
                        {(d.size || d.color) && (
                          <span className="ml-2 text-xs bg-muted rounded px-1.5 py-0.5">{variantLabel(d.size, d.color)}</span>
                        )}
                        {d.notes && <span className="text-muted-foreground ml-2">· {d.notes}</span>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <Badge variant="secondary" className="font-bold">{d.qty}</Badge>
                        <span className="text-xs text-muted-foreground">{fmt(d.deployedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders" className="flex-1 overflow-y-auto mt-3">
              {(historyTarget?.orders.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {historyTarget?.orders.map((o) => (
                    <div key={o.id} className="rounded border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="font-bold">{o.qty}</Badge>
                          {(o.size || o.color) && (
                            <span className="text-xs bg-muted rounded px-1.5 py-0.5">{variantLabel(o.size, o.color)}</span>
                          )}
                          {o.supplier && <span className="font-medium">{o.supplier}</span>}
                          {o.notes && <span className="text-muted-foreground">· {o.notes}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <OrderStatusBadge status={o.status} />
                          <span className="text-xs text-muted-foreground">{fmt(o.orderedAt)}</span>
                        </div>
                      </div>
                      {o.status !== "RECEIVED" && o.status !== "CANCELLED" && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                          <span className="text-xs text-muted-foreground">Update:</span>
                          {(["ORDERED", "RECEIVED", "CANCELLED"] as OrderStatus[])
                            .filter((s) => s !== o.status)
                            .map((s) => (
                              <Button
                                key={s}
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs px-2"
                                disabled={orderStatusChanging === o.id}
                                onClick={() => { if (historyTarget) handleOrderStatus(historyTarget, o.id, s); }}
                              >
                                {s === "ORDERED" ? "Mark Ordered" : s === "RECEIVED" ? "Mark Received" : "Cancel"}
                              </Button>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
