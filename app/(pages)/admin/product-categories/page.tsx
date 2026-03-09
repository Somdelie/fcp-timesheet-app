"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { Plus, RotateCw, FolderTree, Pencil, Trash2 } from "lucide-react";

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

type Category = {
  id: string;
  name: string;
  _count: { procurementProducts: number };
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProductCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/admin/product-categories", {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setCategories(json.data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDialogOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const url = editing
        ? `/api/app/admin/product-categories/${editing.id}`
        : `/api/app/admin/product-categories`;
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");

      toast.success(editing ? "Category updated" : "Category created");
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to save category");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/app/admin/product-categories/${deleteTarget.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      toast.success("Category deleted");
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete category");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Product Categories</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={load}>
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add Category
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-center">Products</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center py-8 text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center py-8 text-muted-foreground"
                >
                  <FolderTree className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  No categories yet
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">
                      {c._count.procurementProducts}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(c)}
                        disabled={c._count.procurementProducts > 0}
                        title={
                          c._count.procurementProducts > 0
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Category" : "Add Category"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the category name."
                : "Create a new product category."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Category name"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
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
        title="Delete Category"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
