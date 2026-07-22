"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Search,
  X,
  RotateCw,
  Truck,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FolderTree,
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

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  parentSupplierId: string | null;
  parentSupplier: { id: string; name: string } | null;
  _count: { products: number; orders: number };
};

type Category = {
  id: string;
  name: string;
  _count: { procurementProducts: number };
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SuppliersPage() {
  const [activeTab, setActiveTab] = useState<"suppliers" | "categories">(
    "suppliers",
  );

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categorySearch, setCategorySearch] = useState("");

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    parentSupplierId: "",
  });
  const [supplierSubmitting, setSupplierSubmitting] = useState(false);
  const [supplierDeleteTarget, setSupplierDeleteTarget] =
    useState<Supplier | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryDeleteTarget, setCategoryDeleteTarget] =
    useState<Category | null>(null);

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      const params = new URLSearchParams();
      if (supplierSearch) params.set("q", supplierSearch);
      if (showInactive) params.set("includeInactive", "true");
      const res = await fetch(`/api/app/admin/suppliers?${params}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load suppliers");
      setSuppliers(json.data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load suppliers");
    } finally {
      setSuppliersLoading(false);
    }
  }, [supplierSearch, showInactive]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const res = await fetch("/api/app/admin/product-categories", {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load categories");
      setCategories(json.data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load categories");
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
    loadCategories();
  }, [loadSuppliers, loadCategories]);

  function openCreateSupplier() {
    setEditingSupplier(null);
    setSupplierForm({
      name: "",
      phone: "",
      email: "",
      address: "",
      parentSupplierId: "",
    });
    setSupplierDialogOpen(true);
  }

  function openEditSupplier(supplier: Supplier) {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      parentSupplierId: supplier.parentSupplierId ?? "",
    });
    setSupplierDialogOpen(true);
  }

  async function handleSupplierSubmit() {
    if (!supplierForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSupplierSubmitting(true);
    try {
      const url = editingSupplier
        ? `/api/app/admin/suppliers/${editingSupplier.id}`
        : `/api/app/admin/suppliers`;
      const method = editingSupplier ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: supplierForm.name.trim(),
          phone: supplierForm.phone.trim() || null,
          email: supplierForm.email.trim() || null,
          address: supplierForm.address.trim() || null,
          parentSupplierId: supplierForm.parentSupplierId.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save supplier");
      toast.success(editingSupplier ? "Supplier updated" : "Supplier created");
      setSupplierDialogOpen(false);
      loadSuppliers();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save supplier");
    } finally {
      setSupplierSubmitting(false);
    }
  }

  async function handleSupplierDelete() {
    if (!supplierDeleteTarget) return;
    try {
      const res = await fetch(
        `/api/app/admin/suppliers/${supplierDeleteTarget.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete supplier");
      toast.success("Supplier deleted");
      setSupplierDeleteTarget(null);
      loadSuppliers();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete supplier");
    }
  }

  function openCreateCategory() {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDialogOpen(true);
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDialogOpen(true);
  }

  async function handleCategorySubmit() {
    if (!categoryName.trim()) {
      toast.error("Name is required");
      return;
    }
    setCategorySubmitting(true);
    try {
      const url = editingCategory
        ? `/api/app/admin/product-categories/${editingCategory.id}`
        : `/api/app/admin/product-categories`;
      const method = editingCategory ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save category");
      toast.success(editingCategory ? "Category updated" : "Category created");
      setCategoryDialogOpen(false);
      loadCategories();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save category");
    } finally {
      setCategorySubmitting(false);
    }
  }

  async function handleCategoryDelete() {
    if (!categoryDeleteTarget) return;
    try {
      const res = await fetch(
        `/api/app/admin/product-categories/${categoryDeleteTarget.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete category");
      toast.success("Category deleted");
      setCategoryDeleteTarget(null);
      loadCategories();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete category");
    }
  }

  const filteredCategories = categorySearch.trim()
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(categorySearch.trim().toLowerCase()),
      )
    : categories;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Manage material suppliers and procurement categories from one place.
          </p>
        </div>
        <Button
          onClick={
            activeTab === "suppliers" ? openCreateSupplier : openCreateCategory
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {activeTab === "suppliers" ? "Add Supplier" : "Add Category"}
        </Button>
      </div>

      <div className="rounded border border-muted/50 bg-card">
        <div className="flex gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("suppliers")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "suppliers"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Suppliers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "categories"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Categories
          </button>
        </div>

        <div className="mt-4 space-y-5 p-4">
          {activeTab === "suppliers" ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search suppliers..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="pl-9"
                  />
                  {supplierSearch && (
                    <button
                      onClick={() => setSupplierSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInactive(!showInactive)}
                  >
                    {showInactive ? "Hide Inactive" : "Show Inactive"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={loadSuppliers}>
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="border bg-card">
                <Table className="min-w-245 border-separate border-spacing-0">
                  <TableHeader className="bg-muted/60">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                        Supplier
                      </TableHead>
                      <TableHead className="border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                        Contact
                      </TableHead>
                      <TableHead className="border border-zinc-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                        Parent
                      </TableHead>
                      <TableHead className="border border-zinc-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                        Products
                      </TableHead>
                      <TableHead className="border border-zinc-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                        Status
                      </TableHead>
                      <TableHead className="border border-zinc-200 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliersLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 border border-zinc-200 text-center text-muted-foreground dark:border-zinc-700"
                        >
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : suppliers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 border border-zinc-200 text-center text-muted-foreground dark:border-zinc-700"
                        >
                          <Truck className="mx-auto h-8 w-8 mb-2 opacity-40" />
                          No suppliers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      suppliers.map((supplier) => (
                        <TableRow
                          key={supplier.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                        >
                          <TableCell className="border border-zinc-200 px-3 py-2 align-top whitespace-normal dark:border-zinc-700">
                            <div className="max-w-70 wrap-break-word font-medium">
                              {supplier.name}
                            </div>
                            {supplier.address && (
                              <div className="mt-1 flex max-w-70 wrap-break-word items-start gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {supplier.address}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="border border-zinc-200 px-3 py-2 align-top whitespace-normal dark:border-zinc-700">
                            <div className="max-w-62.5 space-y-0.5 text-sm">
                              {supplier.phone && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="h-3 w-3" /> {supplier.phone}
                                </div>
                              )}
                              {supplier.email && (
                                <div className="flex items-center gap-1 text-muted-foreground break-all">
                                  <Mail className="h-3 w-3" /> {supplier.email}
                                </div>
                              )}
                              {!supplier.phone && !supplier.email && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="border border-zinc-200 px-3 py-2 text-center dark:border-zinc-700">
                            {supplier.parentSupplier ? (
                              <Badge variant="secondary">
                                {supplier.parentSupplier.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="border border-zinc-200 px-3 py-2 text-center dark:border-zinc-700">
                            <Badge variant="secondary">
                              {supplier._count.products}
                            </Badge>
                          </TableCell>
                          <TableCell className="border border-zinc-200 px-3 py-2 text-center dark:border-zinc-700">
                            <Badge
                              variant={
                                supplier.isActive ? "default" : "outline"
                              }
                            >
                              {supplier.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="border border-zinc-200 px-3 py-2 text-right dark:border-zinc-700">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openEditSupplier(supplier)}
                                title="Edit supplier"
                                aria-label="Edit supplier"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-destructive"
                                onClick={() =>
                                  setSupplierDeleteTarget(supplier)
                                }
                                title="Delete supplier"
                                aria-label="Delete supplier"
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
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="pl-9"
                  />
                  {categorySearch && (
                    <button
                      onClick={() => setCategorySearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={loadCategories}>
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="border bg-card">
                <Table className="min-w-170 border-separate border-spacing-0">
                  <TableHeader className="bg-muted/60">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                        Category
                      </TableHead>
                      <TableHead className="border border-zinc-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                        Products
                      </TableHead>
                      <TableHead className="border border-zinc-200 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoriesLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="h-24 border border-zinc-200 text-center text-muted-foreground dark:border-zinc-700"
                        >
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredCategories.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="h-24 border border-zinc-200 text-center text-muted-foreground dark:border-zinc-700"
                        >
                          <FolderTree className="mx-auto h-8 w-8 mb-2 opacity-40" />
                          {categorySearch
                            ? "No categories match your search"
                            : "No categories yet"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCategories.map((category) => (
                        <TableRow
                          key={category.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                        >
                          <TableCell className="border border-zinc-200 px-3 py-2 font-medium dark:border-zinc-700">
                            {category.name}
                          </TableCell>
                          <TableCell className="border border-zinc-200 px-3 py-2 text-center dark:border-zinc-700">
                            <Badge variant="secondary">
                              {category._count.procurementProducts}
                            </Badge>
                          </TableCell>
                          <TableCell className="border border-zinc-200 px-3 py-2 text-right dark:border-zinc-700">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openEditCategory(category)}
                                title="Edit category"
                                aria-label="Edit category"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-destructive"
                                onClick={() =>
                                  setCategoryDeleteTarget(category)
                                }
                                disabled={
                                  category._count.procurementProducts > 0
                                }
                                title={
                                  category._count.procurementProducts > 0
                                    ? "Cannot delete: category has products"
                                    : "Delete category"
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
            </>
          )}
        </div>
      </div>

      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Edit Supplier" : "Add Supplier"}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier
                ? "Update the supplier details."
                : "Add a new supplier to the system."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={supplierForm.name}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, name: e.target.value })
                }
                placeholder="Supplier name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={supplierForm.phone}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, phone: e.target.value })
                }
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={supplierForm.email}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, email: e.target.value })
                }
                placeholder="Email address"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Address</label>
              <Input
                value={supplierForm.address}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, address: e.target.value })
                }
                placeholder="Physical address"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Parent Supplier (Optional)
              </label>
              <Select
                value={supplierForm.parentSupplierId}
                onValueChange={(value) =>
                  setSupplierForm({ ...supplierForm, parentSupplierId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a parent supplier..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {suppliers
                    .filter((s) => s.id !== editingSupplier?.id)
                    .map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSupplierDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSupplierSubmit}
              disabled={supplierSubmitting}
            >
              {supplierSubmitting
                ? "Saving..."
                : editingSupplier
                  ? "Update"
                  : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Add Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the category name."
                : "Create a new product category."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Category name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCategoryDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCategorySubmit}
              disabled={categorySubmitting}
            >
              {categorySubmitting
                ? "Saving..."
                : editingCategory
                  ? "Update"
                  : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!supplierDeleteTarget}
        onOpenChange={(open) => !open && setSupplierDeleteTarget(null)}
        title="Delete Supplier"
        description={`Are you sure you want to delete "${supplierDeleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleSupplierDelete}
        confirmText="Delete"
        variant="destructive"
      />

      <ConfirmationDialog
        open={!!categoryDeleteTarget}
        onOpenChange={(open) => !open && setCategoryDeleteTarget(null)}
        title="Delete Category"
        description={`Are you sure you want to delete "${categoryDeleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleCategoryDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
