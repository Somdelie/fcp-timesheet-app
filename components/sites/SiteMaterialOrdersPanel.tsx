"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Minus,
  X,
  Package,
  Trash2,
  ChevronDown,
  ChevronRight,
  RotateCw,
  ShoppingCart,
  ClipboardList,
  Search,
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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type OrderItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPriceAtOrder: number;
  uomAtOrder: string | null;
  unitSizeAtOrder: number | null;
  note: string | null;
  product: {
    id: string;
    name: string;
    uom: string | null;
    unitSize: number | null;
  };
};

type Order = {
  id: string;
  siteId: string;
  supplierId: string | null;
  reference: string | null;
  note: string | null;
  totalCost: number | null;
  createdAt: string;
  supplier: { id: string; name: string } | null;
  createdByUser: { id: string; name: string } | null;
  items: OrderItem[];
};

type LookupItem = { id: string; name: string };
type ProductLookup = {
  id: string;
  name: string;
  supplier: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
};

type CatalogItem = {
  key: string;
  productId: string;
  productName: string;
  uom: string | null;
  unitSize: number | null;
  category: { id: string; name: string } | null;
};

type CartItem = {
  key: string;
  item: CatalogItem;
  quantity: number;
};

type AggregatedProduct = {
  productId: string;
  productName: string;
  uom: string | null;
  unitSize: number | null;
  totalQuantity: number;
  totalCost: number;
  orderCount: number;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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
function fmtSize(unitSize: number | null, uom: string | null) {
  if (!uom) return unitSize != null ? String(unitSize) : "";
  if (unitSize == null) return uomLabel(uom);
  return `${unitSize}${uomLabel(uom)}`;
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function itemDisplay(item: OrderItem) {
  const size = fmtSize(
    item.unitSizeAtOrder ?? item.product.unitSize,
    item.uomAtOrder ?? item.product.uom,
  );
  return `${item.quantity} × ${size} ${item.product.name}`;
}

/* ------------------------------------------------------------------ */
/*  Aggregation                                                        */
/* ------------------------------------------------------------------ */

function aggregateProducts(orders: Order[]): AggregatedProduct[] {
  const map = new Map<string, AggregatedProduct>();
  for (const order of orders) {
    for (const item of order.items) {
      const uom = item.uomAtOrder ?? item.product.uom ?? "";
      const size = item.unitSizeAtOrder ?? item.product.unitSize;
      const key = `${item.productId}~${uom}~${size ?? ""}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.totalCost += item.quantity * item.unitPriceAtOrder;
        existing.orderCount += 1;
      } else {
        map.set(key, {
          productId: item.productId,
          productName: item.product.name,
          uom: uom || null,
          unitSize: size,
          totalQuantity: item.quantity,
          totalCost: item.quantity * item.unitPriceAtOrder,
          orderCount: 1,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.productName.localeCompare(b.productName),
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/50">
      <span className="text-[11px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
        {value}
      </span>
      {sub && (
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {sub}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function SiteMaterialOrdersPanel({
  siteId,
}: {
  siteId: string;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<LookupItem[]>([]);
  const [products, setProducts] = useState<ProductLookup[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const [posOpen, setPosOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posSearch, setPosSearch] = useState("");
  const [posCategory, setPosCategory] = useState("ALL");
  const [posSupplier, setPosSupplier] = useState("");
  const [posReference, setPosReference] = useState("");
  const [posNote, setPosNote] = useState("");
  const [placing, setPlacing] = useState(false);

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemOrderId, setAddItemOrderId] = useState("");
  const [itemForm, setItemForm] = useState({
    productId: "",
    quantity: "1",
    unitPrice: "",
    note: "",
  });
  const [addingItem, setAddingItem] = useState(false);

  const [deleteOrderTarget, setDeleteOrderTarget] = useState<Order | null>(
    null,
  );
  const [tab, setTab] = useState<"orders" | "summary">("summary");

  // Date range filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    async function loadLookups() {
      try {
        const [sRes, pRes, prRes] = await Promise.all([
          fetch("/api/app/admin/suppliers?includeInactive=false", {
            credentials: "include",
          }),
          fetch("/api/app/admin/procurement-products?includeInactive=false", {
            credentials: "include",
          }),
          fetch("/api/app/admin/supplier-prices?includeInactive=false", {
            credentials: "include",
          }),
        ]);
        const [sJson, pJson, prJson] = await Promise.all([
          sRes.json(),
          pRes.json(),
          prRes.json(),
        ]);
        if (sRes.ok)
          setSuppliers(
            (sJson.data ?? []).map((s: any) => ({ id: s.id, name: s.name })),
          );
        const productMap = new Map<string, ProductLookup>();
        if (pRes.ok) {
          const productsList: ProductLookup[] = [];
          for (const p of pJson.data ?? []) {
            const pl: ProductLookup = {
              id: p.id,
              name: p.name,
              supplier: p.supplier ?? null,
              category: p.category ?? null,
            };
            productsList.push(pl);
            productMap.set(p.id, pl);
          }
          setProducts(productsList);
        }
        if (prRes.ok) {
          const seen = new Map<string, CatalogItem>();
          for (const sp of prJson.data ?? []) {
            const uom = sp.uom ?? null;
            const unitSize = sp.unitSize != null ? Number(sp.unitSize) : null;
            const key = `${sp.productId}~${uom ?? ""}~${unitSize ?? ""}`;
            if (!seen.has(key)) {
              const prod = productMap.get(sp.productId);
              seen.set(key, {
                key,
                productId: sp.productId,
                productName: sp.product?.name ?? prod?.name ?? "Unknown",
                uom,
                unitSize,
                category: prod?.category ?? null,
              });
            }
          }
          setCatalog(Array.from(seen.values()));
        }
      } catch {
        /* silently fail */
      }
    }
    loadLookups();
  }, []);

  const loadOrders = useCallback(
    async (from?: string, to?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const qs = params.toString();
        const res = await fetch(
          `/api/app/admin/sites/${siteId}/product-orders${qs ? `?${qs}` : ""}`,
          { credentials: "include" },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Failed to load");
        setOrders(json.data);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load orders");
      } finally {
        setLoading(false);
      }
    },
    [siteId],
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    for (const c of catalog) {
      if (c.category) cats.set(c.category.id, c.category.name);
    }
    return Array.from(cats.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const q = posSearch.toLowerCase().trim();
    return catalog.filter((c) => {
      if (q && !c.productName.toLowerCase().includes(q)) return false;
      if (posCategory !== "ALL" && c.category?.id !== posCategory) return false;
      return true;
    });
  }, [catalog, posSearch, posCategory]);

  function addToCart(item: CatalogItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.key === item.key);
      if (existing)
        return prev.map((c) =>
          c.key === item.key ? { ...c, quantity: c.quantity + 1 } : c,
        );
      return [...prev, { key: item.key, item, quantity: 1 }];
    });
  }
  function updateCartQty(key: string, delta: number) {
    setCart((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;
        const nq = c.quantity + delta;
        return nq < 1 ? c : { ...c, quantity: nq };
      }),
    );
  }
  function setCartQty(key: string, qty: number) {
    if (qty < 1) return;
    setCart((prev) =>
      prev.map((c) => (c.key === key ? { ...c, quantity: qty } : c)),
    );
  }
  function removeFromCart(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }
  const cartTotal = cart.reduce((s, c) => s + c.quantity, 0);

  async function handlePlaceOrder() {
    if (cart.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    setPlacing(true);
    try {
      const headerRes = await fetch(
        `/api/app/admin/sites/${siteId}/product-orders`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierId: posSupplier || null,
            reference: posReference.trim() || null,
            note: posNote.trim() || null,
          }),
        },
      );
      const headerJson = await headerRes.json();
      if (!headerRes.ok)
        throw new Error(headerJson?.error ?? "Failed to create order");
      const orderId = headerJson.data.id;
      for (const ci of cart) {
        const itemRes = await fetch(
          `/api/app/admin/sites/${siteId}/product-orders/${orderId}/items`,
          {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              productId: ci.item.productId,
              quantity: ci.quantity,
              uom: ci.item.uom || undefined,
              unitSize: ci.item.unitSize ?? undefined,
            }),
          },
        );
        const itemJson = await itemRes.json();
        if (!itemRes.ok)
          throw new Error(
            itemJson?.error ?? `Failed to add ${ci.item.productName}`,
          );
      }
      toast.success(
        `Order placed — ${cart.length} item${cart.length !== 1 ? "s" : ""}`,
      );
      setPosOpen(false);
      setCart([]);
      setPosSearch("");
      setPosCategory("ALL");
      setPosSupplier("");
      setPosReference("");
      setPosNote("");
      loadOrders();
    } catch (e: any) {
      toast.error(e?.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  }

  function openPos() {
    setCart([]);
    setPosSearch("");
    setPosCategory("ALL");
    setPosSupplier("");
    setPosReference("");
    setPosNote("");
    setPosOpen(true);
  }

  async function handleAddItem() {
    if (!itemForm.productId) {
      toast.error("Select a product");
      return;
    }
    const qty = parseInt(itemForm.quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    setAddingItem(true);
    try {
      const payload: Record<string, unknown> = {
        productId: itemForm.productId,
        quantity: qty,
      };
      if (itemForm.unitPrice.trim())
        payload.unitPrice = Number(itemForm.unitPrice);
      if (itemForm.note.trim()) payload.note = itemForm.note.trim();
      const res = await fetch(
        `/api/app/admin/sites/${siteId}/product-orders/${addItemOrderId}/items`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to add item");
      toast.success("Item added");
      setItemForm({ productId: "", quantity: "1", unitPrice: "", note: "" });
      loadOrders();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add item");
    } finally {
      setAddingItem(false);
    }
  }

  async function handleDeleteOrder() {
    if (!deleteOrderTarget) return;
    try {
      const res = await fetch(
        `/api/app/admin/sites/${siteId}/product-orders/${deleteOrderTarget.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      toast.success("Order deleted");
      setDeleteOrderTarget(null);
      loadOrders();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete order");
    }
  }

  async function handleDeleteItem(orderId: string, itemId: string) {
    try {
      const res = await fetch(
        `/api/app/admin/sites/${siteId}/product-orders/${orderId}/items/${itemId}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete item");
      toast.success("Item removed");
      loadOrders();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete item");
    }
  }

  const aggregated = aggregateProducts(orders);
  const grandTotal = orders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (itemSum, item) => itemSum + item.quantity * item.unitPriceAtOrder,
        0,
      ),
    0,
  );
  const totalItems = aggregated.reduce((s, a) => s + a.totalQuantity, 0);

  return (
    <div className="rounded border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded bg-blue-600 flex items-center justify-center shadow-sm">
              <Package
                className="h-4.5 w-4.5 text-white"
                style={{ height: 18, width: 18 }}
              />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white tracking-tight">
                Material Orders
              </h2>
              <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-0.5">
                Procurement tracking &amp; history
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-slate-900 dark:text-white"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-slate-900 dark:text-white"
            />
            <button
              onClick={() =>
                loadOrders(dateFrom || undefined, dateTo || undefined)
              }
              disabled={loading}
              className="h-8 px-3 rounded bg-primary hover:bg-primary/90 text-white text-[13px] font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? "..." : "Filter"}
            </button>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  loadOrders();
                }}
                className="h-8 px-3 rounded border border-slate-200 dark:border-slate-700 text-[13px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() =>
                loadOrders(dateFrom || undefined, dateTo || undefined)
              }
              className="h-8 w-8 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2.5 mt-4">
          <StatCard label="Orders" value={String(orders.length)} />
          <StatCard label="Total Items" value={String(totalItems)} />
          <StatCard label="Grand Total" value={fmtCurrency(grandTotal)} />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 px-2">
        {(["summary", "orders"] as const).map((t) => {
          const active = tab === t;
          const Icon = t === "summary" ? ClipboardList : ShoppingCart;
          const label =
            t === "summary" ? "Summary" : `Orders (${orders.length})`;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                active
                  ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="p-5">
        {/* ═══ Summary Tab ═══ */}
        {tab === "summary" && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
                <RotateCw className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : aggregated.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
                <div className="h-14 w-14 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <Package className="h-6 w-6 opacity-50" />
                </div>
                <p className="text-[13px] font-medium">
                  No materials ordered yet
                </p>
                <p className="text-[12px] mt-1 text-slate-400">
                  Create your first order to see the summary
                </p>
              </div>
            ) : (
              <div className="rounded border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60 divide-x divide-slate-200 dark:divide-slate-700/60">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Product
                      </th>
                      <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Qty
                      </th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Total Cost
                      </th>
                      <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Orders
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {aggregated.map((a, i) => (
                      <tr
                        key={`${a.productId}-${i}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors divide-x divide-slate-200 dark:divide-slate-700/60"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-white text-[13px]">
                            {a.productName}
                          </div>
                          {(a.unitSize || a.uom) && (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {fmtSize(a.unitSize, a.uom)}
                            </div>
                          )}
                        </td>
                        <td className="text-center px-3 py-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-[12px] font-semibold">
                            {a.totalQuantity}
                            {a.uom && (
                              <span className="font-normal opacity-70">
                                × {fmtSize(a.unitSize, a.uom)}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="text-right px-4 py-3 font-semibold text-[13px] text-slate-900 dark:text-white tabular-nums">
                          {fmtCurrency(a.totalCost)}
                        </td>
                        <td className="text-center px-3 py-3">
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {a.orderCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 divide-x divide-slate-200 dark:divide-slate-700/60">
                      <td className="px-4 py-3 text-[12px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                        Total
                      </td>
                      <td className="text-center px-3 py-3 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                        {totalItems}
                      </td>
                      <td className="text-right px-4 py-3 text-[13px] font-bold text-slate-900 dark:text-white tabular-nums">
                        {fmtCurrency(grandTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}

        {/* ═══ Orders Tab ═══ */}
        {tab === "orders" && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
                <RotateCw className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
                <div className="h-14 w-14 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <ShoppingCart className="h-6 w-6 opacity-50" />
                </div>
                <p className="text-[13px] font-medium">No orders yet</p>
                <p className="text-[12px] mt-1">
                  Click &ldquo;New Order&rdquo; to get started
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {orders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const rowTotal = order.items.reduce(
                    (sum, item) => sum + item.quantity * item.unitPriceAtOrder,
                    0,
                  );
                  return (
                    <div
                      key={order.id}
                      className="rounded border border-slate-200 dark:border-slate-700/60 overflow-hidden transition-shadow hover:shadow-sm"
                    >
                      {/* Order row */}
                      <div
                        role="button"
                        tabIndex={0}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        onClick={() =>
                          setExpandedOrderId(isExpanded ? null : order.id)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setExpandedOrderId(isExpanded ? null : order.id);
                          }
                        }}
                      >
                        <div
                          className={`shrink-0 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                        >
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        </div>

                        {/* Left: name + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-semibold text-slate-900 dark:text-white">
                              {order.reference
                                ? `#${order.reference}`
                                : "Unnamed Order"}
                            </span>
                            {order.supplier && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                {order.supplier.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                            <span>{fmtDate(order.createdAt)}</span>
                            {order.createdByUser && (
                              <>
                                <span>·</span>
                                <span>{order.createdByUser.name}</span>
                              </>
                            )}
                            <span>·</span>
                            <span>
                              {order.items.length} item
                              {order.items.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {!isExpanded && order.items.length > 0 && (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                              {order.items
                                .slice(0, 3)
                                .map(itemDisplay)
                                .join(" · ")}
                              {order.items.length > 3 &&
                                ` +${order.items.length - 3} more`}
                            </div>
                          )}
                        </div>

                        {/* Right: cost + actions */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[13px] font-semibold text-slate-900 dark:text-white tabular-nums">
                            {fmtCurrency(rowTotal)}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <button
                              className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddItemOrderId(order.id);
                                setItemForm({
                                  productId: "",
                                  quantity: "1",
                                  unitPrice: "",
                                  note: "",
                                });
                                setAddItemOpen(true);
                              }}
                              title="Add item"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteOrderTarget(order);
                              }}
                              title="Delete order"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded items */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 dark:border-slate-800">
                          {order.note && (
                            <div className="px-4 py-2.5 text-[12px] text-slate-500 dark:text-slate-400 bg-amber-50/60 dark:bg-amber-950/20 border-b border-slate-100 dark:border-slate-800 flex items-start gap-1.5">
                              <span className="font-medium text-amber-700 dark:text-amber-400 shrink-0">
                                Note:
                              </span>
                              <span>{order.note}</span>
                            </div>
                          )}
                          {order.items.length === 0 ? (
                            <div className="px-4 py-5 text-center text-[13px] text-slate-400">
                              No items.{" "}
                              <button
                                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                onClick={() => {
                                  setAddItemOrderId(order.id);
                                  setItemForm({
                                    productId: "",
                                    quantity: "1",
                                    unitPrice: "",
                                    note: "",
                                  });
                                  setAddItemOpen(true);
                                }}
                              >
                                Add one
                              </button>
                            </div>
                          ) : (
                            <table className="w-full text-[13px]">
                              <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 divide-x divide-slate-200 dark:divide-slate-700/60">
                                  <th className="text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Product
                                  </th>
                                  <th className="text-center px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Qty
                                  </th>
                                  <th className="text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Unit Price
                                  </th>
                                  <th className="text-right px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Line Total
                                  </th>
                                  <th className="w-8 px-2 py-2" />
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {order.items.map((item) => (
                                  <tr
                                    key={item.id}
                                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors group divide-x divide-slate-200 dark:divide-slate-700/60"
                                  >
                                    <td className="px-4 py-2.5">
                                      <div className="font-medium text-slate-900 dark:text-white">
                                        {item.product.name}
                                      </div>
                                      {(item.unitSizeAtOrder ??
                                        item.product.unitSize ??
                                        item.uomAtOrder ??
                                        item.product.uom) && (
                                        <div className="text-[11px] text-slate-400 mt-0.5">
                                          {fmtSize(
                                            item.unitSizeAtOrder ??
                                              item.product.unitSize,
                                            item.uomAtOrder ?? item.product.uom,
                                          )}
                                        </div>
                                      )}
                                      {item.note && (
                                        <div className="text-[11px] text-slate-400 italic mt-0.5">
                                          {item.note}
                                        </div>
                                      )}
                                    </td>
                                    <td className="text-center px-3 py-2.5">
                                      <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded bg-slate-100 dark:bg-slate-700 text-[12px] font-bold text-slate-700 dark:text-slate-200">
                                        {item.quantity}
                                      </span>
                                    </td>
                                    <td className="text-right px-3 py-2.5 text-slate-600 dark:text-slate-300 tabular-nums">
                                      {fmtCurrency(item.unitPriceAtOrder)}
                                    </td>
                                    <td className="text-right px-4 py-2.5 font-semibold text-slate-900 dark:text-white tabular-nums">
                                      {fmtCurrency(
                                        item.quantity * item.unitPriceAtOrder,
                                      )}
                                    </td>
                                    <td className="px-2 py-2.5">
                                      <button
                                        className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                                        onClick={() =>
                                          handleDeleteItem(order.id, item.id)
                                        }
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <button
                              className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              onClick={() => {
                                setAddItemOrderId(order.id);
                                setItemForm({
                                  productId: "",
                                  quantity: "1",
                                  unitPrice: "",
                                  note: "",
                                });
                                setAddItemOpen(true);
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" /> Add Item
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* POS — New Order Dialog                                     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Dialog open={posOpen} onOpenChange={setPosOpen}>
        <DialogContent className="max-w-7xl h-[85vh] flex flex-col p-0 gap-0 [&>button]:z-50 rounded overflow-hidden">
          {/* POS Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-[15px] font-semibold text-slate-900 dark:text-white">
                  New Material Order
                </DialogTitle>
                <DialogDescription className="text-[12px] text-slate-400 mt-0">
                  Select products then place order
                </DialogDescription>
              </div>
            </div>
            {cart.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-[12px] font-semibold shadow-sm">
                {cartTotal} item{cartTotal !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-900/50">
            {/* Catalog */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
              <div className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    placeholder="Search products..."
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                    className="w-full pl-9 pr-9 h-10 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[13px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                  />
                  {posSearch && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setPosSearch("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {categories.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    <button
                      onClick={() => setPosCategory("ALL")}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${posCategory === "ALL" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                    >
                      All
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setPosCategory(c.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${posCategory === c.id ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {filteredCatalog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Package className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-[13px]">No products found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {filteredCatalog.map((ci) => {
                      const inCart = cart.find((c) => c.key === ci.key);
                      return (
                        <button
                          key={ci.key}
                          onClick={() => addToCart(ci)}
                          className={`relative p-3.5 rounded border-2 text-left transition-all active:scale-[0.97] ${
                            inCart
                              ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/20 shadow-md shadow-blue-100 dark:shadow-blue-950/30"
                              : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-slate-800/60 hover:shadow-sm"
                          }`}
                        >
                          {inCart && (
                            <span className="absolute -top-2 -right-2 h-5 w-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                              {inCart.quantity}
                            </span>
                          )}
                          <div className="h-8 w-8 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-2.5">
                            <Package className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          </div>
                          <div className="font-semibold text-[12px] leading-snug text-slate-900 dark:text-white">
                            {ci.productName}
                          </div>
                          {ci.uom && (
                            <div className="mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                              {fmtSize(ci.unitSize, ci.uom)}
                            </div>
                          )}
                          {ci.category && (
                            <div className="text-[10px] text-slate-400 mt-1 truncate">
                              {ci.category.name}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Cart Panel */}
            <div className="w-80 flex flex-col bg-white dark:bg-slate-900">
              <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Cart
                  {cart.length > 0 && (
                    <span className="font-normal text-slate-400">
                      ({cartTotal} item{cartTotal !== 1 ? "s" : ""})
                    </span>
                  )}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <ShoppingCart className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-[13px] font-medium">Cart is empty</p>
                    <p className="text-[11px] mt-0.5 text-slate-400">
                      Tap products to add
                    </p>
                  </div>
                ) : (
                  cart.map((ci) => (
                    <div
                      key={ci.key}
                      className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-slate-900 dark:text-white leading-tight">
                            {ci.item.productName}
                          </div>
                          {ci.item.uom && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {fmtSize(ci.item.unitSize, ci.item.uom)}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(ci.key)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="h-7 w-7 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 transition-colors"
                          onClick={() => updateCartQty(ci.key, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={ci.quantity}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (Number.isFinite(v) && v >= 1)
                              setCartQty(ci.key, v);
                          }}
                          className="h-7 w-14 text-center text-[13px] font-bold border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <button
                          className="h-7 w-7 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 transition-colors"
                          onClick={() => updateCartQty(ci.key, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Order meta + place */}
              <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-2.5">
                <Select
                  value={posSupplier || "NONE"}
                  onValueChange={(v) => setPosSupplier(v === "NONE" ? "" : v)}
                >
                  <SelectTrigger className="h-9 text-[12px] border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Supplier (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No specific supplier</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  placeholder="Reference / PO #"
                  value={posReference}
                  onChange={(e) => setPosReference(e.target.value)}
                  className="w-full h-9 px-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[12px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />
                <input
                  placeholder="Note (optional)"
                  value={posNote}
                  onChange={(e) => setPosNote(e.target.value)}
                  className="w-full h-9 px-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[12px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                />

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 pb-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Products</span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {cart.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Total items</span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {cartTotal}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={placing || cart.length === 0}
                  className="w-full h-10 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  {placing ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" /> Placing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" /> Place Order
                      {cart.length > 0 &&
                        ` · ${cartTotal} item${cartTotal !== 1 ? "s" : ""}`}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Add Item Dialog                                            */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md rounded">
          <DialogHeader>
            <DialogTitle className="text-[15px] font-semibold">
              Add Item to Order
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Select a product and quantity. Price is resolved automatically
              from supplier prices.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
                Product *
              </label>
              <Select
                value={itemForm.productId || "NONE"}
                onValueChange={(v) =>
                  setItemForm({ ...itemForm, productId: v === "NONE" ? "" : v })
                }
              >
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Select product...</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  Quantity *
                </label>
                <Input
                  type="number"
                  min="1"
                  value={itemForm.quantity}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, quantity: e.target.value })
                  }
                  className="h-9 text-[13px]"
                  placeholder="1"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
                  Unit Price Override
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={itemForm.unitPrice}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, unitPrice: e.target.value })
                  }
                  className="h-9 text-[13px]"
                  placeholder="Auto"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
                Note
              </label>
              <Input
                value={itemForm.note}
                onChange={(e) =>
                  setItemForm({ ...itemForm, note: e.target.value })
                }
                className="h-9 text-[13px]"
                placeholder="Optional note"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setAddItemOpen(false)}
              className="h-9 text-[13px]"
            >
              Done
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={addingItem}
              className="h-9 text-[13px] bg-blue-600 hover:bg-blue-700"
            >
              {addingItem ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!deleteOrderTarget}
        onOpenChange={(open) => !open && setDeleteOrderTarget(null)}
        title="Delete Order"
        description={`Delete order "${deleteOrderTarget?.reference ?? "this order"}" and all its items? This cannot be undone.`}
        onConfirm={handleDeleteOrder}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
