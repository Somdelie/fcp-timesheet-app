"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Search,
  X,
  RotateCw,
  Package,
  Pencil,
  Trash2,
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

type ProcurementProduct = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  isActive: boolean;
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  _count: { orderItems: number; supplierPrices: number };
};

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProcurementProductsPage() {
  const [products, setProducts] = useState<ProcurementProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterSupplier, setFilterSupplier] = useState<string>("");

  // Lookup data
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProcurementProduct | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    categoryId: "",
    supplierId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ProcurementProduct | null>(
    null,
  );

  // Load lookup data on mount
  useEffect(() => {
    async function loadLookups() {
      try {
        const [catRes, supRes] = await Promise.all([
          fetch("/api/app/admin/product-categories", {
            credentials: "include",
          }),
          fetch("/api/app/admin/suppliers?includeInactive=false", {
            credentials: "include",
          }),
        ]);
        const [catJson, supJson] = await Promise.all([
          catRes.json(),
          supRes.json(),
        ]);
        if (catRes.ok) setCategories(catJson.data ?? []);
        if (supRes.ok) setSuppliers(supJson.data ?? []);
      } catch {
        // Silently fail — fields will just be empty
      }
    }
    loadLookups();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (showInactive) params.set("includeInactive", "true");
      if (filterCategory) params.set("categoryId", filterCategory);
      if (filterSupplier) params.set("supplierId", filterSupplier);

      const res = await fetch(`/api/app/admin/procurement-products?${params}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setProducts(json.data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [search, showInactive, filterCategory, filterSupplier]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      sku: "",
      description: "",
      categoryId: "",
      supplierId: "",
    });
    setDialogOpen(true);
  }

  function openEdit(p: ProcurementProduct) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      description: p.description ?? "",
      categoryId: p.category?.id ?? "",
      supplierId: p.supplier?.id ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const url = editing
        ? `/api/app/admin/procurement-products/${editing.id}`
        : `/api/app/admin/procurement-products`;
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          sku: form.sku.trim() || null,
          description: form.description.trim() || null,
          categoryId: form.categoryId || null,
          supplierId: form.supplierId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");

      toast.success(editing ? "Product updated" : "Product created");
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save product");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/app/admin/procurement-products/${deleteTarget.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      toast.success("Product deleted");
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete product");
    }
  }

  // Group UOM options removed — UOM now lives on supplier prices

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Procurement Materials</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-50 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={filterCategory}
          onValueChange={(v) => setFilterCategory(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-45">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterSupplier}
          onValueChange={(v) => setFilterSupplier(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-45">
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
              <TableHead>Category</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-center">Prices</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    {p.sku && (
                      <div className="text-xs text-muted-foreground">
                        SKU: {p.sku}
                      </div>
                    )}
                    {p.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {p.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.category ? (
                      <Badge variant="outline">{p.category.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.supplier ? (
                      <span className="text-sm">{p.supplier.name}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{p._count.supplierPrices}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={p.isActive ? "default" : "outline"}>
                      {p.isActive ? "Active" : "Inactive"}
                    </Badge>
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
                        disabled={p._count.orderItems > 0}
                        title={
                          p._count.orderItems > 0
                            ? "Cannot delete: product used in orders"
                            : "Delete product"
                        }
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Product" : "Add Product"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the procurement product details."
                : "Add a new procurement product (material, paint, cement, etc.)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Product name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">SKU</label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Optional SKU"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={form.categoryId || "NONE"}
                  onValueChange={(v) =>
                    setForm({ ...form, categoryId: v === "NONE" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Default Supplier</label>
                <Select
                  value={form.supplierId || "NONE"}
                  onValueChange={(v) =>
                    setForm({ ...form, supplierId: v === "NONE" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No supplier</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional description"
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
        title="Delete Product"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
