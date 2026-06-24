"use client";

import * as React from "react";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Pencil, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { updateFinishingItem } from "@/actions/site-finishing-schedule";
import type { FinishingZone } from "@/generated/prisma/client";

// ============================================================================
// Types
// ============================================================================

type SiteMaterialOption = {
  id: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    supplier: { id: string; name: string } | null;
  };
};

type SupplierOption = { id: string; name: string };

type SitePaintColorOption = {
  id: string;
  colorName: string;
  colorCode: string | null;
  baseType: string;
  productId: string | null;
  productSnapshot: string | null;
  supplierId: string | null;
  supplierSnapshot: string | null;
  product: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
};

type ItemData = {
  id: string;
  zone: "INTERNAL" | "EXTERNAL";
  position: string;
  product: string | null;
  colorCode: string | null;
  supplier: string | null;
  supplierId: string | null;
  note: string | null;
  siteMaterialId: string | null;
};

interface Props {
  item: ItemData;
  siteMaterials: SiteMaterialOption[];
  sitePaintColors: SitePaintColorOption[];
  suppliers: SupplierOption[];
}

// ============================================================================
// Component
// ============================================================================

export default function EditItemDialog({
  item,
  siteMaterials,
  sitePaintColors,
  suppliers,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [zone, setZone] = useState<FinishingZone>(item.zone);
  const [position, setPosition] = useState(item.position ?? "");
  const [materialId, setMaterialId] = useState(item.siteMaterialId ?? "");
  const [materialSearch, setMaterialSearch] = useState("");
  const [product, setProduct] = useState(item.product ?? "");
  const [supplierId, setSupplierId] = useState(item.supplierId ?? "");
  const [colorCode, setColorCode] = useState(item.colorCode ?? "");
  const [note, setNote] = useState(item.note ?? "");

  const filteredMaterials = useMemo(() => {
    if (!materialSearch.trim()) return siteMaterials;
    const q = materialSearch.toLowerCase();
    return siteMaterials.filter(
      (m) =>
        m.product.name.toLowerCase().includes(q) ||
        (m.product.sku && m.product.sku.toLowerCase().includes(q)),
    );
  }, [siteMaterials, materialSearch]);

  function handleMaterialChange(id: string) {
    setMaterialId(id);
    if (!id) return;
    const m = siteMaterials.find((s) => s.id === id);
    if (!m) return;
    // Auto-fill product and supplier from site material
    setProduct(m.product.name);
    if (m.product.supplier) setSupplierId(m.product.supplier.id);
  }

  function paintColorLabel(c: SitePaintColorOption) {
    const code = c.colorCode ? ` ${c.colorCode}` : "";
    const base = c.baseType && c.baseType !== "NEUTRAL" ? ` (${c.baseType})` : "";
    return `${c.colorName}${code}${base}`;
  }

  function handlePaintColorChange(id: string) {
    if (id === "__none__") {
      setColorCode("");
      return;
    }
    const c = sitePaintColors.find((color) => color.id === id);
    if (!c) return;
    setColorCode(paintColorLabel(c));
    const productName = c.product?.name ?? c.productSnapshot;
    if (productName) setProduct(productName);
    const colorSupplierId = c.supplier?.id ?? c.supplierId;
    if (colorSupplierId) setSupplierId(colorSupplierId);
    if (c.productId) {
      const matchingMaterial = siteMaterials.find(
        (m) => m.product.id === c.productId,
      );
      if (matchingMaterial) setMaterialId(matchingMaterial.id);
    }
  }

  function resetToItem() {
    setZone(item.zone);
    setPosition(item.position ?? "");
    setMaterialId(item.siteMaterialId ?? "");
    setMaterialSearch("");
    setProduct(item.product ?? "");
    setSupplierId(item.supplierId ?? "");
    setColorCode(item.colorCode ?? "");
    setNote(item.note ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!position.trim()) {
      toast.error("Position is required.");
      return;
    }

    startTransition(async () => {
      const res = await updateFinishingItem({
        id: item.id,
        zone,
        position: position.trim(),
        siteMaterialId: materialId || null,
        product: product.trim() || null,
        supplierId: supplierId || null,
        colorCode: colorCode.trim() || null,
        note: note.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update item.");
        return;
      }
      toast.success("Item updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetToItem();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Finishing Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Zone */}
          <div className="space-y-1.5">
            <Label>Zone</Label>
            <Select value={zone} onValueChange={(v) => setZone(v as FinishingZone)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNAL">Internal</SelectItem>
                <SelectItem value="EXTERNAL">External</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Position */}
          <div className="space-y-1.5">
            <Label>Position *</Label>
            <Input
              placeholder='e.g. "Walls", "Bottom Band", "Doors", "Skirting"'
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>

          {/* Site Material (optional — auto-fills product/supplier) */}
          {siteMaterials.length > 0 && (
            <div className="space-y-1.5">
              <Label>Site Material <span className="text-xs text-muted-foreground font-normal">(auto-fills product & supplier)</span></Label>
              <Input
                placeholder="Search materials…"
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="mb-1"
              />
              <Select value={materialId || "__none__"} onValueChange={(v) => handleMaterialChange(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select site material…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {filteredMaterials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.product.name}
                      {m.product.sku && ` (${m.product.sku})`}
                      {m.product.supplier && ` — ${m.product.supplier.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Product — editable text */}
          <div className="space-y-1.5">
            <Label htmlFor="ei-product">Product</Label>
            <Input
              id="ei-product"
              placeholder="e.g. Plascon Velvaglo"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            />
          </div>

          {/* Supplier — select from all suppliers */}
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Select value={supplierId || "__none__"} onValueChange={(v) => setSupplierId(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Colour code */}
          {sitePaintColors.length > 0 && (
            <div className="space-y-1.5">
              <Label>Site Colour</Label>
              <Select onValueChange={handlePaintColorChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select seeded site colour..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {sitePaintColors.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {paintColorLabel(c)}
                      {(c.product?.name ?? c.productSnapshot) &&
                        ` - ${c.product?.name ?? c.productSnapshot}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ei-colorCode">Colour &amp; Code</Label>
            <Input
              id="ei-colorCode"
              value={colorCode}
              onChange={(e) => setColorCode(e.target.value)}
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="ei-note">Note</Label>
            <Input
              id="ei-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
