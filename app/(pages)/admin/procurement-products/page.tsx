"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Search,
  X,
  RotateCw,
  Package,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Upload,
  Wrench,
  Layers,
  MoreHorizontal,
  RotateCcw,
  DollarSign,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type ProductType = "MATERIAL" | "PPE" | "PLANT" | "CONSUMABLE" | "OTHER";

const PRODUCT_TYPES: {
  value: ProductType;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    value: "MATERIAL",
    label: "Material",
    icon: <Layers className="h-3.5 w-3.5" />,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  },
  {
    value: "PPE",
    label: "PPE",
    icon: <Package className="h-3.5 w-3.5" />,
    color:
      "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  },
  {
    value: "PLANT",
    label: "Plant",
    icon: <Wrench className="h-3.5 w-3.5" />,
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  },
  {
    value: "CONSUMABLE",
    label: "Consumable",
    icon: <Package className="h-3.5 w-3.5" />,
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  },
  {
    value: "OTHER",
    label: "Other",
    icon: <MoreHorizontal className="h-3.5 w-3.5" />,
    color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
];

function typeStyle(t: ProductType) {
  return PRODUCT_TYPES.find((x) => x.value === t) ?? PRODUCT_TYPES[0];
}

type SupplierPriceEntry = {
  id: string;
  price: number;
  uom: string | null;
  unitSize: number | null;
  supplierId: string;
  supplier: { id: string; name: string };
  isActive: boolean;
};

const PRODUCT_UOMS = [
  "EACH",
  "UNIT",
  "PIECE",
  "PACK",
  "BOX",
  "BAG",
  "BUCKET",
  "DRUM",
  "CAN",
  "BOTTLE",
  "TUBE",
  "BAR",
  "ROLL",
  "SHEET",
  "BUNDLE",
  "PALLET",
  "MM",
  "CM",
  "M",
  "M2",
  "M3",
  "G",
  "KG",
  "TON",
  "ML",
  "L",
  "HOUR",
  "DAY",
] as const;

type ProductVariantStock = {
  id: string;
  size: string | null;
  color: string | null;
  qty: number;
};

type ProcurementProduct = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  productType: ProductType;
  isReturnable: boolean;
  isDeductible: boolean;
  deductionSplits: number;
  colors: string[];
  sizes: string[];
  stockQty: number;
  variantStocks: ProductVariantStock[];
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  supplierPrices: SupplierPriceEntry[];
  _count: { orderItems: number; supplierPrices: number };
};

function variantKey(size: string, color: string) {
  return `${size}\x00${color}`;
}

function buildVariantStocks(
  sizes: string[],
  colors: string[],
  qtys: Record<string, number>,
): { size: string | null; color: string | null; qty: number }[] {
  if (sizes.length === 0 && colors.length === 0) return [];
  const sizeList = sizes.length > 0 ? sizes : [""];
  const colorList = colors.length > 0 ? colors : [""];
  const result: { size: string | null; color: string | null; qty: number }[] =
    [];
  for (const size of sizeList) {
    for (const color of colorList) {
      result.push({
        size: size || null,
        color: color || null,
        qty: qtys[variantKey(size, color)] ?? 0,
      });
    }
  }
  return result;
}

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };

/* ------------------------------------------------------------------ */
/*  Color tag helpers                                                   */
/* ------------------------------------------------------------------ */

