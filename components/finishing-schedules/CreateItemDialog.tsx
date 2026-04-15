"use client";

import * as React from "react";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Plus, Loader2 } from "lucide-react";

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

import { addFinishingItem } from "@/actions/site-finishing-schedule";
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

interface Props {
  areaId: string;
  siteMaterials: SiteMaterialOption[];
  suppliers: SupplierOption[];
}

// ============================================================================
// Component
// ============================================================================

export default function CreateItemDialog({ areaId, siteMaterials, suppliers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Form state
  const [zone, setZone] = useState<FinishingZone>("INTERNAL");
  const [position, setPosition] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [product, setProduct] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [colorCode, setColorCode] = useState("");
  const [note, setNote] = useState("");

  // Filtered materials for search
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
    setProduct(m.product.name);
    if (m.product.supplier) setSupplierId(m.product.supplier.id);
  }

  function reset() {
    setZone("INTERNAL");
    setPosition("");
    setMaterialId("");
    setMaterialSearch("");
    setProduct("");
    setSupplierId("");
    setColorCode("");
    setNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!position.trim()) {
      toast.error("Position is required.");
      return;
    }

    startTransition(async () => {
      const res = await addFinishingItem({
        areaId,
        zone,
        position: position.trim(),
        siteMaterialId: materialId || null,
        product: product.trim() || null,
        supplierId: supplierId || null,
        colorCode: colorCode.trim() || null,
        note: note.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to add item.");
        return;
      }
      toast.success("Item added.");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Finishing Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Zone */}
          <div className="space-y-1.5">
            <Label>Zone *</Label>
            <Select
              value={zone}
              onValueChange={(v) => setZone(v as FinishingZone)}
            >
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
              <Label>
                Site Material{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (auto-fills product &amp; supplier)
                </span>
              </Label>
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
                  {filteredMaterials.length === 0 && (
                    <p className="text-muted-foreground px-2 py-1.5 text-xs">
                      No matching materials found.
                    </p>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Product — editable text */}
          <div className="space-y-1.5">
            <Label htmlFor="ci-product">Product</Label>
            <Input
              id="ci-product"
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
          <div className="space-y-1.5">
            <Label htmlFor="ci-colorCode">Colour &amp; Code</Label>
            <Input
              id="ci-colorCode"
              placeholder='e.g. "Pem1000", "00NN31/000 Icon Grey"'
              value={colorCode}
              onChange={(e) => setColorCode(e.target.value)}
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="ci-note">Note</Label>
            <Input
              id="ci-note"
              placeholder="Optional note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
