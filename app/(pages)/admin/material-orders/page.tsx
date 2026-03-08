"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Minus,
  X,
  Package,
  Search,
  RotateCw,
  ShoppingCart,
  Building2,
  Truck,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency } from "@/lib/formatCurrency";

/* ─── Helper types ─── */

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
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SiteDto = { id: string; name: string };
type SupplierDto = { id: string; name: string };
type CategoryDto = { id: string; name: string };

type CatalogItem = {
  key: string;
  productId: string;
  productName: string;
  sku: string | null;
  uom: string | null;
  unitSize: number | null;
  category: CategoryDto | null;
  price: number;
};

type CartItem = {
  key: string;
  item: CatalogItem;
  quantity: number;
};

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  unitPriceAtOrder: number;
  uomAtOrder: string | null;
  unitSizeAtOrder: number | null;
  note: string | null;
};

type Order = {
  id: string;
  siteId: string;
  siteName: string;
  supplierId: string | null;
  supplierName: string | null;
  createdBy: string | null;
  reference: string | null;
  note: string | null;
  totalCost: number | null;
  createdAt: string;
  items: OrderItem[];
};

/* ─── Component ─── */

export default function MaterialOrdersPage() {
  // Lookups
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // POS sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posSiteId, setPosSiteId] = useState("");
  const [posSupplierId, setPosSupplierId] = useState("");
  const [posReference, setPosReference] = useState("");
  const [posNote, setPosNote] = useState("");
  const [posSearch, setPosSearch] = useState("");
  const [posCategory, setPosCategory] = useState("ALL");
  const [placing, setPlacing] = useState(false);

  // Delete
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);

  // Filter
  const [filterSiteId, setFilterSiteId] = useState("all");

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  /* ── Load lookups ── */
  useEffect(() => {
    async function load() {
      try {
        const [sitesRes, suppliersRes, productsRes, pricesRes] =
          await Promise.all([
            fetch("/api/app/admin/sites", {
              credentials: "include",
              headers: { accept: "application/json" },
            }),
            fetch("/api/app/admin/suppliers?includeInactive=false", {
              credentials: "include",
              headers: { accept: "application/json" },
            }),
            fetch("/api/app/admin/procurement-products?includeInactive=false", {
              credentials: "include",
              headers: { accept: "application/json" },
            }),
            fetch("/api/app/admin/supplier-prices?includeInactive=false", {
              credentials: "include",
              headers: { accept: "application/json" },
            }),
          ]);
        const [sitesJson, suppliersJson, productsJson, pricesJson] =
          await Promise.all([
            sitesRes.json().catch(() => null),
            suppliersRes.json().catch(() => null),
            productsRes.json().catch(() => null),
            pricesRes.json().catch(() => null),
          ]);

        const sitesList: SiteDto[] = (
          sitesJson?.sites ??
          sitesJson?.data ??
          []
        ).map((s: any) => ({ id: s.id, name: s.name }));
        setSites(sitesList);

        const suppliersList: SupplierDto[] = (suppliersJson?.data ?? []).map(
          (s: any) => ({ id: s.id, name: s.name }),
        );
        setSuppliers(suppliersList);

        const productsList = (productsJson?.data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku ?? null,
          uom: p.uom ?? null,
          unitSize: p.unitSize != null ? Number(p.unitSize) : null,
          category: p.category ?? null,
        }));

        const pricesList = (pricesJson?.data ?? []).map((sp: any) => ({
          productId: sp.productId,
          uom: sp.uom ?? null,
          unitSize: sp.unitSize != null ? Number(sp.unitSize) : null,
          price: Number(sp.price ?? 0),
          product: sp.product ?? undefined,
        }));

        const seen = new Map<string, CatalogItem>();
        for (const sp of pricesList) {
          const uom = sp.uom ?? null;
          const unitSize = sp.unitSize;
          const key = `${sp.productId}~${uom ?? ""}~${unitSize ?? ""}`;
          if (!seen.has(key)) {
            const prod = productsList.find((p: any) => p.id === sp.productId);
            seen.set(key, {
              key,
              productId: sp.productId,
              productName: sp.product?.name ?? prod?.name ?? "Unknown",
              sku: prod?.sku ?? null,
              uom,
              unitSize,
              category: prod?.category ?? null,
              price: sp.price,
            });
          }
        }
        for (const prod of productsList) {
          const key = `${prod.id}~${prod.uom ?? ""}~${prod.unitSize ?? ""}`;
          if (!seen.has(key)) {
            seen.set(key, {
              key,
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              uom: prod.uom,
              unitSize: prod.unitSize,
              category: prod.category,
              price: 0,
            });
          }
        }
        setCatalog(
          Array.from(seen.values()).sort((a, b) =>
            a.productName.localeCompare(b.productName),
          ),
        );
      } catch {
        /* silently fail */
      }
    }
    load();
  }, []);

  /* ── Load orders ── */
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSiteId && filterSiteId !== "all")
        params.set("siteId", filterSiteId);
      const res = await fetch(
        `/api/app/admin/material-orders?${params.toString()}`,
        {
          credentials: "include",
          headers: { accept: "application/json" },
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to load orders");
      setOrders(Array.isArray(json?.data) ? json.data : []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [filterSiteId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  /* ── POS helpers ── */
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
      if (
        q &&
        !c.productName.toLowerCase().includes(q) &&
        !(c.sku && c.sku.toLowerCase().includes(q))
      )
        return false;
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

  const cartTotal = useMemo(
    () => cart.reduce((s, c) => s + c.quantity * c.item.price, 0),
    [cart],
  );
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  function openPos() {
    setCart([]);
    setPosSearch("");
    setPosCategory("ALL");
    setPosSiteId(sites[0]?.id ?? "");
    setPosSupplierId("");
    setPosReference("");
    setPosNote("");
    setSheetOpen(true);
  }

  async function handlePlaceOrder() {
    if (!posSiteId) {
      toast.error("Please select a site");
      return;
    }
    if (cart.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    setPlacing(true);
    try {
      const res = await fetch("/api/app/admin/material-orders", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          siteId: posSiteId,
          supplierId: posSupplierId || undefined,
          reference: posReference.trim() || undefined,
          note: posNote.trim() || undefined,
          items: cart.map((c) => ({
            productId: c.item.productId,
            quantity: c.quantity,
            uom: c.item.uom || undefined,
            unitSize: c.item.unitSize ?? undefined,
          })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to place order");
      toast.success(
        `Order placed — ${cart.length} item${cart.length !== 1 ? "s" : ""}`,
      );
      setSheetOpen(false);
      setCart([]);
      loadOrders();
    } catch (e: any) {
      toast.error(e?.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  }

  async function handleDeleteOrder() {
    if (!deleteOrderId) return;
    const order = orders.find((o) => o.id === deleteOrderId);
    if (!order) return;
    try {
      const res = await fetch(
        `/api/app/admin/sites/${order.siteId}/product-orders/${order.id}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { accept: "application/json" },
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete order");
      toast.success("Order deleted");
      setDeleteOrderId(null);
      setExpandedOrderId(null);
      loadOrders();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete order");
    }
  }

  const totalValue = useMemo(
    () => orders.reduce((s, o) => s + (o.totalCost ?? 0), 0),
    [orders],
  );

  // Pagination derived
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedOrders = orders.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );
  const pFrom = orders.length === 0 ? 0 : safePage * pageSize + 1;
  const pTo = Math.min(safePage * pageSize + pageSize, orders.length);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Material Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage procurement material orders for sites (paints,
            cement, etc.)
          </p>
        </div>
        <Button onClick={openPos}>
          <Plus className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </div>

      {/* Filter + Summary */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Site
            </label>
            <Select value={filterSiteId} onValueChange={setFilterSiteId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sites</SelectItem>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setFilterSiteId("all");
            }}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-4 flex-wrap ml-auto">
          <div className="border rounded px-4 py-3 bg-card">
            <div className="text-xs text-muted-foreground font-medium">
              Total Orders
            </div>
            <div className="text-2xl font-bold mt-1">{orders.length}</div>
          </div>
          <div className="border rounded px-4 py-3 bg-card">
            <div className="text-xs text-muted-foreground font-medium">
              Total Value
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(totalValue)}
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="border bg-card rounded overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Date
                </TableHead>
                <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Site
                </TableHead>
                <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Supplier
                </TableHead>
                <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Reference
                </TableHead>
                <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Items
                </TableHead>
                <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 text-right">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <span className="text-muted-foreground text-sm">
                      Loading orders…
                    </span>
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <span className="text-muted-foreground text-sm">
                      No material orders yet
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  return (
                    <React.Fragment key={order.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() =>
                          setExpandedOrderId(isExpanded ? null : order.id)
                        }
                      >
                        <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm">
                          {fmtDate(order.createdAt)}
                        </TableCell>
                        <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm font-medium">
                          {order.siteName}
                        </TableCell>
                        <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm">
                          {order.supplierName ?? "—"}
                        </TableCell>
                        <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm">
                          {order.reference ?? "—"}
                        </TableCell>
                        <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm">
                          {order.items.length} item
                          {order.items.length !== 1 ? "s" : ""}
                        </TableCell>
                        <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm font-semibold text-right">
                          {formatCurrency(order.totalCost ?? 0)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={6} className="p-0">
                            <div className="px-6 py-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  Order Items
                                </div>
                                {order.createdBy && (
                                  <span className="text-xs text-muted-foreground">
                                    Created by {order.createdBy}
                                    {order.note && ` · ${order.note}`}
                                  </span>
                                )}
                              </div>
                              <Table className="border-collapse">
                                <TableHeader className="bg-muted/60">
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                                      Product
                                    </TableHead>
                                    <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                                      Size
                                    </TableHead>
                                    <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 text-right">
                                      Qty
                                    </TableHead>
                                    <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 text-right">
                                      Unit Price
                                    </TableHead>
                                    <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700 text-right">
                                      Subtotal
                                    </TableHead>
                                    <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                                      Note
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {order.items.map((item) => (
                                    <TableRow
                                      key={item.id}
                                      className="hover:bg-transparent"
                                    >
                                      <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm">
                                        {item.productName}
                                        {item.sku && (
                                          <span className="ml-1 text-xs text-muted-foreground">
                                            ({item.sku})
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm text-muted-foreground">
                                        {fmtSize(
                                          item.unitSizeAtOrder,
                                          item.uomAtOrder,
                                        )}
                                      </TableCell>
                                      <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm text-right">
                                        {item.quantity}
                                      </TableCell>
                                      <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm text-right">
                                        {formatCurrency(item.unitPriceAtOrder)}
                                      </TableCell>
                                      <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm font-medium text-right">
                                        {formatCurrency(
                                          item.unitPriceAtOrder * item.quantity,
                                        )}
                                      </TableCell>
                                      <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm text-muted-foreground">
                                        {item.note || "—"}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              <div className="flex justify-end pt-2">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteOrderId(order.id);
                                  }}
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Delete Order
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {orders.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t px-4 py-3 bg-muted/60 text-sm">
            <span className="text-muted-foreground">
              Showing <b>{pFrom}</b> to <b>{pTo}</b> of <b>{orders.length}</b>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Rows</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage === 0}
                  onClick={() => setPage(0)}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage(totalPages - 1)}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* POS Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-full lg:max-w-[85vw] p-0 overflow-y-auto"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>New Material Order</SheetTitle>
          </SheetHeader>

          {/* POS UI */}
          <div className="h-full bg-[#F5F4F0] dark:bg-[#111110] font-mono">
            {/* Top header bar */}
            <div className="border-b-2 border-black dark:border-zinc-700 bg-black text-white px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-400">
                  Admin
                </span>
                <span className="text-zinc-600">/</span>
                <span className="text-sm font-bold tracking-wide uppercase">
                  Material Order Entry
                </span>
              </div>
              {cart.length > 0 && (
                <span className="text-[10px] tracking-widest text-zinc-400 uppercase">
                  {cartCount} item{cartCount !== 1 ? "s" : ""} in order
                </span>
              )}
            </div>

            <div className="max-w-350 mx-auto p-6">
              <div className="border-b-2 border-black dark:border-zinc-700 pb-4 mb-6">
                <p className="text-[11px] tracking-[0.15em] text-zinc-500 uppercase mb-1">
                  Order procurement materials for a site — prices resolved
                  automatically from supplier price list
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-0 border-2 border-black dark:border-zinc-700">
                {/* LEFT PANEL */}
                <div className="border-r-2 border-black dark:border-zinc-700">
                  {/* Site + Supplier selectors */}
                  <div className="border-b-2 border-black dark:border-zinc-700 p-5 bg-white dark:bg-[#1A1A18] space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 bg-black dark:bg-zinc-400" />
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400">
                          Assign Site *
                        </span>
                      </div>
                      <Select value={posSiteId} onValueChange={setPosSiteId}>
                        <SelectTrigger className="rounded-none border-2 border-black dark:border-zinc-600 h-10 text-sm font-medium bg-white dark:bg-[#111110]">
                          <SelectValue placeholder="Select site" />
                        </SelectTrigger>
                        <SelectContent className="rounded-none border-2 border-black dark:border-zinc-600">
                          {sites.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 bg-black dark:bg-zinc-400" />
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400">
                          Supplier (optional)
                        </span>
                      </div>
                      <Select
                        value={posSupplierId || "NONE"}
                        onValueChange={(v) =>
                          setPosSupplierId(v === "NONE" ? "" : v)
                        }
                      >
                        <SelectTrigger className="rounded-none border-2 border-black dark:border-zinc-600 h-10 text-sm font-medium bg-white dark:bg-[#111110]">
                          <SelectValue placeholder="No supplier" />
                        </SelectTrigger>
                        <SelectContent className="rounded-none border-2 border-black dark:border-zinc-600">
                          <SelectItem value="NONE">
                            No specific supplier
                          </SelectItem>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 mb-1 block">
                          Reference
                        </span>
                        <Input
                          value={posReference}
                          onChange={(e) => setPosReference(e.target.value)}
                          placeholder="PO #"
                          className="rounded-none border-2 border-black dark:border-zinc-600 h-9 text-sm bg-white dark:bg-[#111110]"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 mb-1 block">
                          Note
                        </span>
                        <Input
                          value={posNote}
                          onChange={(e) => setPosNote(e.target.value)}
                          placeholder="Optional"
                          className="rounded-none border-2 border-black dark:border-zinc-600 h-9 text-sm bg-white dark:bg-[#111110]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Order items section header */}
                  <div className="border-b border-zinc-200 dark:border-zinc-700 px-5 py-3 bg-[#F5F4F0] dark:bg-[#161614] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-black dark:bg-zinc-400" />
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400">
                        Order Items
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tracking-widest uppercase">
                        Total
                      </span>
                      <span className="text-base font-bold tabular-nums text-black dark:text-zinc-100">
                        {formatCurrency(cartTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Cart table */}
                  <div className="bg-white dark:bg-[#1A1A18] overflow-x-auto">
                    {cart.length === 0 ? (
                      <div className="py-16 flex flex-col items-center gap-2 text-center">
                        <div className="w-8 h-8 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-300 dark:text-zinc-600 text-lg">
                          ∅
                        </div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 tracking-widest uppercase">
                          No items added yet
                        </p>
                        <p className="text-[11px] text-zinc-300 dark:text-zinc-600">
                          Click &quot;Add&quot; on a material from the right
                          panel
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-2 border-black dark:border-zinc-600 hover:bg-transparent dark:hover:bg-transparent">
                            <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 dark:text-zinc-400 py-2.5 pl-5">
                              Material
                            </TableHead>
                            <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 dark:text-zinc-400 py-2.5 w-20 text-right">
                              Qty
                            </TableHead>
                            <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 dark:text-zinc-400 py-2.5 w-24 text-right">
                              Unit
                            </TableHead>
                            <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 dark:text-zinc-400 py-2.5 w-24 text-right">
                              Total
                            </TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cart.map((c, idx) => (
                            <TableRow
                              key={c.key}
                              className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${
                                idx % 2 === 0
                                  ? "bg-white dark:bg-[#1A1A18]"
                                  : "bg-[#FAFAF8] dark:bg-[#161614]"
                              }`}
                            >
                              <TableCell className="py-2.5 pl-5 text-sm font-medium text-black dark:text-zinc-100">
                                {c.item.productName}
                                {c.item.sku && (
                                  <span className="text-[10px] text-zinc-400 ml-1">
                                    ({c.item.sku})
                                  </span>
                                )}
                                <span className="block text-[10px] text-zinc-400">
                                  {fmtSize(c.item.unitSize, c.item.uom)}
                                </span>
                              </TableCell>
                              <TableCell className="py-2 pr-2">
                                <Input
                                  type="number"
                                  min={1}
                                  value={c.quantity}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    if (Number.isFinite(n) && n >= 1)
                                      setCartQty(c.key, Math.floor(n));
                                  }}
                                  className="h-7 w-16 rounded-none border border-zinc-300 dark:border-zinc-600 focus:border-black focus:ring-0 text-sm text-right tabular-nums px-2 bg-white dark:bg-[#111110]"
                                />
                              </TableCell>
                              <TableCell className="py-2.5 text-sm tabular-nums text-zinc-500 dark:text-zinc-400 text-right pr-3">
                                {c.item.price > 0
                                  ? formatCurrency(c.item.price)
                                  : "—"}
                              </TableCell>
                              <TableCell className="py-2.5 text-sm font-semibold tabular-nums text-black dark:text-zinc-100 text-right pr-3">
                                {formatCurrency(c.quantity * c.item.price)}
                              </TableCell>
                              <TableCell className="py-2 pr-3 text-center">
                                <button
                                  onClick={() => removeFromCart(c.key)}
                                  className="text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors text-lg leading-none font-light"
                                  aria-label="Remove item"
                                >
                                  ×
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {/* Submit bar */}
                  <div className="border-t-2 border-black dark:border-zinc-700 p-4 bg-black dark:bg-[#0A0A09] flex items-center justify-between gap-4">
                    <div className="text-white">
                      {cart.length > 0 ? (
                        <div>
                          <div className="text-[10px] tracking-widest text-zinc-500 uppercase">
                            Order Total
                          </div>
                          <div className="text-xl font-bold tabular-nums">
                            {formatCurrency(cartTotal)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-600 tracking-wide">
                          No items in order
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={placing || !posSiteId || cart.length === 0}
                      className={`px-6 py-2.5 text-xs font-bold tracking-[0.2em] uppercase transition-all ${
                        placing || !posSiteId || cart.length === 0
                          ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                          : "bg-white text-black hover:bg-yellow-400 hover:text-black active:scale-95"
                      }`}
                    >
                      {placing ? "Placing…" : "Confirm Order →"}
                    </button>
                  </div>
                </div>

                {/* RIGHT PANEL — Material Catalogue */}
                <div className="flex flex-col min-h-0">
                  <div className="border-b-2 border-black dark:border-zinc-700 p-5 bg-[#F5F4F0] dark:bg-[#161614] flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-1.5 h-1.5 bg-black dark:bg-zinc-400" />
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500 dark:text-zinc-400">
                        Material Catalogue
                      </span>
                      <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                        ({filteredCatalog.length})
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:justify-end">
                      <Select
                        value={posCategory}
                        onValueChange={setPosCategory}
                      >
                        <SelectTrigger className="rounded-none border-2 border-black dark:border-zinc-600 bg-white dark:bg-[#111110] text-sm h-9 w-full sm:w-44">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent className="rounded-none border-2 border-black dark:border-zinc-600">
                          <SelectItem value="ALL">All categories</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Search materials…"
                        value={posSearch}
                        onChange={(e) => setPosSearch(e.target.value)}
                        className="rounded-none border-2 border-black dark:border-zinc-600 bg-white dark:bg-[#111110] text-sm h-9 w-full sm:max-w-72 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                      />
                    </div>
                  </div>

                  <div
                    className="overflow-auto flex-1 bg-white dark:bg-[#1A1A18]"
                    style={{ maxHeight: "520px" }}
                  >
                    {filteredCatalog.length === 0 ? (
                      <div className="py-16 flex flex-col items-center gap-2">
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 tracking-widest uppercase">
                          No materials found
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="sticky top-0 z-10">
                          <TableRow className="border-b-2 border-black dark:border-zinc-600 bg-[#F5F4F0] dark:bg-[#161614] hover:bg-[#F5F4F0] dark:hover:bg-[#161614]">
                            <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 dark:text-zinc-400 py-2.5 pl-5">
                              Material
                            </TableHead>
                            <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 dark:text-zinc-400 py-2.5 w-24">
                              Size
                            </TableHead>
                            <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 dark:text-zinc-400 py-2.5 w-28 text-right">
                              Unit Price
                            </TableHead>
                            <TableHead className="w-24 text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500 dark:text-zinc-400 py-2.5 text-right pr-5">
                              Action
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCatalog.map((c, idx) => {
                            const inCart = cart.find((ci) => ci.key === c.key);
                            return (
                              <TableRow
                                key={c.key}
                                className={`border-b border-zinc-100 dark:border-zinc-800 transition-colors group cursor-default ${
                                  inCart
                                    ? "bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                    : idx % 2 === 0
                                      ? "bg-white dark:bg-[#1A1A18] hover:bg-yellow-50 dark:hover:bg-zinc-800/40"
                                      : "bg-[#FAFAF8] dark:bg-[#161614] hover:bg-yellow-50 dark:hover:bg-zinc-800/40"
                                }`}
                              >
                                <TableCell className="py-3 pl-5">
                                  <div className="flex items-center gap-2">
                                    {inCart && (
                                      <span className="inline-block w-1.5 h-1.5 bg-emerald-500 shrink-0" />
                                    )}
                                    <span className="text-sm font-medium text-black dark:text-zinc-100">
                                      {c.productName}
                                    </span>
                                  </div>
                                  {c.sku && (
                                    <span className="text-[10px] text-zinc-400 ml-3.5 block">
                                      SKU: {c.sku}
                                    </span>
                                  )}
                                  {inCart && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 tracking-wider mt-0.5 ml-3.5 block">
                                      ×{inCart.quantity} in order
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="py-3 text-sm text-zinc-500 dark:text-zinc-400">
                                  {fmtSize(c.unitSize, c.uom) || "—"}
                                </TableCell>
                                <TableCell className="py-3 text-sm tabular-nums font-semibold text-zinc-700 dark:text-zinc-300 text-right pr-4">
                                  {c.price > 0 ? formatCurrency(c.price) : "—"}
                                </TableCell>
                                <TableCell className="py-3 text-right pr-5">
                                  <button
                                    onClick={() => addToCart(c)}
                                    className={`text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 border transition-all active:scale-95 ${
                                      inCart
                                        ? "border-emerald-400 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500"
                                        : "border-black dark:border-zinc-500 text-black dark:text-zinc-200 hover:bg-black hover:text-white dark:hover:bg-zinc-200 dark:hover:text-black"
                                    }`}
                                  >
                                    {inCart ? "+ Add" : "Add"}
                                  </button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  <div className="border-t border-zinc-200 dark:border-zinc-700 px-5 py-3 bg-[#F5F4F0] dark:bg-[#161614] flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 bg-emerald-500" />
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">
                        Already in order
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 border border-zinc-400 dark:border-zinc-600" />
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tracking-wider uppercase">
                        Available
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmationDialog
        open={deleteOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteOrderId(null);
        }}
        title="Delete Order?"
        description="This will permanently delete the order and all its items. This cannot be undone."
        onConfirm={handleDeleteOrder}
        confirmText="Delete Order"
        variant="destructive"
      />
    </div>
  );
}
