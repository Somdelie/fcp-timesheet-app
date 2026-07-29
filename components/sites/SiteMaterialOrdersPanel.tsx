"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Minus,
  X,
  Package,
  Trash2,
  ChevronRight,
  RotateCw,
  ShoppingCart,
  ClipboardList,
  Search,
  ChevronsLeft,
  ChevronLeft,
  ChevronsRight,
  Download,
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
import { exportDomToPdf } from "@/lib/exportDomToPdf";

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
  rawDescription: string | null;
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
  foremanId: string | null;
  foremanName: string | null;
  items: OrderItem[];
};

type SiteForeman = { foremanId: string; name: string };
type ForemanCart = {
  foremanId: string;
  foremanName: string;
  items: CartItem[];
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

type SummaryLine = {
  key: string;
  orderRef: string;
  orderDate: string;
  productId: string;
  productName: string;
  uom: string | null;
  unitSize: number | null;
  quantity: number;
  totalCost: number;
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
function fmtDateOnly(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
// Tint-base SKUs (e.g. Micatex, TLS) are shared across many colors, so the
// linked product's name is generic — the description actually ordered on
// this line only survives in rawDescription. Prefer it when present.
function itemProductName(item: OrderItem) {
  return item.rawDescription?.trim() || item.product.name;
}

function itemDisplay(item: OrderItem) {
  const size = fmtSize(
    item.unitSizeAtOrder ?? item.product.unitSize,
    item.uomAtOrder ?? item.product.uom,
  );
  return `${item.quantity} × ${size} ${itemProductName(item)}`;
}

/* ------------------------------------------------------------------ */
/*  Aggregation                                                        */
/* ------------------------------------------------------------------ */

function buildSummaryLines(orders: Order[]): SummaryLine[] {
  return orders
    .flatMap((order) =>
      order.items.map((item) => {
        const uom = item.uomAtOrder ?? item.product.uom ?? "";
        const size = item.unitSizeAtOrder ?? item.product.unitSize;
        return {
          key: `${order.id}-${item.id}`,
          orderRef: order.reference ?? "-",
          orderDate: order.createdAt,
          productId: item.productId,
          productName: itemProductName(item),
          uom: uom || null,
          unitSize: size,
          quantity: item.quantity,
          totalCost: item.quantity * item.unitPriceAtOrder,
        };
      }),
    )
    .sort((a, b) => {
      const byDate =
        new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
      if (byDate !== 0) return byDate;
      const byRef = a.orderRef.localeCompare(b.orderRef, undefined, {
        numeric: true,
      });
      if (byRef !== 0) return byRef;
      return a.productName.localeCompare(b.productName);
    });
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

function PdfStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${accent ? "#bfdbfe" : "#e2e8f0"}`,
        background: accent ? "#eff6ff" : "#f8fafc",
        padding: "12px 16px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: accent ? "#1d4ed8" : "#64748b",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 2,
          fontSize: 20,
          fontWeight: 700,
          color: accent ? "#1e3a8a" : "#020617",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PdfTh({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "center" | "right";
}) {
  return (
    <th
      style={{
        border: "1px solid #0f172a",
        padding: "7px 10px",
        textAlign: align,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: "14px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </th>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function SiteMaterialOrdersPanel({
  siteId,
  siteCode,
  siteName,
}: {
  siteId: string;
  siteCode?: string | null;
  siteName?: string | null;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const summaryPdfRef = useRef<HTMLDivElement | null>(null);
  const [exportingSummary, setExportingSummary] = useState(false);

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

  // Batch order state
  const [batchOpen, setBatchOpen] = useState(false);
  const [siteForemen, setSiteForemen] = useState<SiteForeman[]>([]);
  const [batchForemenCarts, setBatchForemenCarts] = useState<ForemanCart[]>([]);
  const [activeForemanId, setActiveForemanId] = useState<string | null>(null);
  const [batchSupplier, setBatchSupplier] = useState("");
  const [batchReference, setBatchReference] = useState("");
  const [batchNote, setBatchNote] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [batchCategory, setBatchCategory] = useState("ALL");
  const [batchPlacing, setBatchPlacing] = useState(false);

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

  // Pagination
  const ORDERS_PAGE_SIZE = 10;
  const SUMMARY_PAGE_SIZE = 10;
  const [ordersPage, setOrdersPage] = useState(0);
  const [summaryPage, setSummaryPage] = useState(0);

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
        setOrdersPage(0);
        setSummaryPage(0);
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

  async function openBatch() {
    setBatchForemenCarts([]);
    setActiveForemanId(null);
    setBatchSupplier("");
    setBatchReference("");
    setBatchNote("");
    setBatchSearch("");
    setBatchCategory("ALL");
    setBatchOpen(true);
    if (siteForemen.length === 0) {
      try {
        const res = await fetch(`/api/app/admin/sites/${siteId}/foremen`, {
          credentials: "include",
        });
        const json = await res.json();
        if (res.ok) {
          const foremen: SiteForeman[] = (json.foremen ?? []).map((f: any) => ({
            foremanId: f.foremanId,
            name: f.name,
          }));
          setSiteForemen(foremen);
          if (foremen.length > 0) {
            setActiveForemanId(foremen[0].foremanId);
            setBatchForemenCarts(
              foremen.map((f) => ({
                foremanId: f.foremanId,
                foremanName: f.name,
                items: [],
              })),
            );
          }
        }
      } catch {
        toast.error("Failed to load foremen");
      }
    } else {
      setActiveForemanId(siteForemen[0]?.foremanId ?? null);
      setBatchForemenCarts(
        siteForemen.map((f) => ({
          foremanId: f.foremanId,
          foremanName: f.name,
          items: [],
        })),
      );
    }
  }

  function batchAddToCart(item: CatalogItem) {
    if (!activeForemanId) return;
    setBatchForemenCarts((prev) =>
      prev.map((fc) => {
        if (fc.foremanId !== activeForemanId) return fc;
        const existing = fc.items.find((c) => c.key === item.key);
        if (existing)
          return {
            ...fc,
            items: fc.items.map((c) =>
              c.key === item.key ? { ...c, quantity: c.quantity + 1 } : c,
            ),
          };
        return {
          ...fc,
          items: [...fc.items, { key: item.key, item, quantity: 1 }],
        };
      }),
    );
  }

  function batchUpdateQty(key: string, delta: number) {
    if (!activeForemanId) return;
    setBatchForemenCarts((prev) =>
      prev.map((fc) => {
        if (fc.foremanId !== activeForemanId) return fc;
        return {
          ...fc,
          items: fc.items.map((c) => {
            if (c.key !== key) return c;
            const nq = c.quantity + delta;
            return nq < 1 ? c : { ...c, quantity: nq };
          }),
        };
      }),
    );
  }

  function batchRemoveFromCart(key: string) {
    if (!activeForemanId) return;
    setBatchForemenCarts((prev) =>
      prev.map((fc) =>
        fc.foremanId !== activeForemanId
          ? fc
          : { ...fc, items: fc.items.filter((c) => c.key !== key) },
      ),
    );
  }

  async function handlePlaceBatchOrders() {
    const nonEmpty = batchForemenCarts.filter((fc) => fc.items.length > 0);
    if (nonEmpty.length === 0) {
      toast.error("Add items for at least one foreman");
      return;
    }
    setBatchPlacing(true);
    try {
      const res = await fetch(
        `/api/app/admin/sites/${siteId}/product-orders/batch`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierId:
              batchSupplier && batchSupplier !== "__none__"
                ? batchSupplier
                : null,
            reference: batchReference.trim() || null,
            note: batchNote.trim() || null,
            foremen: nonEmpty.map((fc) => ({
              foremanId: fc.foremanId,
              foremanName: fc.foremanName,
              items: fc.items.map((ci) => ({
                productId: ci.item.productId,
                quantity: ci.quantity,
                uom: ci.item.uom || null,
                unitSize: ci.item.unitSize ?? null,
              })),
            })),
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to place orders");

      const totalItems = nonEmpty.reduce(
        (s, fc) => s + fc.items.reduce((s2, c) => s2 + c.quantity, 0),
        0,
      );
      toast.success(
        `${nonEmpty.length} order${nonEmpty.length !== 1 ? "s" : ""} placed — ${totalItems} item${totalItems !== 1 ? "s" : ""}`,
      );
      setBatchOpen(false);
      loadOrders();

      // Open print after placing
      printBatchOrders(
        nonEmpty,
        batchReference,
        batchNote,
        suppliers.find(
          (s) => s.id === batchSupplier && batchSupplier !== "__none__",
        )?.name ?? null,
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to place orders");
    } finally {
      setBatchPlacing(false);
    }
  }

  function printBatchOrders(
    carts: ForemanCart[],
    reference: string,
    note: string,
    supplierName: string | null,
  ) {
    const nonEmpty = carts.filter((fc) => fc.items.length > 0);
    const date = new Date().toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Batch Order${reference ? ` — ${reference}` : ""}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 20px; color: #111; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #555; margin-bottom: 16px; }
  .section { margin-bottom: 20px; page-break-inside: avoid; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
  .section-header { background: #1a3c5e; color: #fff; padding: 6px 10px; font-weight: bold; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f0f4f8; text-align: left; padding: 5px 8px; font-size: 11px; border-bottom: 1px solid #ddd; }
  td { padding: 4px 8px; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  .qty { text-align: center; width: 50px; }
  .footer { margin-top: 16px; font-size: 10px; color: #888; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>Material Order${reference ? ` — ${reference}` : ""}</h1>
<div class="meta">
  Date: ${date}${supplierName ? ` &nbsp;|&nbsp; Supplier: ${supplierName}` : ""}${note ? ` &nbsp;|&nbsp; Note: ${note}` : ""}
</div>
${nonEmpty
  .map(
    (fc) => `
<div class="section">
  <div class="section-header">${fc.foremanName}</div>
  <table>
    <thead><tr><th>Product</th><th class="qty">Qty</th></tr></thead>
    <tbody>
      ${fc.items.map((ci) => `<tr><td>${fmtSize(ci.item.unitSize, ci.item.uom)} ${ci.item.productName}</td><td class="qty">${ci.quantity}</td></tr>`).join("")}
    </tbody>
  </table>
</div>`,
  )
  .join("")}
<div class="footer">Printed ${new Date().toLocaleString("en-ZA")}</div>
</body>
</html>`;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Allow pop-ups to print");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
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

  const summaryLines = buildSummaryLines(orders);
  const totalSummaryPages = Math.ceil(summaryLines.length / SUMMARY_PAGE_SIZE);
  const paginatedSummaryLines = summaryLines.slice(
    summaryPage * SUMMARY_PAGE_SIZE,
    (summaryPage + 1) * SUMMARY_PAGE_SIZE,
  );
  const totalOrdersPages = Math.ceil(orders.length / ORDERS_PAGE_SIZE);
  const paginatedOrders = orders.slice(
    ordersPage * ORDERS_PAGE_SIZE,
    (ordersPage + 1) * ORDERS_PAGE_SIZE,
  );
  const grandTotal = orders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (itemSum, item) => itemSum + item.quantity * item.unitPriceAtOrder,
        0,
      ),
    0,
  );
  const totalItems = summaryLines.reduce((s, a) => s + a.quantity, 0);
  const dateRangeLabel =
    dateFrom || dateTo
      ? `${dateFrom ? fmtDateOnly(dateFrom) : "Start"} - ${
          dateTo ? fmtDateOnly(dateTo) : "Today"
        }`
      : "All dates";

  async function handleExportSummaryPdf() {
    if (summaryLines.length === 0) return;

    setExportingSummary(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!summaryPdfRef.current) throw new Error("PDF template unavailable");

      const stamp = new Date().toISOString().slice(0, 10);
      await exportDomToPdf(summaryPdfRef.current, {
        filename: `material-orders-summary-${stamp}.pdf`,
        scale: 3,
        landscape: true,
        marginMm: 5,
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to export summary PDF");
    } finally {
      setExportingSummary(false);
    }
  }

  const summaryPdf = (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: "-100000px",
        top: 0,
        width: 1280,
        background: "#ffffff",
        color: "#020617",
      }}
    >
      <div
        ref={summaryPdfRef}
        style={{
          background: "#ffffff",
          color: "#020617",
          fontFamily: "Arial, Helvetica, sans-serif",
          minHeight: 760,
          padding: "46px 50px 56px",
          position: "relative",
        }}
      >
        <div
          style={{
            border: "1px solid #2F3B59",
            bottom: 18,
            left: 20,
            pointerEvents: "none",
            position: "absolute",
            right: 20,
            top: 18,
          }}
        />
        <div
          style={{
            border: "3px solid #2F3B59",
            bottom: 22,
            left: 24,
            pointerEvents: "none",
            position: "absolute",
            right: 24,
            top: 22,
          }}
        />
        <div
          style={{
            border: "1px solid #2F3B59",
            bottom: 28,
            left: 30,
            pointerEvents: "none",
            position: "absolute",
            right: 30,
            top: 28,
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ borderBottom: "1px solid #666666", paddingBottom: 12 }}>
            <div
              style={{
                alignItems: "flex-start",
                display: "flex",
                gap: 18,
                justifyContent: "space-between",
              }}
            >
              <div style={{ width: "30%" }}>
                <img
                  alt="Firstclass Projects"
                  src="/logo.png"
                  style={{ display: "block", height: "auto", width: 135 }}
                />
              </div>
              <div style={{ flex: 1, paddingTop: 4, textAlign: "center" }}>
                <h1
                  style={{
                    color: "#111111",
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    margin: 0,
                    textTransform: "uppercase",
                  }}
                >
                  Material Orders Summary
                </h1>
                <p
                  style={{
                    color: "#666666",
                    fontSize: 9,
                    letterSpacing: "0.03em",
                    margin: "4px 0 0",
                  }}
                >
                  Procurement Tracking &amp; Site Material Cost Record
                </p>
              </div>
              <div
                style={{
                  color: "#555555",
                  fontSize: 9,
                  paddingTop: 2,
                  textAlign: "right",
                  width: "30%",
                }}
              >
                <div
                  style={{
                    color: "#111111",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Report Date:{" "}
                  {new Date().toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
                <div style={{ marginTop: 4 }}>{dateRangeLabel}</div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              marginTop: 12,
            }}
          >
            <div style={{ border: "1px solid #666666", padding: 8 }}>
              <div
                style={{
                  borderBottom: "1px solid #dddddd",
                  color: "#777777",
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  paddingBottom: 4,
                  textTransform: "uppercase",
                }}
              >
                Site Name
              </div>
              <div style={{ color: "#111111", fontSize: 10, marginTop: 6 }}>
                {siteCode || "-"} - {siteName || "Unknown Site"}
              </div>
            </div>
            <PdfStat label="Orders" value={String(orders.length)} />
            <PdfStat label="Total Items" value={String(totalItems)} />
            <PdfStat
              label="Grand Total"
              value={fmtCurrency(grandTotal)}
              accent
            />
          </div>

          <div
            style={{
              border: "1px solid #666666",
              fontSize: 9,
              lineHeight: "15px",
              marginTop: 14,
              width: "100%",
            }}
          >
            <div
              style={{
                background: "#2b2b2b",
                color: "#ffffff",
                display: "grid",
                fontSize: 10,
                fontWeight: 700,
                gridTemplateColumns:
                  "85px 105px minmax(0, 1fr) 105px 90px 135px",
                letterSpacing: "0.04em",
                lineHeight: "14px",
                minHeight: 34,
                textTransform: "uppercase",
              }}
            >
              {[
                ["Order #", "center"],
                ["Date Ordered", "center"],
                ["Product", "left"],
                ["Size / Unit", "center"],
                ["Qty", "center"],
                ["Total Cost", "right"],
              ].map(([label, align], index) => (
                <div
                  key={label}
                  style={{
                    alignItems: "center",
                    borderRight: index === 5 ? "none" : "1px solid #0f172a",
                    display: "flex",
                    justifyContent:
                      align === "right"
                        ? "flex-end"
                        : align === "center"
                          ? "center"
                          : "flex-start",
                    padding: "0 10px",
                    textAlign: align as "left" | "center" | "right",
                  }}
                >
                  {label}
                </div>
              ))}
            </div>

            {summaryLines.map((a, index) => (
              <div
                key={`pdf-${a.key}`}
                style={{
                  background: index % 2 === 0 ? "#ffffff" : "#f8f8f8",
                  borderTop: "1px solid #dddddd",
                  display: "grid",
                  gridTemplateColumns:
                    "85px 105px minmax(0, 1fr) 105px 90px 135px",
                  lineHeight: "15px",
                  minHeight: 30,
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    borderRight: "1px solid #dddddd",
                    color: "#777777",
                    display: "flex",
                    justifyContent: "center",
                    padding: "0 8px",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.orderRef}
                </div>
                <div
                  style={{
                    alignItems: "center",
                    borderRight: "1px solid #dddddd",
                    color: "#555555",
                    display: "flex",
                    justifyContent: "center",
                    padding: "0 8px",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtDateOnly(a.orderDate.slice(0, 10))}
                </div>
                <div
                  style={{
                    alignItems: "flex-start",
                    borderRight: "1px solid #dddddd",
                    display: "flex",
                    minWidth: 0,
                    padding: "7px 8px",
                    whiteSpace: "normal",
                  }}
                >
                  <div
                    style={{
                      color: "#020617",
                      fontWeight: 600,
                      lineHeight: "15px",
                      minWidth: 0,
                      overflowWrap: "anywhere",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                    }}
                  >
                    {a.productName}
                  </div>
                </div>
                <div
                  style={{
                    alignItems: "center",
                    borderRight: "1px solid #dddddd",
                    color: "#555555",
                    display: "flex",
                    justifyContent: "center",
                    padding: "0 8px",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtSize(a.unitSize, a.uom) || "-"}
                </div>
                <div
                  style={{
                    alignItems: "center",
                    borderRight: "1px solid #dddddd",
                    color: "#111111",
                    display: "flex",
                    fontWeight: 700,
                    justifyContent: "center",
                    padding: "0 8px",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.quantity}
                  {a.uom ? (
                    <span style={{ color: "#666666", fontWeight: 400 }}>
                      {" "}
                      x {fmtSize(a.unitSize, a.uom)}
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    alignItems: "center",
                    color: "#111111",
                    display: "flex",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 700,
                    justifyContent: "flex-end",
                    padding: "0 8px",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtCurrency(a.totalCost)}
                </div>
              </div>
            ))}

            <div
              style={{
                background: "#eeeeee",
                borderTop: "1px solid #666666",
                display: "grid",
                fontWeight: 700,
                gridTemplateColumns:
                  "85px 105px minmax(0, 1fr) 105px 90px 135px",
                lineHeight: "14px",
                minHeight: 34,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  borderRight: "1px solid #666666",
                  display: "flex",
                  gridColumn: "1 / span 4",
                  letterSpacing: "0.03em",
                  padding: "0 8px",
                  textTransform: "uppercase",
                }}
              >
                Total
              </div>
              <div
                style={{
                  alignItems: "center",
                  borderRight: "1px solid #666666",
                  display: "flex",
                  justifyContent: "center",
                  padding: "0 8px",
                  textAlign: "center",
                }}
              >
                {totalItems}
              </div>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  fontVariantNumeric: "tabular-nums",
                  justifyContent: "flex-end",
                  padding: "0 8px",
                  textAlign: "right",
                }}
              >
                {fmtCurrency(grandTotal)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="rounded border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {exportingSummary ? summaryPdf : null}
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
            <button
              onClick={() => void handleExportSummaryPdf()}
              disabled={
                loading || summaryLines.length === 0 || exportingSummary
              }
              className="h-8 px-3 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[13px] font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {exportingSummary ? "Exporting..." : "PDF"}
            </button>
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
            ) : summaryLines.length === 0 ? (
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
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60 divide-x divide-slate-200 dark:divide-slate-700/60">
                      <th className="w-24 text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Order #
                      </th>
                      <th className="w-32 text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Date Ordered
                      </th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Product
                      </th>
                      <th className="w-32 text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Size / Unit
                      </th>
                      <th className="w-32 text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Qty
                      </th>
                      <th className="w-36 text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Total Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedSummaryLines.map((a, i) => (
                      <tr
                        key={a.key}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors divide-x divide-slate-200 dark:divide-slate-700/60"
                      >
                        <td className="text-center px-3 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {a.orderRef}
                        </td>
                        <td className="text-center px-3 py-2 text-[13px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {fmtDateOnly(a.orderDate.slice(0, 10))}
                        </td>
                        <td className="px-4 py-2 min-w-0">
                          <div className="font-medium text-slate-900 dark:text-white text-[13px] truncate">
                            {a.productName}
                          </div>
                        </td>
                        <td className="text-center px-3 py-2 text-[13px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {fmtSize(a.unitSize, a.uom) || "-"}
                        </td>
                        <td className="text-center px-3 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-[12px] font-semibold">
                            {a.quantity}
                            {a.uom && (
                              <span className="font-normal opacity-70">
                                × {fmtSize(a.unitSize, a.uom)}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="text-right px-4 py-2 font-semibold text-[13px] text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                          {fmtCurrency(a.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 divide-x divide-slate-200 dark:divide-slate-700/60">
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-[12px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide"
                      >
                        Total
                      </td>
                      <td className="text-center px-3 py-3 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                        {totalItems}
                      </td>
                      <td className="text-right px-4 py-3 text-[13px] font-bold text-slate-900 dark:text-white tabular-nums">
                        {fmtCurrency(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {/* Summary pagination */}
            {summaryLines.length > SUMMARY_PAGE_SIZE && (
              <div className="flex items-center justify-between mt-3 px-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {summaryPage * SUMMARY_PAGE_SIZE + 1}–
                  {Math.min(
                    (summaryPage + 1) * SUMMARY_PAGE_SIZE,
                    summaryLines.length,
                  )}{" "}
                  of {summaryLines.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSummaryPage(0)}
                    disabled={summaryPage === 0}
                    className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setSummaryPage((p) => p - 1)}
                    disabled={summaryPage === 0}
                    className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400 px-2">
                    {summaryPage + 1} / {totalSummaryPages}
                  </span>
                  <button
                    onClick={() => setSummaryPage((p) => p + 1)}
                    disabled={summaryPage >= totalSummaryPages - 1}
                    className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setSummaryPage(totalSummaryPages - 1)}
                    disabled={summaryPage >= totalSummaryPages - 1}
                    className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </button>
                </div>
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
              <>
                <div className="flex justify-end gap-2 mb-3">
                  <button
                    onClick={openBatch}
                    className="h-8 px-3 rounded border border-primary text-primary hover:bg-primary/10 text-[13px] font-medium transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Batch Order
                  </button>
                  <button
                    onClick={openPos}
                    className="h-8 px-3 rounded bg-primary hover:bg-primary/90 text-white text-[13px] font-medium transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> New Order
                  </button>
                </div>
                <div className="rounded border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                        <TableHead className="w-8" />
                        <TableHead>Reference</TableHead>
                        <TableHead>Foreman</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead className="text-center">Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrders.map((order) => {
                        const isExpanded = expandedOrderId === order.id;
                        const rowTotal = order.items.reduce(
                          (sum, item) =>
                            sum + item.quantity * item.unitPriceAtOrder,
                          0,
                        );
                        return (
                          <React.Fragment key={order.id}>
                            <TableRow
                              className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                              onClick={() =>
                                setExpandedOrderId(isExpanded ? null : order.id)
                              }
                            >
                              <TableCell className="w-8 pr-0">
                                <ChevronRight
                                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium text-[13px]">
                                {order.reference ? (
                                  `#${order.reference}`
                                ) : (
                                  <span className="text-slate-400 italic text-[12px]">
                                    Unnamed
                                  </span>
                                )}
                                {order.note && (
                                  <div className="text-[11px] text-slate-400 mt-0.5 max-w-[200px] truncate">
                                    {order.note}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-[12px] text-slate-600 dark:text-slate-300">
                                {order.foremanName ?? (
                                  <span className="text-slate-400">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {order.supplier ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                    {order.supplier.name}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[12px]">
                                    —
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {fmtDate(order.createdAt)}
                              </TableCell>
                              <TableCell className="text-[12px] text-slate-500 dark:text-slate-400">
                                {order.createdByUser?.name ?? "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                  {order.items.length}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-[13px] tabular-nums">
                                {fmtCurrency(rowTotal)}
                              </TableCell>
                              <TableCell>
                                <div
                                  className="flex items-center gap-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
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
                                    title="Add item"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                    onClick={() => setDeleteOrderTarget(order)}
                                    title="Delete order"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell
                                  colSpan={8}
                                  className="p-0 bg-slate-50/60 dark:bg-slate-800/20"
                                >
                                  {order.note && (
                                    <div className="px-4 py-2 text-[12px] text-slate-500 dark:text-slate-400 bg-amber-50/60 dark:bg-amber-950/20 border-b border-slate-100 dark:border-slate-800 flex items-start gap-1.5">
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
                                        <tr className="bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 divide-x divide-slate-200 dark:divide-slate-700/60">
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
                                                {itemProductName(item)}
                                              </div>
                                              {(item.unitSizeAtOrder ??
                                                item.product.unitSize ??
                                                item.uomAtOrder ??
                                                item.product.uom) && (
                                                <div className="text-[11px] text-slate-400 mt-0.5">
                                                  {fmtSize(
                                                    item.unitSizeAtOrder ??
                                                      item.product.unitSize,
                                                    item.uomAtOrder ??
                                                      item.product.uom,
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
                                              {fmtCurrency(
                                                item.unitPriceAtOrder,
                                              )}
                                            </td>
                                            <td className="text-right px-4 py-2.5 font-semibold text-slate-900 dark:text-white tabular-nums">
                                              {fmtCurrency(
                                                item.quantity *
                                                  item.unitPriceAtOrder,
                                              )}
                                            </td>
                                            <td className="px-2 py-2.5">
                                              <button
                                                className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                                                onClick={() =>
                                                  handleDeleteItem(
                                                    order.id,
                                                    item.id,
                                                  )
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
                                  <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800">
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
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Orders pagination */}
                {orders.length > ORDERS_PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-3 px-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {ordersPage * ORDERS_PAGE_SIZE + 1}–
                      {Math.min(
                        (ordersPage + 1) * ORDERS_PAGE_SIZE,
                        orders.length,
                      )}{" "}
                      of {orders.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setOrdersPage(0)}
                        disabled={ordersPage === 0}
                        className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ChevronsLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setOrdersPage((p) => p - 1)}
                        disabled={ordersPage === 0}
                        className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs text-slate-500 dark:text-slate-400 px-2">
                        {ordersPage + 1} / {totalOrdersPages}
                      </span>
                      <button
                        onClick={() => setOrdersPage((p) => p + 1)}
                        disabled={ordersPage >= totalOrdersPages - 1}
                        className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setOrdersPage(totalOrdersPages - 1)}
                        disabled={ordersPage >= totalOrdersPages - 1}
                        className="h-7 w-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ChevronsRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Batch Order Dialog                                          */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:z-50 rounded overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 shrink-0">
            <div>
              <DialogTitle className="text-[15px] font-semibold">
                Batch Order
              </DialogTitle>
              <DialogDescription className="text-[12px] mt-0.5">
                Create orders for multiple foremen — one order per foreman saved
                to DB, printed together.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={batchSupplier} onValueChange={setBatchSupplier}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Supplier (opt.)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No supplier</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                className="h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-slate-900 dark:text-white w-32"
                placeholder="Reference (opt.)"
                value={batchReference}
                onChange={(e) => setBatchReference(e.target.value)}
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 min-h-0">
            {/* Left: foreman selector */}
            <div className="w-48 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex flex-col">
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-700">
                Foremen
              </div>
              {siteForemen.length === 0 ? (
                <p className="px-3 py-4 text-[12px] text-slate-400">
                  No foremen assigned to this site.
                </p>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {siteForemen.map((f) => {
                    const cart = batchForemenCarts.find(
                      (fc) => fc.foremanId === f.foremanId,
                    );
                    const count =
                      cart?.items.reduce((s, c) => s + c.quantity, 0) ?? 0;
                    const isActive = activeForemanId === f.foremanId;
                    return (
                      <button
                        key={f.foremanId}
                        onClick={() => setActiveForemanId(f.foremanId)}
                        className={`w-full text-left px-3 py-2.5 text-[13px] border-b border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-between gap-1 ${
                          isActive
                            ? "bg-blue-600 text-white"
                            : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span className="truncate font-medium">{f.name}</span>
                        {count > 0 && (
                          <span
                            className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: POS for active foreman */}
            <div className="flex-1 min-w-0 flex flex-col">
              {!activeForemanId ? (
                <div className="flex items-center justify-center flex-1 text-slate-400 text-sm">
                  Select a foreman
                </div>
              ) : (
                (() => {
                  const activeCart =
                    batchForemenCarts.find(
                      (fc) => fc.foremanId === activeForemanId,
                    )?.items ?? [];
                  const filteredBatch = catalog.filter((c) => {
                    const q = batchSearch.toLowerCase().trim();
                    if (q && !c.productName.toLowerCase().includes(q))
                      return false;
                    if (
                      batchCategory !== "ALL" &&
                      c.category?.id !== batchCategory
                    )
                      return false;
                    return true;
                  });
                  return (
                    <div className="flex flex-1 min-h-0">
                      {/* Catalogue */}
                      <div className="flex-1 min-w-0 flex flex-col border-r border-slate-200 dark:border-slate-700">
                        <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex gap-2 shrink-0">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                              className="w-full h-8 pl-8 pr-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[13px] text-slate-900 dark:text-white"
                              placeholder="Search products…"
                              value={batchSearch}
                              onChange={(e) => setBatchSearch(e.target.value)}
                            />
                          </div>
                          <select
                            value={batchCategory}
                            onChange={(e) => setBatchCategory(e.target.value)}
                            className="h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[13px] text-slate-900 dark:text-white px-2"
                          >
                            <option value="ALL">All categories</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
                          {filteredBatch.map((c) => (
                            <button
                              key={c.key}
                              onClick={() => batchAddToCart(c)}
                              className="text-left p-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                            >
                              <div className="font-medium text-[12px] text-slate-900 dark:text-white leading-tight">
                                {c.productName}
                              </div>
                              {(c.uom || c.unitSize) && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {fmtSize(c.unitSize, c.uom)}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cart */}
                      <div className="w-64 shrink-0 flex flex-col bg-slate-50 dark:bg-slate-800/40">
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 font-semibold text-[13px] text-slate-700 dark:text-slate-200 shrink-0">
                          {
                            siteForemen.find(
                              (f) => f.foremanId === activeForemanId,
                            )?.name
                          }{" "}
                          — Cart
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                          {activeCart.length === 0 ? (
                            <p className="text-[12px] text-slate-400 text-center py-6">
                              No items yet
                            </p>
                          ) : (
                            activeCart.map((ci) => (
                              <div
                                key={ci.key}
                                className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 px-2 py-1.5"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-[12px] font-medium text-slate-900 dark:text-white truncate">
                                    {ci.item.productName}
                                  </div>
                                  {(ci.item.uom || ci.item.unitSize) && (
                                    <div className="text-[11px] text-slate-400">
                                      {fmtSize(ci.item.unitSize, ci.item.uom)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => batchUpdateQty(ci.key, -1)}
                                    className="h-5 w-5 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="text-[12px] w-5 text-center font-semibold">
                                    {ci.quantity}
                                  </span>
                                  <button
                                    onClick={() => batchUpdateQty(ci.key, 1)}
                                    className="h-5 w-5 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => batchRemoveFromCart(ci.key)}
                                    className="h-5 w-5 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 ml-0.5"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 shrink-0">
            <div className="text-[12px] text-slate-500">
              {batchForemenCarts.filter((fc) => fc.items.length > 0).length}{" "}
              foreman order
              {batchForemenCarts.filter((fc) => fc.items.length > 0).length !==
              1
                ? "s"
                : ""}{" "}
              ready
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setBatchOpen(false)}
                className="h-8 px-4 rounded border border-slate-200 dark:border-slate-700 text-[13px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handlePlaceBatchOrders}
                disabled={
                  batchPlacing ||
                  batchForemenCarts.every((fc) => fc.items.length === 0)
                }
                className="h-8 px-4 rounded bg-primary hover:bg-primary/90 text-white text-[13px] font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {batchPlacing ? "Placing…" : "Place Orders & Print"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
