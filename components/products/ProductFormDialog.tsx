"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { AdminProductDto } from "./ProductsList";

type StockCategory = "PPE" | "TOOL";

export interface ProductFormValues {
  name: string;
  price: string;
  category: StockCategory;
  sku: string;
  description: string;
  colorsRaw: string;
  sizesRaw: string;
  stockQty: number;
  thumbnailUrl: string;
  variantQtys: Record<string, number>;
}

function variantKey(size: string, color: string) {
  return `${size}\x00${color}`;
}

function buildVariantStocks(
  sizes: string[],
  colors: string[],
  qtys: Record<string, number>,
) {
  if (sizes.length === 0 && colors.length === 0) return [];
  const sizeList = sizes.length > 0 ? sizes : [""];
  const colorList = colors.length > 0 ? colors : [""];
  const result: { size: string | null; color: string | null; qty: number }[] = [];
  for (const size of sizeList) {
    for (const color of colorList) {
      result.push({ size: size || null, color: color || null, qty: qtys[variantKey(size, color)] ?? 0 });
    }
  }
  return result;
}

function ColorDot({ color }: { color: string }) {
  const isHex = /^#[0-9a-f]{3,6}$/i.test(color);
  return (
    <span
      title={color}
      className="inline-block h-3.5 w-3.5 rounded-full border border-border shrink-0"
      style={isHex ? { backgroundColor: color } : { backgroundColor: "#e5e7eb" }}
    />
  );
}

function emptyForm(category: StockCategory = "PPE"): ProductFormValues {
  return {
    name: "",
    price: "",
    category,
    sku: "",
    description: "",
    colorsRaw: "",
    sizesRaw: "",
    stockQty: 0,
    thumbnailUrl: "",
    variantQtys: {},
  };
}

