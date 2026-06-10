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
  DollarSign,
  Merge,
  MoreVertical,
  Wand2,
  Download,
  Loader2,
} from "lucide-react";
import { parseBuildSmartProduct } from "@/lib/product-color-parser";
import {
  isNumericCostCode,
  normalizeBuildSmartProductCode,
} from "@/lib/procurement/buildsmartProductCodes";
import { Workbook } from "exceljs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}[] = [
  {
    value: "MATERIAL",
    label: "Paints",
    icon: <Layers className="h-3.5 w-3.5" />,
  },
  {
    value: "PPE",
    label: "PPE",
    icon: <Package className="h-3.5 w-3.5" />,
  },
  {
    value: "CONSUMABLE",
    label: "Consumable",
    icon: <Package className="h-3.5 w-3.5" />,
  },
  {
    value: "OTHER",
    label: "Other",
    icon: <MoreHorizontal className="h-3.5 w-3.5" />,
  },
];

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
  createdAt: any;
  updatedAt: any;
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
  supplierId: supplierIdProp,
}: {
  defaultProductType?: ProductType | "ALL";
  supplierId?: string;
}) {
  const showTypeTabs = !defaultProductType || defaultProductType === "ALL";
  const [products, setProducts] = useState<ProcurementProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterSupplier, setFilterSupplier] = useState<string>(
    supplierIdProp ?? "",
  );
  const [activeTab, setActiveTab] = useState<ProductType | "ALL">(
    defaultProductType ?? "ALL",
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    setFilterSupplier(supplierIdProp ?? "");
  }, [supplierIdProp]);

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
  const [suppliersProduct, setSuppliersProduct] =
    useState<ProcurementProduct | null>(null);
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

  const [fixingNames, setFixingNames] = useState(false);
  const [fixNamesProgress, setFixNamesProgress] = useState<{
    done: number;
    total: number;
    message: string;
    phase: string;
  } | null>(null);
  const [exporting, setExporting] = useState(false);

  // merge state
  const [mergeSource, setMergeSource] = useState<ProcurementProduct | null>(
    null,
  );
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeSaving, setMergeSaving] = useState(false);

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
      // If this page is specifically the paints/preparations view, request materials-only
      if (supplierIdProp !== undefined || defaultProductType === "MATERIAL") {
        params.set("productType", "MATERIAL");
      } else if (defaultProductType && defaultProductType !== "ALL") {
        params.set("productType", defaultProductType);
      }
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
  }, [showInactive, filterCategory, filterSupplier, defaultProductType]);

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
    // populate inline prices editor when editing a product
    setPricesProduct(p);
    setDialogPrices(p.supplierPrices || []);
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

  async function handleMerge() {
    if (!mergeSource || !mergeTargetId) return;
    setMergeSaving(true);
    try {
      const res = await fetch(
        `/api/app/admin/procurement-products/${mergeSource.id}/merge`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetId: mergeTargetId }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to merge");
      toast.success(`Merged "${mergeSource.name}" into target`);
      setMergeSource(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to merge");
    } finally {
      setMergeSaving(false);
    }
  }

  async function handleFixNames() {
    setFixingNames(true);
    setFixNamesProgress({
      phase: "start",
      done: 0,
      total: 1,
      message: "Starting cleanup...",
    });
    try {
      const res = await fetch(
        "/api/admin/buildsmart/cleanup-product-names?stream=true",
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const errorPayload = await res.json().catch(() => null);
        throw new Error(errorPayload?.error ?? "Failed to fix names");
      }
      if (!res.body) throw new Error("No progress stream returned");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let summary: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | {
                type: "progress";
                phase: string;
                done: number;
                total: number;
                message: string;
              }
            | { type: "done"; summary: any }
            | { type: "error"; error: string };

          if (event.type === "progress") {
            setFixNamesProgress({
              phase: event.phase,
              done: event.done,
              total: event.total,
              message: event.message,
            });
          } else if (event.type === "done") {
            summary = event.summary;
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }

      const json = summary ?? {};
      toast.success(
        `Fixed ${json.nameUpdated ?? 0} name(s), cleared ${json.skuCleared ?? 0} cost code(s), merged ${json.merged ?? 0} duplicate(s)`,
      );
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to fix product names");
    } finally {
      setFixingNames(false);
      setFixNamesProgress(null);
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
      const productType = (p.productType ?? "MATERIAL") as ProductType;
      if (activeTab !== "ALL" && productType !== activeTab) return false;
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
  const isPaintsTab = defaultProductType === "MATERIAL";

  const exportProductsToExcel = useCallback(async () => {
    setExporting(true);
    try {
      const workbook = new Workbook();
      const sheet = workbook.addWorksheet("Procurement Products");
      sheet.columns = [
        { header: "Name", key: "name", width: 40 },
        { header: "SKU", key: "sku", width: 18 },
        { header: "Description", key: "description", width: 40 },
        { header: "Type", key: "type", width: 14 },
        { header: "Category", key: "category", width: 24 },
        { header: "Supplier", key: "supplier", width: 24 },
        { header: "Active", key: "active", width: 10 },
        { header: "Returnable", key: "returnable", width: 12 },
        { header: "Deductible", key: "deductible", width: 12 },
        { header: "Deduction splits", key: "deductionSplits", width: 16 },
        { header: "Colors", key: "colors", width: 24 },
        { header: "Sizes", key: "sizes", width: 24 },
        { header: "Stock qty", key: "stockQty", width: 12 },
        { header: "Order items", key: "orderItems", width: 12 },
        { header: "Prices", key: "prices", width: 60 },
      ];

      filteredProducts.forEach((product) => {
        sheet.addRow({
          name: product.name,
          sku: product.sku ?? "",
          description: product.description ?? "",
          type: product.productType,
          category: product.category?.name ?? "",
          supplier: product.supplier?.name ?? "",
          active: product.isActive ? "Yes" : "No",
          returnable: product.isReturnable ? "Yes" : "No",
          deductible: product.isDeductible ? "Yes" : "No",
          deductionSplits: product.deductionSplits,
          colors: product.colors.join(", "),
          sizes: product.sizes.join(", "),
          stockQty: product.stockQty,
          orderItems: product._count.orderItems,
          prices: product.supplierPrices
            .map(
              (price) =>
                `${price.supplier.name}: ${price.price}${price.uom ? ` ${price.uom}` : ""}`,
            )
            .join("; "),
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `procurement-products-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to export procurement products to Excel.");
    } finally {
      setExporting(false);
    }
  }, [filteredProducts]);

  const exportProductsToJson = useCallback(async () => {
    setExporting(true);
    try {
      // Export complete data structure with all IDs and relationships
      const exportData = {
        exportedAt: new Date().toISOString(),
        products: filteredProducts.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          description: product.description,
          productType: product.productType,
          isActive: product.isActive,
          isReturnable: product.isReturnable,
          isDeductible: product.isDeductible,
          deductionSplits: product.deductionSplits,
          colors: product.colors,
          sizes: product.sizes,
          stockQty: product.stockQty,
          thumbnailUrl: product.thumbnailUrl,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
          category: product.category
            ? {
                id: product.category.id,
                name: product.category.name,
              }
            : null,
          supplier: product.supplier
            ? {
                id: product.supplier.id,
                name: product.supplier.name,
              }
            : null,
          variantStocks:
            product.variantStocks?.map((variant) => ({
              id: variant.id,
              size: variant.size,
              color: variant.color,
              qty: variant.qty,
            })) || [],
          supplierPrices:
            product.supplierPrices?.map((price) => ({
              id: price.id,
              supplierId: price.supplierId,
              price: price.price,
              uom: price.uom,
              unitSize: price.unitSize,
              isActive: price.isActive,
              supplier: {
                id: price.supplier.id,
                name: price.supplier.name,
              },
            })) || [],
          _count: product._count,
        })),
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `procurement-products-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success("JSON export completed successfully");
    } catch (error) {
      toast.error("Failed to export procurement products to JSON.");
    } finally {
      setExporting(false);
    }
  }, [filteredProducts]);

  function getProductSuppliers(product: ProcurementProduct) {
    const supplierMap = new Map<
      string,
      {
        id: string;
        name: string;
        prices: SupplierPriceEntry[];
        isDefault: boolean;
      }
    >();

    if (product.supplier) {
      supplierMap.set(product.supplier.id, {
        ...product.supplier,
        prices: [],
        isDefault: true,
      });
    }

    for (const price of product.supplierPrices ?? []) {
      const existing = supplierMap.get(price.supplier.id);
      if (existing) {
        existing.prices.push(price);
        existing.isDefault =
          existing.isDefault || product.supplier?.id === price.supplier.id;
      } else {
        supplierMap.set(price.supplier.id, {
          ...price.supplier,
          prices: [price],
          isDefault: product.supplier?.id === price.supplier.id,
        });
      }
    }

    return Array.from(supplierMap.values()).sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

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
      size: 96,
      header: () => <span>Code</span>,
      cell: ({ row }) => {
        const p = row.original;
        const parsed = parseBuildSmartProduct(p.name);
        const rawDisplaySku = p.sku ?? parsed.sku;
        const displaySku =
          rawDisplaySku && !isNumericCostCode(rawDisplaySku)
            ? rawDisplaySku
            : null;

        return (
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {displaySku ?? "-"}
          </span>
        );
      },
      enableSorting: false,
    },
    // Type column — hidden on locked tabs (Paints/Tools)
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
        const displayName = p.name;
        return (
          <div className="w-full">
            <div
              className="font-medium leading-tight break-words"
              title={displayName}
            >
              {displayName}
            </div>
            {/* SKU/code is shown in the separate 'Code' column — omit duplicate under name */}
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
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
    // Price column — for Paints shows all supplier prices grouped by size (UOM)
    {
      id: "suppliers",
      size: 105,
      header: () => <span className="text-center w-full block">Suppliers</span>,
      cell: ({ row }) => {
        const productSuppliers = getProductSuppliers(row.original);
        const supplierCount = productSuppliers.length;

        if (supplierCount === 0) {
          return (
            <div className="text-center">
              <span className="text-sm text-muted-foreground">0</span>
            </div>
          );
        }

        return (
          <div className="text-center">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setSuppliersProduct(row.original)}
              title="View suppliers"
            >
              {supplierCount}
            </Button>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: "price",
      size: 240,
      header: () => (
        <span className="text-left w-full block">
          {isPaintsTab ? "Prices by Size" : "Price"}
        </span>
      ),
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

        // API already filters to active prices; use directly
        const allPrices = p.supplierPrices ?? [];
        if (!allPrices.length)
          return <span className="text-muted-foreground text-sm">—</span>;

        const fmtPrice = (v: number | null | undefined) =>
          Number(v || 0).toLocaleString("en-ZA", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        const validUom = (uom: string | null | undefined) =>
          uom && uom !== "null" && uom !== "undefined" ? uom : null;

        if (isPaintsTab) {
          if (allPrices.length <= 2) {
            return (
              <div className="flex items-center justify-start gap-4 whitespace-nowrap">
                {allPrices.map((sp) => {
                  const uom = validUom(sp.uom);
                  const sizeLabel = uom
                    ? sp.unitSize != null
                      ? `${sp.unitSize}${uom}`
                      : uom
                    : null;
                  return (
                    <div
                      key={sp.id}
                      className="inline-flex items-center gap-1 text-sm"
                    >
                      {sizeLabel ? (
                        <span className="text-xs text-muted-foreground">
                          {sizeLabel} -
                        </span>
                      ) : null}
                      <span className="font-semibold tabular-nums">
                        R {fmtPrice(sp.price)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          }

          return (
            <div className="flex justify-start">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => openPricesDialog(p)}
              >
                View prices ({allPrices.length})
              </Button>
            </div>
          );
        }

        // Default: show preferred price
        const preferred = p.supplier?.id
          ? allPrices.find((sp) => sp.supplierId === p.supplier!.id)
          : null;
        const entry = preferred ?? allPrices[0];
        return (
          <div className="text-sm">
            <span className="font-medium">
              R{" "}
              {entry.price.toLocaleString("en-ZA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            {entry.uom && (
              <span className="text-muted-foreground text-xs ml-0.5">
                {`/ ${entry.unitSize != null ? `${entry.unitSize}${entry.uom}` : entry.uom}`}
              </span>
            )}
            {allPrices.length > 1 && (
              <span className="ml-1 text-xs text-muted-foreground">
                (+{allPrices.length - 1})
              </span>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    // Stock column — hidden on Paints (paints are not stocked)
    {
      id: "actions",
      size: 40,
      header: () => <span>Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => openPricesDialog(row.original)}>
              <DollarSign className="mr-2 h-4 w-4" />
              Manage Prices
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setMergeSource(row.original);
                setMergeTargetId("");
                setMergeSearch("");
              }}
            >
              <Merge className="mr-2 h-4 w-4" />
              Merge into…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={row.original._count.orderItems > 0}
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {row.original._count.orderItems > 0 ? "In use" : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
    { value: "MATERIAL", label: "Paints" },
    { value: "CONSUMABLE", label: "Consumables" },
    { value: "OTHER", label: "Other" },
  ];

  const fixNamesPercent = fixNamesProgress
    ? fixNamesProgress.total > 0
      ? Math.min(
          100,
          Math.round((fixNamesProgress.done / fixNamesProgress.total) * 100),
        )
      : 100
    : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="space-y-3">
          <div className="hidden">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight">
                  {supplierIdProp !== undefined
                    ? "Supplier Products"
                    : "Procurement Products"}
                </h2>
                <Badge variant="secondary" className="h-5 rounded-full px-2">
                  {filteredProducts.length}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage catalogue items, supplier pricing, stock, and deductions.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
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

          {showTypeTabs && supplierIdProp === undefined && (
            <div className="flex flex-wrap items-center gap-1 rounded-md bg-muted/40 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.value);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                  className={`flex h-8 items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors ${
                    activeTab === tab.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {counts[tab.value] ?? 0}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_190px_170px_auto]">
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, SKU, color…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                  className="h-9 pl-9"
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
                value={filterCategory || "ALL"}
                onValueChange={(v) => {
                  setFilterCategory(v === "ALL" ? "" : v);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              >
                <SelectTrigger className="h-9 w-full">
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
              {supplierIdProp === undefined ? (
                <Select
                  value={filterSupplier || "ALL"}
                  onValueChange={(v) => {
                    setFilterSupplier(v === "ALL" ? "" : v);
                    setPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                >
                  <SelectTrigger className="h-9 w-full">
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
              ) : null}
              <Button
                variant="outline"
                size="icon"
                onClick={load}
                className="h-9 w-9"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="hidden">
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={handleFixNames}
                disabled={fixingNames}
                title="Strip embedded SKUs, pack numbers, and size suffixes from product names"
              >
                {fixingNames ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-1.5 h-4 w-4" />
                )}
                {fixingNames ? <span>Fixing…</span> : <span>Fix Names</span>}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={exportProductsToExcel}
                disabled={exporting || filteredProducts.length === 0}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {exporting ? "Exporting…" : "Export Excel"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={exportProductsToJson}
                disabled={exporting || filteredProducts.length === 0}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {exporting ? "Exporting…" : "Export JSON"}
              </Button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {table.getSelectedRowModel().rows.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-9"
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
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete {table.getSelectedRowModel().rows.length}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <MoreHorizontal className="mr-1.5 h-4 w-4" />
                    Tools
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={handleFixNames}
                    disabled={fixingNames}
                  >
                    {fixingNames ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    Fix Names
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={exportProductsToExcel}
                    disabled={exporting || filteredProducts.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={exportProductsToJson}
                    disabled={exporting || filteredProducts.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={openCreate} size="sm" className="h-9">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Product
              </Button>
            </div>
          </div>
        </div>
      </div>

      {fixNamesProgress && (
        <div className="rounded border border-border bg-muted/30 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-muted-foreground">
              {fixNamesProgress.message}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {fixNamesProgress.done}
              {" / "}
              {fixNamesProgress.total}
              <span className="ml-2 text-primary">{fixNamesPercent}%</span>
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${fixNamesPercent}%` }}
            />
          </div>
        </div>
      )}

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
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent">
                    {hg.headers.map((h) => (
                      <TableHead
                        key={h.id}
                        className="h-8 border-b border-r border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0"
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
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      className="border-b border-border/70 transition-colors last:border-b-0 hover:bg-muted/35 data-[state=selected]:bg-primary/5"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="border-r border-border px-3 py-1.5 align-middle last:border-r-0"
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
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
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
            <div className="space-y-1">
              <label className="text-sm font-medium">Product Type *</label>
              <Select
                value={form.productType}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    productType: v as ProductType,
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

            {/* Description removed per UI preference */}

            {/* Stock per size removed per UI preference */}
          </div>
          {/* Prices inline editor (when editing) */}
          {editing && (
            <div className="space-y-2 mt-3">
              <div className="text-sm font-medium">Prices</div>
              <div className="space-y-2">
                {dialogPrices.map((dp) => (
                  <div
                    key={dp.id}
                    className="flex items-center justify-between gap-3 rounded border border-border p-2"
                  >
                    <div className="text-sm">
                      <div className="font-medium">{dp.supplier.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {dp.unitSize != null && dp.uom
                          ? `${dp.unitSize}${dp.uom} - `
                          : ""}
                        R{" "}
                        {Number(dp.price).toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingPriceId(dp.id);
                          setPriceForm({
                            supplierId: dp.supplier.id,
                            price: String(dp.price),
                            uom: dp.uom ?? "",
                            isActive: dp.isActive,
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePrice(dp.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-3 gap-2 items-end">
                  <Select
                    value={priceForm.supplierId || ""}
                    onValueChange={(v) =>
                      setPriceForm({ ...priceForm, supplierId: v })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    value={priceForm.price}
                    onChange={(e) =>
                      setPriceForm({ ...priceForm, price: e.target.value })
                    }
                    placeholder="Price"
                    className="h-8"
                  />

                  <div className="flex items-center gap-2">
                    <Input
                      value={priceForm.uom}
                      onChange={(e) =>
                        setPriceForm({ ...priceForm, uom: e.target.value })
                      }
                      placeholder="UOM"
                      className="h-8"
                    />
                    <Button onClick={handleSavePrice} disabled={savingPrice}>
                      {editingPriceId ? "Update" : "Add"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

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

      {/* Suppliers Dialog */}
      <Dialog
        open={!!suppliersProduct}
        onOpenChange={(o) => {
          if (!o) setSuppliersProduct(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Suppliers</DialogTitle>
            <DialogDescription className="truncate">
              {suppliersProduct
                ? parseBuildSmartProduct(suppliersProduct.name).cleanName
                : ""}
            </DialogDescription>
          </DialogHeader>

          {suppliersProduct &&
            (() => {
              const productSuppliers = getProductSuppliers(suppliersProduct);
              const fmtPrice = (v: number | null | undefined) =>
                Number(v || 0).toLocaleString("en-ZA", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });
              const sizeLabel = (price: SupplierPriceEntry) =>
                price.uom
                  ? price.unitSize != null
                    ? `${price.unitSize}${price.uom}`
                    : price.uom
                  : null;

              if (productSuppliers.length === 0) {
                return (
                  <div className="rounded border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    No suppliers linked to this product.
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {productSuppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="rounded border border-border p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className="truncate text-sm font-semibold"
                            title={supplier.name}
                          >
                            {supplier.name}
                          </div>
                          {supplier.isDefault && (
                            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Default supplier
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {supplier.prices.length} price
                          {supplier.prices.length === 1 ? "" : "s"}
                        </Badge>
                      </div>

                      {supplier.prices.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {supplier.prices.map((price) => (
                            <div
                              key={price.id}
                              className="flex items-center justify-between gap-3 text-xs"
                            >
                              <span className="text-muted-foreground">
                                {sizeLabel(price) ?? "No UOM"}
                              </span>
                              <span className="font-semibold tabular-nums">
                                R {fmtPrice(price.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground">
                          No active prices captured.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSuppliersProduct(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <table className="w-full text-sm border-collapse border border-border">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="border-b border-x border-border px-3 py-2 text-left text-xs font-semibold">
                      Supplier
                    </th>
                    <th className="border-b border-x border-border px-3 py-2 text-left text-xs font-semibold">
                      Price
                    </th>
                    <th className="border-b border-x border-border px-3 py-2 text-left text-xs font-semibold">
                      UOM
                    </th>
                    <th className="border-b border-x border-border px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {dialogPrices.map((price, i) => (
                    <tr
                      key={price.id}
                      className={`${i % 2 !== 0 ? "bg-muted/20" : ""} ${editingPriceId === price.id ? "ring-1 ring-inset ring-primary/30" : ""}`}
                    >
                      <td className="border-b border-x border-border px-3 py-2 text-xs last:border-b-0">
                        {price.supplier.name}
                      </td>
                      <td className="border-b border-x border-border px-3 py-2 text-xs font-medium tabular-nums last:border-b-0">
                        R {price.price.toFixed(2)}
                      </td>
                      <td className="border-b border-x border-border px-3 py-2 text-xs text-muted-foreground last:border-b-0">
                        {price.unitSize != null
                          ? `${price.unitSize}${price.uom ?? ""}`
                          : price.uom || "—"}
                      </td>
                      <td className="border-b border-x border-border px-2 py-2 last:border-b-0">
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

      {/* Merge Dialog */}
      <Dialog
        open={!!mergeSource}
        onOpenChange={(o) => {
          if (!o) setMergeSource(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge Product</DialogTitle>
            <DialogDescription>
              The source product will be deleted and all its data merged into
              the target.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded border bg-muted/30 p-3 text-sm">
              <div className="text-xs text-muted-foreground mb-0.5">
                Merging (will be deleted)
              </div>
              <div className="font-medium">{mergeSource?.name}</div>
              {mergeSource?.sku && (
                <div className="text-xs text-muted-foreground">
                  SKU: {mergeSource.sku}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {mergeSource?.stockQty ?? 0} in stock
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Merge into</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search target product…"
                  value={mergeSearch}
                  onChange={(e) => {
                    setMergeSearch(e.target.value);
                    setMergeTargetId("");
                  }}
                  className="pl-9"
                />
              </div>
              <div className="max-h-52 overflow-y-auto rounded border divide-y text-sm">
                {(() => {
                  const opts = products.filter(
                    (p) =>
                      p.id !== mergeSource?.id &&
                      (mergeSearch === "" ||
                        p.name
                          .toLowerCase()
                          .includes(mergeSearch.toLowerCase()) ||
                        (p.sku ?? "")
                          .toLowerCase()
                          .includes(mergeSearch.toLowerCase())),
                  );
                  if (opts.length === 0)
                    return (
                      <div className="py-4 text-center text-muted-foreground text-xs">
                        No products found
                      </div>
                    );
                  return opts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setMergeTargetId(p.id)}
                      className={`w-full text-left px-3 py-2 transition-colors ${
                        mergeTargetId === p.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku ? `SKU: ${p.sku} · ` : ""}
                        {p.stockQty} in stock
                      </div>
                    </button>
                  ));
                })()}
              </div>
            </div>

            {mergeTargetId &&
              (() => {
                const tgt = products.find((p) => p.id === mergeTargetId);
                return tgt ? (
                  <div className="rounded border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <div className="font-semibold">After merge:</div>
                    <div>
                      <span className="font-medium">{tgt.name}</span> will have{" "}
                      <span className="font-medium">
                        {(tgt.stockQty ?? 0) + (mergeSource?.stockQty ?? 0)}
                      </span>{" "}
                      in stock.
                    </div>
                    <div className="font-medium mt-1">
                      "{mergeSource?.name}" will be permanently deleted.
                    </div>
                  </div>
                ) : null;
              })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeSource(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleMerge}
              disabled={mergeSaving || !mergeTargetId}
            >
              {mergeSaving ? "Merging…" : "Merge & Delete Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
