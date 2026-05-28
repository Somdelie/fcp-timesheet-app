"use client";

import * as React from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProductFormDialog, productToForm } from "./ProductFormDialog";
import type { AdminProductDto } from "./ProductsList";

interface ProductRowActionsProps {
  product: AdminProductDto;
}

function responseError(json: unknown) {
  return json && typeof json === "object" && "error" in json
    ? String(json.error)
    : null;
}

export default function ProductRowActions({ product }: ProductRowActionsProps) {
  const { id, name, isActive } = product;

  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isToggling, setIsToggling] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [showTransferDialog, setShowTransferDialog] = React.useState(false);
  const [isTransferring, setIsTransferring] = React.useState(false);
  const [transferQty, setTransferQty] = React.useState(1);
  const [transferVariantKey, setTransferVariantKey] = React.useState("");
  const [transferNotes, setTransferNotes] = React.useState("");

  const variantOptions = React.useMemo(
    () =>
      (product.variants ?? []).map((variant) => ({
        key: `${variant.size ?? ""}\x00${variant.color ?? ""}`,
        label: [variant.size, variant.color].filter(Boolean).join(" / ") || "Default",
        size: variant.size ?? null,
        color: variant.color ?? null,
        qty: variant.qty ?? 0,
      })),
    [product.variants],
  );
  const selectedVariant = variantOptions.find((variant) => variant.key === transferVariantKey) ?? null;
  const hasVariants = variantOptions.length > 0;
  const availableQty = hasVariants ? selectedVariant?.qty ?? 0 : product.stockQty ?? 0;

  React.useEffect(() => {
    if (showTransferDialog) {
      setTransferQty(1);
      setTransferVariantKey(variantOptions[0]?.key ?? "");
      setTransferNotes("");
    }
  }, [showTransferDialog, variantOptions]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/app/admin/products/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null as unknown);
      if (!res.ok) throw new Error(responseError(json) || "Failed to delete product");
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
      const json = await res.json().catch(() => null as unknown);
      if (!res.ok) throw new Error(responseError(json) || "Failed to update product");
      toast.success(isActive ? "Product deactivated" : "Product activated");
      document.dispatchEvent(new CustomEvent("admin-products:reload"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setIsToggling(false);
    }
  };

  const handleTransferToCapeTown = async () => {
    const qty = Math.max(1, Number(transferQty) || 0);
    if (qty > availableQty) {
      toast.error(`Only ${availableQty} available in JHB`);
      return;
    }
    if (hasVariants && !selectedVariant) {
      toast.error("Select a variant to transfer");
      return;
    }

    setIsTransferring(true);
    try {
      const res = await fetch(`/api/app/admin/products/${id}/transfer-to-capetown`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qty,
          size: selectedVariant?.size ?? null,
          color: selectedVariant?.color ?? null,
          notes: transferNotes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null as unknown);
      if (!res.ok) throw new Error(responseError(json) || "Failed to transfer stock");
      toast.success("Stock transferred to Cape Town");
      setShowTransferDialog(false);
      document.dispatchEvent(new CustomEvent("admin-products:reload"));
      document.dispatchEvent(new CustomEvent("capetown-stock:reload"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to transfer stock");
    } finally {
      setIsTransferring(false);
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

          {product.category === "PPE" && isActive && (
            <DropdownMenuItem
              className="flex items-center gap-2"
              onSelect={(e) => { e.preventDefault(); setShowTransferDialog(true); }}
            >
              <Send className="h-4 w-4" />
              Transfer to Cape Town
            </DropdownMenuItem>
          )}

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

      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer to Cape Town</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded border bg-muted/30 px-3 py-2 text-sm">
              <div className="font-medium">{name}</div>
              <div className="text-muted-foreground">
                JHB available: <span className="font-semibold text-foreground">{availableQty}</span>
              </div>
            </div>

            {hasVariants && (
              <div className="space-y-1.5">
                <Label>Variant</Label>
                <Select value={transferVariantKey} onValueChange={setTransferVariantKey}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select variant" />
                  </SelectTrigger>
                  <SelectContent>
                    {variantOptions.map((variant) => (
                      <SelectItem key={variant.key} value={variant.key} disabled={variant.qty <= 0}>
                        {variant.label} ({variant.qty})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                max={availableQty || 1}
                value={transferQty}
                onChange={(e) => setTransferQty(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                rows={3}
                placeholder="Optional transfer note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)} disabled={isTransferring}>
              Cancel
            </Button>
            <Button
              onClick={handleTransferToCapeTown}
              disabled={isTransferring || availableQty <= 0 || transferQty <= 0 || transferQty > availableQty}
            >
              {isTransferring ? "Transferring..." : "Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
