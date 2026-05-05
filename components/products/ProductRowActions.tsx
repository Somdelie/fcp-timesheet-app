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
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductFormDialog, productToForm } from "./ProductFormDialog";
import type { AdminProductDto } from "./ProductsList";

interface ProductRowActionsProps {
  product: AdminProductDto;
}

export default function ProductRowActions({ product }: ProductRowActionsProps) {
  const { id, name, isActive } = product;

  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isToggling, setIsToggling] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/app/admin/products/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null as any);
      if (!res.ok) throw new Error(json?.error || "Failed to delete product");
      toast.success("Product deactivated");
      setShowDeleteDialog(false);
      document.dispatchEvent(new CustomEvent("admin-products:reload"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product");
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
      if (!res.ok) throw new Error(json?.error || "Failed to update product");
      toast.success(isActive ? "Product deactivated" : "Product activated");
      document.dispatchEvent(new CustomEvent("admin-products:reload"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setIsToggling(false);
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
            onSelect={(e) => { e.preventDefault(); setShowEditDialog(true); }}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-2"
            disabled={isToggling}
            onSelect={(e) => { e.preventDefault(); handleToggleActive(); }}
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
            onSelect={(e) => { e.preventDefault(); setShowDeleteDialog(true); }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProductFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        editingId={id}
        initialForm={productToForm(product)}
        onSaved={() => document.dispatchEvent(new CustomEvent("admin-products:reload"))}
      />

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
