"use client";

import * as React from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProductRowActionsProps {
  id: string;
  name: string;
  price: string;
  isActive: boolean;
}

export default function ProductRowActions({
  id,
  name,
  price,
  isActive,
}: ProductRowActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isToggling, setIsToggling] = React.useState(false);

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [editName, setEditName] = React.useState(name);
  const [editPrice, setEditPrice] = React.useState(price);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/app/admin/products/${id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null as any);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete product");
      }
      toast.success("Product deactivated");
      setShowDeleteDialog(false);
      document.dispatchEvent(new CustomEvent("admin-products:reload"));
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete product",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      const res = await fetch(`/api/app/admin/products/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const json = await res.json().catch(() => null as any);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to update product");
      }
      toast.success(isActive ? "Product deactivated" : "Product activated");
      document.dispatchEvent(new CustomEvent("admin-products:reload"));
    } catch (err) {
      console.error("Toggle error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update product",
      );
    } finally {
      setIsToggling(false);
    }
  };

  const handleEdit = async () => {
    const trimmedName = editName.trim();
    const trimmedPrice = editPrice.trim();

    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }
    if (!trimmedPrice) {
      toast.error("Price is required");
      return;
    }

    const n = Number(trimmedPrice.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Price must be a positive number");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/app/admin/products/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmedName, price: trimmedPrice }),
      });
      const json = await res.json().catch(() => null as any);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to update product");
      }
      toast.success("Product updated");
      setShowEditDialog(false);
      document.dispatchEvent(new CustomEvent("admin-products:reload"));
    } catch (err) {
      console.error("Edit error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update product",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Row actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            className="flex items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              setEditName(name);
              setEditPrice(price);
              setShowEditDialog(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-2"
            disabled={isToggling}
            onSelect={(e) => {
              e.preventDefault();
              handleToggleActive();
            }}
          >
            {isToggling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isActive ? (
              <ToggleLeft className="h-4 w-4" />
            ) : (
              <ToggleRight className="h-4 w-4" />
            )}
            {isActive ? "Deactivate" : "Activate"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="flex items-center gap-2 text-red-600 focus:text-red-600"
            onSelect={(e) => {
              e.preventDefault();
              setShowDeleteDialog(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the product name and price.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Product name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Price</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="e.g. 100.00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Product?"
        description="This will permanently deactivate this product. It will no longer appear in product selections."
        onConfirm={handleDelete}
        isLoading={isDeleting}
        confirmText="Delete"
        variant="destructive"
      >
        <p className="text-sm font-medium">{name}</p>
      </ConfirmationDialog>
    </>
  );
}
