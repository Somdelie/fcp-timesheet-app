"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { Plus, RotateCw, DollarSign, Pencil, Trash2 } from "lucide-react";

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

type SupplierPrice = {
  id: string;
  supplierId: string;
  productId: string;
  uom: string | null;
  unitSize: number | null;
  price: number;
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
  supplier: { id: string; name: string };
  product: {
    id: string;
    name: string;
    uom: string | null;
    unitSize: number | null;
  };
};

type LookupItem = { id: string; name: string; sku?: string | null };
type UomOption = { value: string; label: string; group: string };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SupplierPricesPage() {
  const [prices, setPrices] = useState<SupplierPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProduct, setFilterProduct] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [filterProductSearch, setFilterProductSearch] = useState("");

  // Lookups
  const [products, setProducts] = useState<LookupItem[]>([]);
  const [suppliers, setSuppliers] = useState<LookupItem[]>([]);
  const [uomOptions, setUomOptions] = useState<UomOption[]>([]);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierPrice | null>(null);
  const [form, setForm] = useState({
    supplierId: "",
    productId: "",
    uom: "",
    unitSize: "",
    price: "",
    startsOn: "",
    endsOn: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const [dialogProductSearch, setDialogProductSearch] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<SupplierPrice | null>(null);

  // Load lookups
  useEffect(() => {
    async function loadLookups() {
      try {
        const [pRes, sRes, uomRes] = await Promise.all([
          fetch("/api/app/admin/procurement-products?includeInactive=true", {
            credentials: "include",
          }),
          fetch("/api/app/admin/suppliers?includeInactive=false", {
            credentials: "include",
          }),
          fetch("/api/app/admin/product-uoms", { credentials: "include" }),
        ]);
        const [pJson, sJson, uomJson] = await Promise.all([
          pRes.json(),
          sRes.json(),
          uomRes.json(),
        ]);
        if (pRes.ok)
          setProducts(
            (pJson.data ?? []).map((p: any) => ({
              id: p.id,
              name: p.name,
              sku: p.sku ?? null,
            })),
          );
        if (sRes.ok)
          setSuppliers(
            (sJson.data ?? []).map((s: any) => ({ id: s.id, name: s.name })),
          );
        if (uomRes.ok) setUomOptions(uomJson.data ?? []);
      } catch {
        // Silently fail
      }
    }
    loadLookups();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterProduct) params.set("productId", filterProduct);
      if (filterSupplier) params.set("supplierId", filterSupplier);
      if (showInactive) params.set("includeInactive", "true");

      const res = await fetch(`/api/app/admin/supplier-prices?${params}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setPrices(json.data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load prices");
    } finally {
      setLoading(false);
    }
  }, [filterProduct, filterSupplier, showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      supplierId: "",
      productId: "",
      uom: "",
      unitSize: "",
      price: "",
      startsOn: "",
      endsOn: "",
    });
    setDialogOpen(true);
  }

  function openEdit(p: SupplierPrice) {
    setEditing(p);
    setForm({
      supplierId: p.supplierId,
      productId: p.productId,
      uom: p.uom ?? "",
      unitSize: p.unitSize != null ? String(p.unitSize) : "",
      price: String(p.price),
      startsOn: p.startsOn ? p.startsOn.slice(0, 10) : "",
      endsOn: p.endsOn ? p.endsOn.slice(0, 10) : "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.supplierId) {
      toast.error("Supplier is required");
      return;
    }
    if (!form.productId) {
      toast.error("Product is required");
      return;
    }
    const priceNum = Number(form.price);
    if (!form.price || !Number.isFinite(priceNum) || priceNum < 0) {
      toast.error("Price must be a valid number");
      return;
    }
    setSubmitting(true);
    try {
      const url = editing
        ? `/api/app/admin/supplier-prices/${editing.id}`
        : `/api/app/admin/supplier-prices`;
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: form.supplierId,
          productId: form.productId,
          uom: form.uom || null,
          unitSize: form.unitSize ? Number(form.unitSize) : null,
          price: priceNum,
          startsOn: form.startsOn || null,
          endsOn: form.endsOn || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");

      toast.success(editing ? "Price updated" : "Price created");
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save price");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/app/admin/supplier-prices/${deleteTarget.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      toast.success("Price deleted");
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete price");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Supplier Prices</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Price
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filterProduct || "ALL"}
          onValueChange={(v) => setFilterProduct(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-50">
            <SelectValue placeholder="All products" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1.5">
              <Input
                placeholder="Search products..."
                value={filterProductSearch}
                onChange={(e) => setFilterProductSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                className="h-8 text-xs"
              />
            </div>
            <SelectItem value="ALL">All products</SelectItem>
            {products
              .filter((p) => {
                const term = filterProductSearch.trim().toLowerCase();
                if (!term) return true;
                return (
                  p.name.toLowerCase().includes(term) ||
                  (p.sku?.toLowerCase().includes(term) ?? false)
                );
              })
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.sku ? `${p.name} (${p.sku})` : p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={filterSupplier || "ALL"}
          onValueChange={(v) => setFilterSupplier(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-50">
            <SelectValue placeholder="All suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowInactive(!showInactive)}
        >
          {showInactive ? "Hide Inactive" : "Show Inactive"}
        </Button>
        <Button variant="ghost" size="icon" onClick={load}>
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : prices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  <DollarSign className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  No prices found
                </TableCell>
              </TableRow>
            ) : (
              prices.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.product.name}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {p.uom ? `${p.unitSize ?? ""}${uomLabel(p.uom)}` : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{p.supplier.name}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(p.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Price" : "Add Price"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the supplier price."
                : "Set a price for a product from a specific supplier."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Supplier *</label>
              <Select
                value={form.supplierId || "NONE"}
                onValueChange={(v) =>
                  setForm({ ...form, supplierId: v === "NONE" ? "" : v })
                }
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Select supplier...</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Product *</label>
              <Select
                value={form.productId || "NONE"}
                onValueChange={(v) =>
                  setForm({ ...form, productId: v === "NONE" ? "" : v })
                }
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5">
                    <Input
                      placeholder="Search products..."
                      value={dialogProductSearch}
                      onChange={(e) => setDialogProductSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="h-8 text-xs"
                    />
                  </div>
                  <SelectItem value="NONE">Select product...</SelectItem>
                  {products
                    .filter((p) => {
                      const term = dialogProductSearch.trim().toLowerCase();
                      if (!term) return true;
                      return (
                        p.name.toLowerCase().includes(term) ||
                        (p.sku?.toLowerCase().includes(term) ?? false)
                      );
                    })
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.sku ? `${p.name} (${p.sku})` : p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Unit of Measure</label>
                <Select
                  value={form.uom || "NONE"}
                  onValueChange={(v) =>
                    setForm({ ...form, uom: v === "NONE" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No UOM</SelectItem>
                    {(() => {
                      const groups = uomOptions.reduce<
                        Record<string, UomOption[]>
                      >((acc, opt) => {
                        (acc[opt.group] ??= []).push(opt);
                        return acc;
                      }, {});
                      return Object.entries(groups).map(([group, opts]) => (
                        <div key={group}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            {group}
                          </div>
                          {opts.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label} ({opt.value})
                            </SelectItem>
                          ))}
                        </div>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Unit Size</label>
                <Input
                  type="number"
                  step="any"
                  value={form.unitSize}
                  onChange={(e) =>
                    setForm({ ...form, unitSize: e.target.value })
                  }
                  placeholder="e.g. 5 for 5L"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Price (ZAR) *</label>
              <Input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Price"
        description={`Are you sure you want to delete this price entry for "${deleteTarget?.product.name}" from "${deleteTarget?.supplier.name}"?`}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
