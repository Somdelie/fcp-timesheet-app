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

type ItemData = {
  id: string;
  zone: "INTERNAL" | "EXTERNAL";
  position: string;
  product: string | null;
  colorCode: string | null;
  supplier: string | null;
  note: string | null;
  siteMaterialId: string | null;
};

interface Props {
  item: ItemData;
  siteMaterials: SiteMaterialOption[];
}

// ============================================================================
// Component
// ============================================================================

export default function EditItemDialog({ item, siteMaterials }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Form state initialized from item
  const [zone, setZone] = useState<FinishingZone>(item.zone);
  const [position, setPosition] = useState(item.position ?? "");
  const [materialId, setMaterialId] = useState(item.siteMaterialId ?? "");
  const [materialSearch, setMaterialSearch] = useState("");
  const [colorCode, setColorCode] = useState(item.colorCode ?? "");
  const [note, setNote] = useState(item.note ?? "");

  // Auto-fill
  const selectedMaterial = useMemo(
    () => siteMaterials.find((m) => m.id === materialId),
    [siteMaterials, materialId],
  );
  const autoProduct = selectedMaterial?.product.name ?? item.product ?? "";
  const autoSupplier =
    selectedMaterial?.product.supplier?.name ?? item.supplier ?? "";

  const filteredMaterials = useMemo(() => {
    if (!materialSearch.trim()) return siteMaterials;
    const q = materialSearch.toLowerCase();
    return siteMaterials.filter(
      (m) =>
        m.product.name.toLowerCase().includes(q) ||
        (m.product.sku && m.product.sku.toLowerCase().includes(q)),
    );
  }, [siteMaterials, materialSearch]);

  function resetToItem() {
    setZone(item.zone);
    setPosition(item.position ?? "");
    setMaterialId(item.siteMaterialId ?? "");
    setMaterialSearch("");
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

          {/* Site Material */}
          <div className="space-y-1.5">
            <Label>Site Material (Product)</Label>
            {siteMaterials.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No materials linked to this site.
              </p>
            ) : (
              <>
                <Input
                  placeholder="Search materials…"
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  className="mb-1"
                />
                <Select value={materialId} onValueChange={setMaterialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select site material…" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMaterials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.product.name}
                        {m.product.sku && ` (${m.product.sku})`}
                        {m.product.supplier && ` — ${m.product.supplier.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Auto-filled fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Input value={autoProduct} readOnly className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Input value={autoSupplier} readOnly className="bg-muted" />
            </div>
          </div>

          {/* Colour code */}
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
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