export function productToForm(p: AdminProductDto): ProductFormValues {
  const qtys: Record<string, number> = {};
  for (const v of p.variants ?? []) {
    qtys[variantKey(v.size ?? "", v.color ?? "")] = v.qty;
  }
  return {
    name: p.name,
    price: p.price,
    category: p.category,
    sku: p.sku ?? "",
    description: p.description ?? "",
    colorsRaw: (p.colors ?? []).join(", "),
    sizesRaw: (p.sizes ?? []).join(", "),
    stockQty: p.stockQty ?? 0,
    thumbnailUrl: p.thumbnailUrl ?? "",
    variantQtys: qtys,
  };
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string;
  initialForm?: ProductFormValues;
  defaultCategory?: StockCategory;
  onSaved: () => void;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  editingId,
  initialForm,
  defaultCategory = "PPE",
  onSaved,
}: ProductFormDialogProps) {
  const [form, setForm] = React.useState<ProductFormValues>(initialForm ?? emptyForm(defaultCategory));
  const [submitting, setSubmitting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) setForm(initialForm ?? emptyForm(defaultCategory));
  }, [open]);

  const sizes = form.sizesRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const colors = form.colorsRaw.split(",").map((c) => c.trim()).filter(Boolean);
  const hasVariants = sizes.length > 0 || colors.length > 0;

  function getQty(size: string, color: string) {
    return form.variantQtys[variantKey(size, color)] ?? 0;
  }
  function setQty(size: string, color: string, qty: number) {
    setForm((f) => ({
      ...f,
      variantQtys: { ...f.variantQtys, [variantKey(size, color)]: Math.max(0, qty) },
    }));
  }

  async function handleUpload(file: File) {
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "ppe-products");
      const res = await fetch("/api/uploads/image", { method: "POST", credentials: "include", body: fd });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Upload failed");
      const url = String(payload.url ?? "");
      if (!url) throw new Error("Upload did not return a URL.");
      setForm((f) => ({ ...f, thumbnailUrl: url }));
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) handleUpload(file);
    else toast.error("Please drop an image file");
  }

  async function handleSubmit() {
    const trimmedName = form.name.trim();
    if (!trimmedName) { toast.error("Name is required"); return; }
    const priceNum = Number(String(form.price).replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum <= 0) { toast.error("Price must be a positive number"); return; }

    const variantStocks = buildVariantStocks(sizes, colors, form.variantQtys);
    const stockQty = variantStocks.length > 0
      ? variantStocks.reduce((s, v) => s + v.qty, 0)
      : form.stockQty;

    const payload = {
      name: trimmedName,
      price: String(priceNum),
      category: form.category,
      sku: form.sku.trim() || null,
      description: form.description.trim() || null,
      sizes,
      colors,
      stockQty,
      thumbnailUrl: form.thumbnailUrl || null,
      variantStocks,
    };

    try {
      setSubmitting(true);
      let res: Response;
      if (editingId) {
        res = await fetch(`/api/app/admin/products/${editingId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/app/admin/products", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const json = await res.json().catch(() => null as any);
      if (!res.ok) throw new Error(json?.error ?? `Failed to save (${res.status})`);

      toast.success(editingId ? "Product updated" : "Product created");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save product");
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = !!editingId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : `Add ${form.category === "PPE" ? "PPE Item" : "Tool"}`}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update product details, sizes, colors and stock."
              : form.category === "PPE"
              ? "Add a PPE item to the catalogue."
              : "Add a tool to the catalogue."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Image */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Image (optional)</label>
            {form.thumbnailUrl ? (
              <div className="rounded border-2 border-dashed border-green-500 bg-green-50/30 dark:bg-green-950/20 p-3">
                <div className="flex items-end gap-3">
                  <img src={form.thumbnailUrl} alt="Thumbnail" className="h-20 w-20 rounded object-cover shadow-sm" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">Image uploaded</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, thumbnailUrl: "" })}
                    className="rounded bg-white p-1.5 hover:bg-red-50 text-red-600 dark:bg-zinc-800 dark:hover:bg-red-950/30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                className={`relative rounded border-2 border-dashed transition-colors p-4 text-center cursor-pointer ${
                  dragActive
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/30 hover:border-blue-400"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
                  disabled={uploading}
                />
                <div className="flex flex-col items-center gap-1.5">
                  <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-950/50">
                    <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm font-medium">{uploading ? "Uploading…" : "Click to upload or drag image"}</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                </div>
              </div>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Category</label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as StockCategory })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PPE">PPE</SelectItem>
                <SelectItem value="TOOL">Tool</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Name + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={form.category === "PPE" ? "e.g. Safety boots" : "e.g. 6ft Ladder"}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">SKU</label>
              <Input
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="e.g. SB-001"
              />
            </div>
          </div>

          {/* Price */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Price (R) *</label>
            <Input
              type="number" min="0" step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="e.g. 100.00"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>

          {/* Colors */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Colors <span className="font-normal text-muted-foreground">(comma-separated)</span>
            </label>
            <Input
              value={form.colorsRaw}
              onChange={(e) => setForm({ ...form, colorsRaw: e.target.value })}
              placeholder="e.g. Black, White, Navy, #FF5733"
            />
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {colors.map((c) => (
                  <div key={c} className="flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-xs">
                    <ColorDot color={c} />{c}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sizes */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Sizes <span className="font-normal text-muted-foreground">(comma-separated)</span>
            </label>
            <Input
              value={form.sizesRaw}
              onChange={(e) => setForm({ ...form, sizesRaw: e.target.value })}
              placeholder="e.g. S, M, L, XL, 2XL or Size 7, Size 8, Size 9"
            />
            {sizes.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {sizes.map((s) => (
                  <span key={s} className="inline-flex items-center rounded border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium">{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* Stock Quantities */}
          {!hasVariants ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Stock Quantity</label>
              <Input
                type="number" min={0}
                value={form.stockQty}
                onChange={(e) => setForm({ ...form, stockQty: Math.max(0, Number(e.target.value)) })}
                placeholder="0"
              />
            </div>
          ) : sizes.length > 0 && colors.length > 0 ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Stock per Size & Color
                <span className="ml-2 font-normal text-muted-foreground text-xs">
                  total: {sizes.flatMap((s) => colors.map((c) => getQty(s, c))).reduce((a, b) => a + b, 0)}
                </span>
              </label>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="border-b border-r border-border px-2 py-1.5 text-left font-medium text-muted-foreground">Size / Color</th>
                      {colors.map((c) => (
                        <th key={c} className="border-b border-r border-border px-2 py-1.5 text-center font-medium last:border-r-0">
                          <div className="flex items-center justify-center gap-1"><ColorDot color={c} />{c}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((size, si) => (
                      <tr key={size} className={si % 2 !== 0 ? "bg-muted/20" : ""}>
                        <td className="border-b border-r border-border px-2 py-1 font-medium">{size}</td>
                        {colors.map((color) => (
                          <td key={color} className="border-b border-r border-border px-1 py-1 last:border-r-0">
                            <Input
                              type="number" min={0}
                              value={getQty(size, color)}
                              onChange={(e) => setQty(size, color, Number(e.target.value))}
                              className="h-7 w-16 text-center text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : sizes.length > 0 ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Stock per Size
                <span className="ml-2 font-normal text-muted-foreground text-xs">
                  total: {sizes.map((s) => getQty(s, "")).reduce((a, b) => a + b, 0)}
                </span>
              </label>
              <div className="space-y-1">
                {sizes.map((size) => (
                  <div key={size} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 rounded border border-border bg-muted/40 px-2 py-1 text-center text-xs font-medium">{size}</span>
                    <Input
                      type="number" min={0}
                      value={getQty(size, "")}
                      onChange={(e) => setQty(size, "", Number(e.target.value))}
                      className="h-8 w-24 text-xs" placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Stock per Color
                <span className="ml-2 font-normal text-muted-foreground text-xs">
                  total: {colors.map((c) => getQty("", c)).reduce((a, b) => a + b, 0)}
                </span>
              </label>
              <div className="space-y-1">
                {colors.map((color) => (
                  <div key={color} className="flex items-center gap-3">
                    <div className="flex w-32 shrink-0 items-center gap-1.5 rounded border border-border bg-muted/40 px-2 py-1">
                      <ColorDot color={color} />
                      <span className="truncate text-xs">{color}</span>
                    </div>
                    <Input
                      type="number" min={0}
                      value={getQty("", color)}
                      onChange={(e) => setQty("", color, Number(e.target.value))}
                      className="h-8 w-24 text-xs" placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