function ColorDot({ color }: { color: string }) {
  const lc = color.toLowerCase();
  const isHex = /^#[0-9a-f]{3,6}$/i.test(lc);
  return (
    <span
      title={color}
      className="inline-block h-3.5 w-3.5 rounded-full border border-border shrink-0"
      style={
        isHex ? { backgroundColor: color } : { backgroundColor: "#e5e7eb" }
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function ProcurementProductsPage({
  defaultProductType,
}: {
  defaultProductType?: ProductType | "ALL";
}) {
  const [products, setProducts] = useState<ProcurementProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterSupplier, setFilterSupplier] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ProductType | "ALL">(
    defaultProductType ?? "ALL",
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProcurementProduct | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    categoryId: "",
    supplierId: "",
    thumbnailUrl: "",
    productType: "MATERIAL" as ProductType,
    isReturnable: false,
    isDeductible: true,
    deductionSplits: 1,
    colorsRaw: "",
    sizesRaw: "",
    variantQtys: {} as Record<string, number>,
    stockQty: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProcurementProduct | null>(
    null,
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{
    total: number;
    deletable: number;
    blocked: number;
  } | null>(null);

  const [pricesOpen, setPricesOpen] = useState(false);
  const [pricesProduct, setPricesProduct] = useState<ProcurementProduct | null>(
    null,
  );
  const [dialogPrices, setDialogPrices] = useState<SupplierPriceEntry[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceForm, setPriceForm] = useState({
    supplierId: "",
    price: "",
    uom: "",
    isActive: true,
  });
  const [savingPrice, setSavingPrice] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

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
      } catch {}
    }
    loadLookups();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
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
  }, [showInactive, filterCategory, filterSupplier]);

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
      thumbnailUrl: "",
      productType: activeTab === "PPE" ? "PPE" : "MATERIAL",
      isReturnable: false,
      isDeductible: true,
      deductionSplits: 1,
      colorsRaw: "",
      sizesRaw: "",
      variantQtys: {},
      stockQty: 0,
    });
    setDialogOpen(true);
  }

  function openEdit(p: ProcurementProduct) {
    setEditing(p);
    const variantQtys: Record<string, number> = {};
    for (const v of p.variantStocks ?? []) {
      variantQtys[variantKey(v.size ?? "", v.color ?? "")] = v.qty;
    }
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      description: p.description ?? "",
      categoryId: p.category?.id ?? "",
      supplierId: p.supplier?.id ?? "",
      thumbnailUrl: p.thumbnailUrl ?? "",
      productType: p.productType,
      isReturnable: p.isReturnable,
      isDeductible: p.isDeductible ?? true,
      deductionSplits: p.deductionSplits ?? 1,
      colorsRaw: p.colors.join(", "),
      sizesRaw: p.sizes.join(", "),
      variantQtys,
      stockQty: p.stockQty ?? 0,
    });
    setDialogOpen(true);
  }

  async function handleThumbnailUpload(file: File) {
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "procurement-products");
      const res = await fetch("/api/uploads/image", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleThumbnailUpload(file);
    e.target.value = "";
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleThumbnailUpload(file);
    else toast.error("Please drop an image file");
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const colors = form.colorsRaw
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const sizes = form.sizesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const variantStocks = buildVariantStocks(sizes, colors, form.variantQtys);
      const stockQty =
        variantStocks.length > 0
          ? variantStocks.reduce((s, v) => s + v.qty, 0)
          : form.stockQty;

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
          thumbnailUrl: form.thumbnailUrl || null,
          productType: form.productType,
          isReturnable: form.isReturnable,
          isDeductible: form.isDeductible,
          deductionSplits: form.deductionSplits,
          colors,
          sizes,
          variantStocks,
          stockQty,
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
        {
          method: "DELETE",
          credentials: "include",
        },
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

  function openPricesDialog(product: ProcurementProduct) {
    setPricesProduct(product);
    setDialogPrices(product.supplierPrices);
    setEditingPriceId(null);
    setPriceForm({ supplierId: "", price: "", uom: "", isActive: true });
    setPricesOpen(true);
  }

  async function reloadPrices(productId: string) {
    setLoadingPrices(true);
    try {
      const res = await fetch(
        `/api/app/admin/supplier-prices?productId=${productId}&includeInactive=true`,
        { credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok) return;
      const prices: SupplierPriceEntry[] = json.data;
      setDialogPrices(prices);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, supplierPrices: prices.filter((x) => x.isActive) }
            : p,
        ),
      );
      setPricesProduct((prev) =>
        prev?.id === productId
          ? { ...prev, supplierPrices: prices.filter((x) => x.isActive) }
          : prev,
      );
    } finally {
      setLoadingPrices(false);
    }
  }

  async function handleSavePrice() {
    if (!pricesProduct) return;
    if (!priceForm.supplierId && !editingPriceId) {
      toast.error("Supplier is required");
      return;
    }
    const priceNum = Number(priceForm.price);
    if (!priceForm.price || isNaN(priceNum) || priceNum < 0) {
      toast.error("Valid price is required");
      return;
    }
    setSavingPrice(true);
    try {
      let res: Response;
      if (editingPriceId) {
        res = await fetch(`/api/app/admin/supplier-prices/${editingPriceId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            price: priceNum,
            uom: priceForm.uom || null,
            isActive: priceForm.isActive,
          }),
        });
      } else {
        res = await fetch("/api/app/admin/supplier-prices", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierId: priceForm.supplierId,
            productId: pricesProduct.id,
            price: priceNum,
            uom: priceForm.uom || null,
          }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save price");
      toast.success(editingPriceId ? "Price updated" : "Price added");
      setEditingPriceId(null);
      setPriceForm({ supplierId: "", price: "", uom: "", isActive: true });
      await reloadPrices(pricesProduct.id);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save price");
    } finally {
      setSavingPrice(false);
    }
  }

  async function handleDeletePrice(priceId: string) {
    if (!pricesProduct) return;
    try {
      const res = await fetch(`/api/app/admin/supplier-prices/${priceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete price");
      toast.success("Price removed");
      await reloadPrices(pricesProduct.id);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete price");
    }
  }

  function startEditPrice(price: SupplierPriceEntry) {
    setEditingPriceId(price.id);
    setPriceForm({
      supplierId: price.supplierId,
      price: price.price.toString(),
      uom: price.uom ?? "",
      isActive: price.isActive,
    });
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: 0 };
    for (const p of products) {
      const t = p.productType ?? "MATERIAL";
      c[t] = (c[t] ?? 0) + 1;
      c.ALL += 1;
    }
    return c;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeTab !== "ALL" && (p.productType ?? "MATERIAL") !== activeTab)
        return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        p.colors.some((c) => c.toLowerCase().includes(term)) ||
        p.sizes.some((s) => s.toLowerCase().includes(term))
      );
    });
  }, [products, search, activeTab]);

  const isPpeTab = activeTab === "PPE";

  const columns: ColumnDef<ProcurementProduct>[] = [
    {
      id: "select",
      size: 40,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
    },
    {
      id: "thumbnail",
      size: 50,
      header: () => <span className="sr-only">Image</span>,
      cell: ({ row }) =>
        row.original.thumbnailUrl ? (
          <img
            src={row.original.thumbnailUrl}
            alt={row.original.name}
            className="h-9 w-9 rounded object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded bg-muted">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
        ),
      enableSorting: false,
    },
    ...(!isPpeTab
      ? [
          {
            id: "type",
            size: 110,
            header: () => <span>Type</span>,
            cell: ({ row }: any) => {
              const t = typeStyle(row.original.productType ?? "MATERIAL");
              return (
                <div className="flex flex-col gap-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${t.color}`}
                  >
                    {t.icon}
                    {t.label}
                  </span>
                  {row.original.isReturnable && (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      <RotateCcw className="h-3 w-3" />
                      Returnable
                    </span>
                  )}
                </div>
              );
            },
            enableSorting: false,
          } as ColumnDef<ProcurementProduct>,
        ]
      : []),
    {
      accessorKey: "name",
      header: ({ column }) => {
        const s = column.getIsSorted();
        return (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting(s === "asc")}
          >
            Name
            {s === "asc" ? (
              <ChevronUp className="h-4 w-4" />
            ) : s === "desc" ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="min-w-[160px] max-w-[260px]">
            <div className="font-medium leading-tight">{p.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {p.sku && (
                <span className="text-[10px] text-muted-foreground">
                  SKU: {p.sku}
                </span>
              )}
              {p.category && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4"
                >
                  {p.category.name}
                </Badge>
              )}
              {p.supplier && (
                <span className="text-[10px] text-muted-foreground">
                  {p.supplier.name}
                </span>
              )}
              {isPpeTab && !p.isDeductible && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  Non-deductible
                </span>
              )}
              {isPpeTab && p.isDeductible && p.deductionSplits === 2 && (
                <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  2× fortnights
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "sizesColors",
      header: () => <span>Sizes / Colors</span>,
      cell: ({ row }) => {
        const p = row.original;
        const variants = p.variantStocks ?? [];
        const sizes = p.sizes ?? [];
        const colors = p.colors ?? [];

        if (variants.length > 0) {
          const shown = variants.slice(0, 6);
          const rest = variants.length - shown.length;
          return (
            <div className="flex flex-wrap gap-1 max-w-[220px]">
              {shown.map((v) => {
                const parts = [v.color, v.size].filter(Boolean);
                const label = parts.join("-") || "Default";
                return (
                  <span
                    key={v.id}
                    className="inline-flex items-center rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium leading-tight whitespace-nowrap"
                  >
                    {label}
                    <span className="ml-1 text-muted-foreground">
                      ({v.qty})
                    </span>
                  </span>
                );
              })}
              {rest > 0 && (
                <span className="text-[10px] text-muted-foreground self-center">
                  +{rest} more
                </span>
              )}
            </div>
          );
        }

        if (sizes.length === 0 && colors.length === 0) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }

        const tags: string[] = [];
        if (sizes.length > 0 && colors.length > 0) {
          for (const c of colors.slice(0, 3))
            for (const s of sizes.slice(0, 3)) tags.push(`${c}-${s}`);
        } else {
          tags.push(...sizes.slice(0, 6), ...colors.slice(0, 6));
        }
        const totalCombos =
          Math.max(sizes.length, 1) * Math.max(colors.length, 1);
        const shown = tags.slice(0, 5);
        const rest = totalCombos - shown.length;
        return (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {shown.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium leading-tight whitespace-nowrap"
              >
                {tag}
              </span>
            ))}
            {rest > 0 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{rest} more
              </span>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "stockQty",
      header: () => <span>In Stock</span>,
      cell: ({ row }) => {
        const variants = row.original.variantStocks ?? [];
        if (variants.length === 0) {
          return (
            <Badge variant="secondary">{row.original.stockQty ?? 0}</Badge>
          );
        }
        const total = variants.reduce((s, v) => s + v.qty, 0);
        return (
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex flex-col items-start gap-0.5 text-left">
                <Badge variant="secondary" className="cursor-pointer">
                  {total}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {variants.length} variants
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="text-xs font-semibold mb-2 text-foreground">
                Stock by variant
              </div>
              <div className="space-y-1">
                {variants.map((v) => {
                  const parts = [v.color, v.size].filter(Boolean);
                  const label = parts.join("-") || "Default";
                  return (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {label}
                      </span>
                      <span className="text-[11px] font-semibold tabular-nums">
                        {v.qty}
                      </span>
                    </div>
                  );
                })}
                <div className="border-t border-border mt-2 pt-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium">Total</span>
                  <span className="text-[11px] font-bold tabular-nums">
                    {total}
                  </span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        );
      },
      enableSorting: false,
    },
    {
      id: "price",
      header: () => <span>Price</span>,
      cell: ({ row }) => {
        const p = row.original;
        if (p.productType === "PLANT")
          return (
            <span className="text-xs text-muted-foreground italic">
              No price
            </span>
          );
        if (p.productType === "PPE" && !p.isDeductible)
          return (
            <span className="text-xs text-muted-foreground italic">
              Non-deductible
            </span>
          );
        const prices = p.supplierPrices;
        if (!prices?.length)
          return <span className="text-muted-foreground">—</span>;
        const preferred = p.supplier?.id
          ? prices.find((sp) => sp.supplierId === p.supplier!.id)
          : null;
        const entry = preferred ?? prices[0];
        return (
          <div className="text-sm">
            <span className="font-medium">R {entry.price.toFixed(2)}</span>
            {entry.uom && (
              <span className="text-muted-foreground text-xs">
                {" "}
                / {entry.uom}
              </span>
            )}
            {prices.length > 1 && (
              <span className="ml-1 text-xs text-muted-foreground">
                (+{prices.length - 1})
              </span>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "status",
      header: () => <span>Status</span>,
      cell: ({ row }) => (
        <Badge
          variant={row.original.isActive ? "default" : "secondary"}
          className={
            row.original.isActive
              ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950/50 dark:text-green-300"
              : ""
          }
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
      enableSorting: false,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Manage prices"
            onClick={() => openPricesDialog(row.original)}
          >
            <DollarSign className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Edit product"
            onClick={() => openEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => setDeleteTarget(row.original)}
            disabled={row.original._count.orderItems > 0}
            title={
              row.original._count.orderItems > 0
                ? "Cannot delete: used in orders"
                : "Delete"
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data: filteredProducts,
    columns,
    state: { sorting, pagination, rowSelection },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const TABS: { value: ProductType | "ALL"; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "PPE", label: "PPE" },
    { value: "MATERIAL", label: "Materials" },
    { value: "PLANT", label: "Plant" },
    { value: "CONSUMABLE", label: "Consumables" },
    { value: "OTHER", label: "Other" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      {/* Type tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveTab(tab.value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {counts[tab.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, SKU, color…"
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
            <SelectTrigger className="w-44">
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
            <SelectTrigger className="w-44">
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
        <div className="flex items-center gap-2">
          {table.getSelectedRowModel().rows.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {table.getSelectedRowModel().rows.length} selected
            </Badge>
          )}
          <Button
            variant="destructive"
            size="sm"
            disabled={!table.getSelectedRowModel().rows.length}
            onClick={() => {
              const selected = table
                .getSelectedRowModel()
                .rows.map((r) => r.original);
              const deletable = selected.filter(
                (p) => p._count.orderItems === 0,
              );
              setBulkSummary({
                total: selected.length,
                deletable: deletable.length,
                blocked: selected.length - deletable.length,
              });
              setBulkDeleteOpen(true);
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete selected
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Table */}
      {!loading && filteredProducts.length === 0 ? (
        <div className="border border-dashed border-zinc-300 dark:border-zinc-700/50 bg-white/50 dark:bg-card/30 p-12 text-center rounded-lg">
          <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <h3 className="text-lg font-semibold">No products found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust your search or filters, or add a new product.
          </p>
        </div>
      ) : (
        <div className="border bg-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="border-collapse">
              <TableHeader className="bg-muted/60">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent">
                    {hg.headers.map((h) => (
                      <TableHead
                        key={h.id}
                        className="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                      >
                        {h.isPlaceholder
                          ? null
                          : flexRender(
                              h.column.columnDef.header,
                              h.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
            <div className="text-muted-foreground hidden text-sm lg:flex">
              Showing{" "}
              {filteredProducts.length === 0
                ? 0
                : table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                  1}{" "}
              to{" "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) *
                  table.getState().pagination.pageSize,
                filteredProducts.length,
              )}{" "}
              of {filteredProducts.length} products
            </div>
            <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-sm font-medium">Rows per page</span>
                <Select
                  value={String(table.getState().pagination.pageSize)}
                  onValueChange={(v) => table.setPageSize(Number(v))}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue
                      placeholder={table.getState().pagination.pageSize}
                    />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 25, 50, 100].map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-fit items-center justify-center text-sm font-medium">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount() || 1}
              </div>
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden h-8 w-8 lg:flex"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden h-8 w-8 lg:flex"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Product" : "Add Product"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update product details."
                : "Add a new product to the catalog."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Image */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Image (optional)</label>
              {form.thumbnailUrl ? (
                <div className="rounded border-2 border-dashed border-green-500 bg-green-50/30 dark:bg-green-950/20 p-3">
                  <div className="flex items-end gap-3">
                    <img
                      src={form.thumbnailUrl}
                      alt="Thumbnail"
                      className="h-20 w-20 rounded object-cover shadow-sm"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">
                        ✓ Image uploaded
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, thumbnailUrl: "" })}
                      className="rounded bg-white p-1.5 hover:bg-red-50 text-red-600 dark:bg-zinc-800 dark:hover:bg-red-950/30 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative rounded border-2 border-dashed transition-colors p-4 text-center cursor-pointer ${
                    dragActive
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                      : "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/30 hover:border-blue-400"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-950/50">
                      <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm font-medium">
                      {uploading
                        ? "Uploading…"
                        : "Click to upload or drag image"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG up to 5MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Type + Returnable */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Product Type *</label>
                <Select
                  value={form.productType}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      productType: v as ProductType,
                      isReturnable: v === "PLANT" ? true : form.isReturnable,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          {t.icon}
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-end space-y-1">
                <label className="text-sm font-medium">Returnable</label>
                <label className="flex items-center gap-2 cursor-pointer rounded border border-border px-3 py-2 hover:bg-muted/40">
                  <Checkbox
                    checked={form.isReturnable}
                    onCheckedChange={(v) =>
                      setForm({ ...form, isReturnable: !!v })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    Must be returned to office
                  </span>
                </label>
              </div>
            </div>

            {/* PPE-specific: deductible + split */}
            {form.productType === "PPE" && (
              <div className="rounded border border-border bg-muted/20 p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Deduction Settings
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.isDeductible}
                    onCheckedChange={(v) =>
                      setForm({ ...form, isDeductible: !!v })
                    }
                  />
                  <span className="text-sm">Deductible from pay</span>
                </label>
                {form.isDeductible && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Default deduction split
                    </label>
                    <Select
                      value={String(form.deductionSplits)}
                      onValueChange={(v) =>
                        setForm({ ...form, deductionSplits: Number(v) })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">
                          Full amount in 1 fortnight
                        </SelectItem>
                        <SelectItem value="2">
                          Half per fortnight (split over 2)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Name + SKU */}
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

            {/* Category + Supplier */}
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

            {/* Colors */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Colors{" "}
                <span className="text-muted-foreground font-normal">
                  (comma-separated, optional)
                </span>
              </label>
              <Input
                value={form.colorsRaw}
                onChange={(e) =>
                  setForm({ ...form, colorsRaw: e.target.value })
                }
                placeholder="e.g. White, Light Grey, Sandstone, #F5CBA7"
              />
              {form.colorsRaw && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {form.colorsRaw
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean)
                    .map((c) => (
                      <div
                        key={c}
                        className="flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-xs"
                      >
                        <ColorDot color={c} />
                        {c}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Sizes */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Sizes{" "}
                <span className="text-muted-foreground font-normal">
                  (comma-separated, optional)
                </span>
              </label>
              <Input
                value={form.sizesRaw}
                onChange={(e) => setForm({ ...form, sizesRaw: e.target.value })}
                placeholder="e.g. S, M, L, XL, 2XL, Size 8, Size 9"
              />
              {form.sizesRaw && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {form.sizesRaw
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center rounded border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium"
                      >
                        {s}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Description */}
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

            {/* Stock Quantities */}
            {(() => {
              const sizes = form.sizesRaw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              const colors = form.colorsRaw
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean);
              const hasVariants = sizes.length > 0 || colors.length > 0;

              const getQty = (size: string, color: string) =>
                form.variantQtys[variantKey(size, color)] ?? 0;
              const setQty = (size: string, color: string, qty: number) =>
                setForm((f) => ({
                  ...f,
                  variantQtys: {
                    ...f.variantQtys,
                    [variantKey(size, color)]: Math.max(0, qty),
                  },
                }));

              if (!hasVariants) {
                return (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Stock Quantity
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={form.stockQty}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          stockQty: Math.max(0, Number(e.target.value)),
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                );
              }

              if (sizes.length > 0 && colors.length > 0) {
                const total = sizes
                  .flatMap((s) => colors.map((c) => getQty(s, c)))
                  .reduce((a, b) => a + b, 0);
                return (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Stock per Size &amp; Color
                      <span className="ml-2 font-normal text-muted-foreground text-xs">
                        total: {total}
                      </span>
                    </label>
                    <div className="overflow-x-auto rounded border border-border">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-muted/60">
                            <th className="border-b border-r border-border px-2 py-1.5 text-left font-medium text-muted-foreground">
                              Size / Color
                            </th>
                            {colors.map((color) => (
                              <th
                                key={color}
                                className="border-b border-r border-border px-2 py-1.5 text-center font-medium last:border-r-0"
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <ColorDot color={color} />
                                  {color}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sizes.map((size, si) => (
                            <tr
                              key={size}
                              className={si % 2 === 0 ? "" : "bg-muted/20"}
                            >
                              <td className="border-b border-r border-border px-2 py-1 font-medium last:border-b-0">
                                {size}
                              </td>
                              {colors.map((color) => (
                                <td
                                  key={color}
                                  className="border-b border-r border-border px-1 py-1 last:border-r-0 last:border-b-0"
                                >
                                  <Input
                                    type="number"
                                    min={0}
                                    value={getQty(size, color)}
                                    onChange={(e) =>
                                      setQty(
                                        size,
                                        color,
                                        Number(e.target.value),
                                      )
                                    }
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
                );
              }

              if (sizes.length > 0) {
                const total = sizes
                  .map((s) => getQty(s, ""))
                  .reduce((a, b) => a + b, 0);
                return (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Stock per Size
                      <span className="ml-2 font-normal text-muted-foreground text-xs">
                        total: {total}
                      </span>
                    </label>
                    <div className="space-y-1">
                      {sizes.map((size) => (
                        <div key={size} className="flex items-center gap-3">
                          <span className="w-20 shrink-0 rounded border border-border bg-muted/40 px-2 py-1 text-center text-xs font-medium">
                            {size}
                          </span>
                          <Input
                            type="number"
                            min={0}
                            value={getQty(size, "")}
                            onChange={(e) =>
                              setQty(size, "", Number(e.target.value))
                            }
                            className="h-8 w-24 text-xs"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              const total = colors
                .map((c) => getQty("", c))
                .reduce((a, b) => a + b, 0);
              return (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Stock per Color
                    <span className="ml-2 font-normal text-muted-foreground text-xs">
                      total: {total}
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
                          type="number"
                          min={0}
                          value={getQty("", color)}
                          onChange={(e) =>
                            setQty("", color, Number(e.target.value))
                          }
                          className="h-8 w-24 text-xs"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialogs */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Product"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
      <ConfirmationDialog
        open={bulkDeleteOpen}
        onOpenChange={(o) => {
          if (!o) {
            setBulkDeleteOpen(false);
            setBulkSummary(null);
          }
        }}
        title="Delete Selected Products"
        description={
          bulkSummary
            ? `You selected ${bulkSummary.total} product(s). ${bulkSummary.deletable} will be deleted, ${bulkSummary.blocked} in use will be skipped.`
            : "Delete selected products? Products used in orders will be skipped."
        }
        onConfirm={async () => {
          const selected = table
            .getSelectedRowModel()
            .rows.map((r) => r.original);
          const deletable = selected.filter((p) => p._count.orderItems === 0);
          if (!deletable.length) {
            toast.error("All selected products are used in orders.");
            setBulkDeleteOpen(false);
            return;
          }
          setBulkDeleting(true);
          try {
            for (const p of deletable) {
              const res = await fetch(
                `/api/app/admin/procurement-products/${p.id}`,
                { method: "DELETE", credentials: "include" },
              );
              if (!res.ok) {
                const j = await res.json().catch(() => null);
                throw new Error(j?.error ?? "Failed to delete");
              }
            }
            toast.success(`Deleted ${deletable.length} product(s)`);
            setRowSelection({});
            setBulkDeleteOpen(false);
            load();
          } catch (e: any) {
            toast.error(e?.message || "Failed to delete selected products");
          } finally {
            setBulkDeleting(false);
          }
        }}
        confirmText={bulkDeleting ? "Deleting…" : "Delete selected"}
        variant="destructive"
      />

      {/* Prices Dialog */}
      <Dialog
        open={pricesOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPricesOpen(false);
            setEditingPriceId(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prices — {pricesProduct?.name}</DialogTitle>
            <DialogDescription>
              Manage supplier prices for this product.
            </DialogDescription>
          </DialogHeader>

          {/* Price list */}
          {loadingPrices ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : dialogPrices.length === 0 ? (
            <div className="rounded border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No prices yet — add one below.
            </div>
          ) : (
            <div className="rounded border border-border overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold">
                      Supplier
                    </th>
                    <th className="border-b border-border px-3 py-2 text-right text-xs font-semibold">
                      Price
                    </th>
                    <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold">
                      UOM
                    </th>
                    <th className="border-b border-border px-2 py-2 text-center text-xs font-semibold">
                      Active
                    </th>
                    <th className="border-b border-border px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {dialogPrices.map((price, i) => (
                    <tr
                      key={price.id}
                      className={`${i % 2 !== 0 ? "bg-muted/20" : ""} ${editingPriceId === price.id ? "ring-1 ring-inset ring-primary/30" : ""}`}
                    >
                      <td className="border-b border-border px-3 py-2 text-xs last:border-b-0">
                        {price.supplier.name}
                      </td>
                      <td className="border-b border-border px-3 py-2 text-xs text-right font-medium tabular-nums last:border-b-0">
                        R {price.price.toFixed(2)}
                      </td>
                      <td className="border-b border-border px-3 py-2 text-xs text-muted-foreground last:border-b-0">
                        {price.uom || "—"}
                      </td>
                      <td className="border-b border-border px-2 py-2 text-center last:border-b-0">
                        <span
                          className={`inline-flex h-2 w-2 rounded-full ${price.isActive ? "bg-green-500" : "bg-zinc-400"}`}
                        />
                      </td>
                      <td className="border-b border-border px-2 py-2 last:border-b-0">
                        <div className="flex items-center gap-0.5 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Edit"
                            onClick={() => startEditPrice(price)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            title="Remove"
                            onClick={() => handleDeletePrice(price.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add / Edit form */}
          <div className="rounded border border-border bg-muted/20 p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {editingPriceId ? "Edit Price" : "Add Price"}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Supplier{" "}
                  {!editingPriceId && (
                    <span className="text-destructive">*</span>
                  )}
                </label>
                <Select
                  value={priceForm.supplierId || "NONE"}
                  onValueChange={(v) =>
                    setPriceForm({
                      ...priceForm,
                      supplierId: v === "NONE" ? "" : v,
                    })
                  }
                  disabled={!!editingPriceId}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Select supplier…</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Price (R) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceForm.price}
                  onChange={(e) =>
                    setPriceForm({ ...priceForm, price: e.target.value })
                  }
                  className="h-8 text-xs"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Unit of Measure</label>
                <Select
                  value={priceForm.uom || "NONE"}
                  onValueChange={(v) =>
                    setPriceForm({ ...priceForm, uom: v === "NONE" ? "" : v })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {PRODUCT_UOMS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editingPriceId && (
                <div className="flex items-end">
                  <label className="flex w-full cursor-pointer items-center gap-2 rounded border border-border px-3 py-2 hover:bg-muted/40">
                    <Checkbox
                      checked={priceForm.isActive}
                      onCheckedChange={(v) =>
                        setPriceForm({ ...priceForm, isActive: !!v })
                      }
                    />
                    <span className="text-xs">Active</span>
                  </label>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              {editingPriceId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditingPriceId(null);
                    setPriceForm({
                      supplierId: "",
                      price: "",
                      uom: "",
                      isActive: true,
                    });
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSavePrice}
                disabled={savingPrice}
              >
                {savingPrice
                  ? "Saving…"
                  : editingPriceId
                    ? "Update Price"
                    : "Add Price"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPricesOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
