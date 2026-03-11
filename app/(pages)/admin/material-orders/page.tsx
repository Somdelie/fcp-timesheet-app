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
  Check,
  ChevronDown,
  ScanLine,
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
function siteLabel(name: string, code: string | null | undefined) {
  return code ? `${code} — ${name}` : name;
}

type SiteDto = { id: string; name: string; code: string | null };
type SupplierDto = { id: string; name: string };
type CategoryDto = { id: string; name: string };

type CatalogItem = {
  key: string;
  productId: string;
  productName: string;
  sku: string | null;
  slug: string | null;
  uom: string | null;
  unitSize: number | null;
  category: CategoryDto | null;
  categoryId: string | null;
  price: number;
  thumbnailUrl: string | null;
  supplierIds: string[];
};

type CartItem = {
  key: string;
  quantity: number;
  item: CatalogItem;
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
  const [posSitePopoverOpen, setPosSitePopoverOpen] = useState(false);
  const [posSupplierId, setPosSupplierId] = useState("");
  const [posSupplierPopoverOpen, setPosSupplierPopoverOpen] = useState(false);
  const [posReference, setPosReference] = useState("");
  const [posNote, setPosNote] = useState("");
  const [posSearch, setPosSearch] = useState("");
  const [posCategory, setPosCategory] = useState("ALL");
  const [placing, setPlacing] = useState(false);

  // Delete
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filter
  const [filterSiteId, setFilterSiteId] = useState("all");
  const [filterRef, setFilterRef] = useState("");
  const [filterFrom, setFilterFrom] = useState<string | null>(null);
  const [filterTo, setFilterTo] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  /* ── Load lookups ── */
  const loadLookups = useCallback(async () => {
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
      ).map((s: any) => ({ id: s.id, name: s.name, code: s.code ?? null }));
      setSites(sitesList);

      const suppliersList: SupplierDto[] = (suppliersJson?.data ?? []).map(
        (s: any) => ({ id: s.id, name: s.name }),
      );
      setSuppliers(suppliersList);

      const productsList = (productsJson?.data ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? null,
        slug: p.slug ?? null,
        uom: p.uom ?? null,
        unitSize: p.unitSize != null ? Number(p.unitSize) : null,
        category: p.category ?? null,
        categoryId: p.category?.id ?? null,
        thumbnailUrl: p.thumbnailUrl ?? null,
      }));

      const pricesList = (pricesJson?.data ?? []).map((sp: any) => ({
        productId: sp.productId,
        supplierId: sp.supplierId ?? null,
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
        const existing = seen.get(key);
        if (existing) {
          if (sp.supplierId && !existing.supplierIds.includes(sp.supplierId)) {
            existing.supplierIds.push(sp.supplierId);
          }
        } else {
          const prod = productsList.find((p: any) => p.id === sp.productId);
          seen.set(key, {
            key,
            productId: sp.productId,
            productName: sp.product?.name ?? prod?.name ?? "Unknown",
            sku: prod?.sku ?? null,
            slug: prod?.slug ?? null,
            uom,
            unitSize,
            category: prod?.category ?? null,
            categoryId: prod?.categoryId ?? null,
            price: sp.price,
            thumbnailUrl: prod?.thumbnailUrl ?? null,
            supplierIds: sp.supplierId ? [sp.supplierId] : [],
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
            slug: prod.slug ?? null,
            uom: prod.uom,
            unitSize: prod.unitSize,
            category: prod.category,
            categoryId: prod.categoryId ?? null,
            price: 0,
            thumbnailUrl: prod.thumbnailUrl ?? null,
            supplierIds: [],
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
  }, []);

  useEffect(() => {
    loadLookups();
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);
    setFilterFrom(from);
    setFilterTo(to);
  }, [loadLookups]);

  /* ── Load orders ── */
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSiteId && filterSiteId !== "all")
        params.set("siteId", filterSiteId);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
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
  }, [filterSiteId, filterFrom, filterTo]);

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
      if (q) {
        const matchesName = c.productName.toLowerCase().includes(q);
        const matchesSku = c.sku ? c.sku.toLowerCase().includes(q) : false;
        const matchesSlug = c.slug ? c.slug.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesSku && !matchesSlug) return false;
      }
      if (posCategory !== "ALL" && c.category?.id !== posCategory) return false;
      if (posSupplierId && !c.supplierIds.includes(posSupplierId)) return false;
      return true;
    });
  }, [catalog, posSearch, posCategory, posSupplierId]);

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
    setDeleteLoading(true);
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
    } finally {
      setDeleteLoading(false);
    }
  }

  // Reference filter (client-side)
  const filteredOrders = useMemo(() => {
    if (!filterRef.trim()) return orders;
    const q = filterRef.trim().toLowerCase();
    return orders.filter((o) => o.reference?.toLowerCase().includes(q));
  }, [orders, filterRef]);

  // Pagination derived
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedOrders = filteredOrders.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );
  const pFrom = filteredOrders.length === 0 ? 0 : safePage * pageSize + 1;
  const pTo = Math.min(safePage * pageSize + pageSize, filteredOrders.length);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Procurement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage material purchases for sites.
          </p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <Button onClick={openPos}>
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Button>
          <Input
            value={filterRef}
            onChange={(e) => {
              setFilterRef(e.target.value);
              setPage(0);
            }}
            placeholder="Search by reference…"
            className="w-48"
          />
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              From
            </label>
            <Input
              type="date"
              value={filterFrom ?? ""}
              onChange={(e) => {
                setFilterFrom(e.target.value || null);
                setPage(0);
              }}
              className="w-36"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              To
            </label>
            <Input
              type="date"
              value={filterTo ?? ""}
              onChange={(e) => {
                setFilterTo(e.target.value || null);
                setPage(0);
              }}
              className="w-36"
            />
          </div>
          <div className="w-px self-stretch bg-border" />
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
                    {siteLabel(s.name, s.code)}
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
              setFilterRef("");
            }}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
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
              ) : filteredOrders.length === 0 ? (
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
                  const rowTotal = order.items.reduce(
                    (sum, item) => sum + item.quantity * item.unitPriceAtOrder,
                    0,
                  );
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
                          {order.reference ? `#${order.reference}` : "—"}
                        </TableCell>
                        <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm">
                          {order.items.length} item
                          {order.items.length !== 1 ? "s" : ""}
                        </TableCell>
                        <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm font-semibold text-right">
                          {formatCurrency(rowTotal)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={6} className="p-0">
                          <div
                            className="grid transition-all duration-300 ease-in-out"
                            style={{
                              gridTemplateRows: isExpanded ? "1fr" : "0fr",
                            }}
                          >
                            <div className="overflow-hidden">
                              <div
                                className={`px-6 space-y-2 transition-all duration-300 ease-in-out ${isExpanded ? "py-3 opacity-100" : "py-0 opacity-0"}`}
                              >
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
                                          {formatCurrency(
                                            item.unitPriceAtOrder,
                                          )}
                                        </TableCell>
                                        <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-sm font-medium text-right">
                                          {formatCurrency(
                                            item.unitPriceAtOrder *
                                              item.quantity,
                                          )}
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
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {filteredOrders.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t px-4 py-3 bg-muted/60 text-sm">
            <span className="text-muted-foreground">
              Showing <b>{pFrom}</b> to <b>{pTo}</b> of{" "}
              <b>{filteredOrders.length}</b>
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

      {/* POS Sheet / Bottom Fullscreen Drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="h-dvh max-h-dvh w-full p-0 border-0 rounded-none overflow-hidden overflow-y-auto"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Procurement</SheetTitle>
          </SheetHeader>
          <div className="flex h-full bg-background">
            {/* left sidebar for site & supplier pickers (popovers) and order summary */}
            <div className="flex h-full w-72 flex-col items-stretch gap-4 bg-card border-r border-border p-4">
              <Popover
                open={posSitePopoverOpen}
                onOpenChange={setPosSitePopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={posSitePopoverOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {posSiteId
                        ? siteLabel(
                            sites.find((s) => s.id === posSiteId)?.name || "",
                            sites.find((s) => s.id === posSiteId)?.code,
                          ) || "Select site"
                        : "Select site"}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search site..." />
                    <CommandList>
                      <CommandEmpty>No sites found.</CommandEmpty>
                      <CommandGroup>
                        {sites.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={siteLabel(s.name, s.code)}
                            onSelect={() => {
                              setPosSiteId(s.id);
                              setPosSitePopoverOpen(false);
                            }}
                          >
                            <Check
                              className={
                                posSiteId === s.id
                                  ? "mr-2 h-4 w-4 opacity-100"
                                  : "mr-2 h-4 w-4 opacity-0"
                              }
                            />
                            {siteLabel(s.name, s.code)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {/* supplier popover */}
              <Popover
                open={posSupplierPopoverOpen}
                onOpenChange={setPosSupplierPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={posSupplierPopoverOpen}
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {posSupplierId
                        ? suppliers.find((s) => s.id === posSupplierId)?.name ||
                          "Select supplier"
                        : "No specific supplier"}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search supplier..." />
                    <CommandList>
                      <CommandEmpty>No suppliers found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          key="none"
                          value="No specific supplier"
                          onSelect={() => {
                            setPosSupplierId("");
                            setPosSupplierPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={
                              posSupplierId === ""
                                ? "mr-2 h-4 w-4 opacity-100"
                                : "mr-2 h-4 w-4 opacity-0"
                            }
                          />
                          No specific supplier
                        </CommandItem>
                        {suppliers.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={s.name}
                            onSelect={() => {
                              setPosSupplierId(s.id);
                              setPosSupplierPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={
                                posSupplierId === s.id
                                  ? "mr-2 h-4 w-4 opacity-100"
                                  : "mr-2 h-4 w-4 opacity-0"
                              }
                            />
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {/* order summary card */}
              <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card overflow-hidden">
                <div className="border-b border-border px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Order Summary
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {cart.length} item{cart.length !== 1 ? "s" : ""} in order
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-2.5">
                  <div className="flex flex-col gap-2 mb-3">
                    <Input
                      value={posReference}
                      onChange={(e) => setPosReference(e.target.value)}
                      placeholder="Reference (optional)"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={posNote}
                      onChange={(e) => setPosNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="h-8 text-xs"
                    />
                  </div>

                  {cart.length === 0 ? (
                    <div className="flex flex-1 min-h-[160px] flex-col items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/30 p-4 text-center">
                      <p className="text-xs font-medium text-muted-foreground">
                        No items yet
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                        Add materials from the catalogue
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {cart.map((c) => (
                        <div
                          key={c.key}
                          className="flex items-center gap-2.5 rounded-md border border-border bg-background/50 p-2"
                        >
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                            <img
                              src={c.item.thumbnailUrl || "/thumnail.avif"}
                              alt={c.item.productName}
                              className="h-full w-full object-contain"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium leading-tight">
                              {c.item.productName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {c.item.price > 0
                                ? formatCurrency(c.item.price)
                                : "—"}{" "}
                              each
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={1}
                              value={c.quantity}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (
                                  Number.isFinite(n) &&
                                  n >= 1 &&
                                  Number.isSafeInteger(n)
                                ) {
                                  setCartQty(c.key, n);
                                }
                              }}
                              className="h-7 w-12 px-1.5 text-center text-xs tabular-nums"
                            />
                            <button
                              type="button"
                              onClick={() => removeFromCart(c.key)}
                              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                              <span className="text-sm">×</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* footer */}
                <div className="border-t border-border bg-muted/30 px-3 py-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="text-base font-bold tabular-nums">
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={placing || !posSiteId || cart.length === 0}
                    className="w-full h-9 text-xs font-semibold"
                  >
                    {placing ? "Placing..." : "Confirm Order"}
                  </Button>
                </div>
              </div>
            </div>
            {/* main POS area: catalogue */}
            <div className="flex-1 flex flex-col h-full">
              {/* POS Top Bar */}
              <div className="flex items-center gap-4 h-14 border-b border-border bg-card px-4 sm:px-6">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Procurement
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Manage material purchases for sites.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto mr-8">
                  <span className="text-[11px] text-muted-foreground">
                    Order total
                  </span>
                  <span className="text-lg font-bold tabular-nums">
                    {formatCurrency(cartTotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      loadLookups();
                      loadOrders();
                    }}
                    className="ml-2 p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Refresh orders"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* POS Main Area */}
              <div className="flex-1 overflow-hidden">
                <div className="grid h-full w-full gap-4 p-4 sm:p-6">
                  {/* Catalogue column */}
                  <div className="flex min-h-0 flex-col gap-4">
                    <div className="flex flex-col gap-2 rounded border border-border bg-card p-3 sm:p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Material Catalogue
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {filteredCatalog.length} product
                            {filteredCatalog.length !== 1 ? "s" : ""} available
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={posCategory}
                            onValueChange={setPosCategory}
                          >
                            <SelectTrigger className="h-8 w-[150px] text-xs">
                              <SelectValue placeholder="All categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">
                                All categories
                              </SelectItem>
                              {categories.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="relative w-full sm:w-56">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={posSearch}
                              onChange={(e) => setPosSearch(e.target.value)}
                              placeholder="Search materials..."
                              className="h-8 pl-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto rounded border border-dashed border-border/70 bg-muted/30 p-3 sm:p-4">
                      {filteredCatalog.length === 0 ? (
                        <div className="flex h-full min-h-55 items-center justify-center text-center">
                          <div>
                            <p className="text-sm font-medium">
                              No materials found
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Adjust your search or category filters.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                          {filteredCatalog.map((c) => {
                            const inCart = cart.find((ci) => ci.key === c.key);

                            return (
                              <div
                                key={c.key}
                                className="group flex flex-col overflow-hidden rounded border border-border bg-card text-xs sm:text-sm shadow-sm transition hover:border-primary/40 hover:shadow-md"
                              >
                                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                                  <img
                                    src={c.thumbnailUrl || "/thumnail.avif"}
                                    alt={c.productName}
                                    className="h-full w-full object-contain"
                                  />
                                  {inCart && (
                                    <Badge className="absolute left-2 top-2 bg-primary text-[10px] font-semibold">
                                      In order
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex flex-1 flex-col gap-2 p-2.5 sm:p-3">
                                  <div>
                                    <div className="line-clamp-2 text-xs font-semibold sm:text-sm">
                                      {c.productName}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                                      {c.sku ? `SKU: ${c.sku}` : "No SKU"}
                                    </div>
                                  </div>

                                  <div className="mt-auto space-y-1.5 text-[11px] sm:text-xs">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">
                                        Size
                                      </span>
                                      <span className="font-medium">
                                        {fmtSize(c.unitSize, c.uom) || "—"}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">
                                        Unit price
                                      </span>
                                      <span className="font-semibold tabular-nums">
                                        {c.price > 0
                                          ? formatCurrency(c.price)
                                          : "—"}
                                      </span>
                                    </div>
                                  </div>

                                  <Button
                                    type="button"
                                    size="sm"
                                    className="mt-1 h-8 w-full justify-center text-xs font-semibold"
                                    variant={inCart ? "outline" : "default"}
                                    onClick={() => addToCart(c)}
                                  >
                                    {inCart ? "Add more" : "Add to order"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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
        isLoading={deleteLoading}
        confirmText="Delete"
        loadingText="Deleting..."
        variant="destructive"
      />
    </div>
  );
}
