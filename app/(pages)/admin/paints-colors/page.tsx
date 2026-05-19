"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Search,
  X,
  RotateCw,
  Palette,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  MoreHorizontal,
  Merge,
  MoreVertical,
  Filter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "@tanstack/react-table";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

import type { ColorBaseType } from "@/generated/prisma/client";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type ProductColorVariant = {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    category: { id: string; name: string } | null;
  };
  colorName: string;
  colorCode: string | null;
  baseType: ColorBaseType;
  isTinted: boolean;
  supplierPrices: {
    id: string;
    supplier: { id: string; name: string };
    price: number;
    uom: string | null;
    unitSize: number | null;
  }[];
  createdAt: string;
  updatedAt: string;
};

const BASE_TYPES: { value: ColorBaseType; label: string; color: string }[] = [
  { value: "DEEP", label: "Deep Base", color: "bg-blue-500" },
  { value: "PASTEL", label: "Pastel Base", color: "bg-pink-500" },
  { value: "WHITE", label: "White Base", color: "bg-gray-100" },
  {
    value: "CLEAR",
    label: "Clear Base",
    color: "bg-transparent border-2 border-gray-300",
  },
  { value: "NEUTRAL", label: "Neutral Base", color: "bg-yellow-500" },
];

const ALL_PRODUCTS_VALUE = "__all_products__";
const ALL_BASE_TYPES_VALUE = "__all_base_types__";

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function ColorVariantsPage() {
  const [variants, setVariants] = useState<ProductColorVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProduct, setFilterProduct] = useState<string>("");
  const [filterBaseType, setFilterBaseType] = useState<string>("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductColorVariant | null>(null);
  const [form, setForm] = useState({
    productId: "",
    colorName: "",
    colorCode: "",
    baseType: "DEEP" as ColorBaseType,
    isTinted: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProductColorVariant | null>(
    null,
  );
  const [mergeTargets, setMergeTargets] = useState<ProductColorVariant[]>([]);

  // Load color variants
  const loadVariants = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/procurement-products/colors");
      if (!res.ok) throw new Error("Failed to load color variants");
      const data = await res.json();
      setVariants(data);
    } catch (error) {
      toast.error("Failed to load color variants");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVariants();
  }, [loadVariants]);

  // Filtered variants
  const filteredVariants = useMemo(() => {
    return variants.filter((variant) => {
      const matchesSearch =
        variant.colorName.toLowerCase().includes(search.toLowerCase()) ||
        variant.product.name.toLowerCase().includes(search.toLowerCase());

      const matchesProduct =
        !filterProduct || variant.productId === filterProduct;
      const matchesBaseType =
        !filterBaseType || variant.baseType === filterBaseType;

      return matchesSearch && matchesProduct && matchesBaseType;
    });
  }, [variants, search, filterProduct, filterBaseType]);

  // Unique products for filter
  const uniqueProducts = useMemo(() => {
    const products = variants.map((v) => v.product);
    return products.filter(
      (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
    );
  }, [variants]);

  // Handle create/edit
  const handleSubmit = async () => {
    if (!form.productId || !form.colorName.trim()) {
      toast.error("Product and color name are required");
      return;
    }

    setSubmitting(true);
    try {
      const url = editing
        ? `/api/admin/procurement-products/colors/${editing.id}`
        : "/api/admin/procurement-products/colors";

      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save color variant");
      }

      toast.success(
        editing ? "Color variant updated" : "Color variant created",
      );
      setDialogOpen(false);
      setEditing(null);
      resetForm();
      loadVariants();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      productId: "",
      colorName: "",
      colorCode: "",
      baseType: "DEEP",
      isTinted: false,
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setEditing(null);
    setDialogOpen(true);
  };

  const openEditDialog = (variant: ProductColorVariant) => {
    setForm({
      productId: variant.productId,
      colorName: variant.colorName,
      colorCode: variant.colorCode || "",
      baseType: variant.baseType,
      isTinted: variant.isTinted,
    });
    setEditing(variant);
    setDialogOpen(true);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(
        `/api/admin/procurement-products/colors/${deleteTarget.id}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete color variant");
      }

      toast.success("Color variant deleted");
      setDeleteTarget(null);
      loadVariants();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  // Handle merge
  const handleMerge = async () => {
    if (mergeTargets.length < 2) return;

    try {
      const res = await fetch("/api/admin/procurement-products/colors/merge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          variantIds: mergeTargets.map((v) => v.id),
          targetId: mergeTargets[0].id, // Merge into first one
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to merge color variants");
      }

      toast.success(`${mergeTargets.length} color variants merged`);
      setMergeTargets([]);
      loadVariants();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to merge");
    }
  };

  // Table columns
  const columns: ColumnDef<ProductColorVariant>[] = [
    {
      accessorKey: "colorName",
      header: ({ column }) => {
        const s = column.getIsSorted();
        return (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting(s === "asc")}
          >
            Color Name
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
        const variant = row.original;
        return (
          <div className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded-full border ${BASE_TYPES.find((bt) => bt.value === variant.baseType)?.color || "bg-gray-400"}`}
            />
            <div>
              <div className="font-medium">{variant.colorName}</div>
              {variant.colorCode && (
                <div className="text-xs text-muted-foreground">
                  {variant.colorCode}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "product.name",
      header: "Product",
      cell: ({ row }) => {
        const variant = row.original;
        return (
          <div>
            <div className="font-medium">{variant.product.name}</div>
            {variant.product.sku && (
              <div className="text-xs text-muted-foreground">
                SKU: {variant.product.sku}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "baseType",
      header: "Base Type",
      cell: ({ row }) => {
        const baseType = BASE_TYPES.find(
          (bt) => bt.value === row.original.baseType,
        );
        return (
          <Badge variant="outline" className="capitalize">
            {baseType?.label || row.original.baseType}
          </Badge>
        );
      },
    },
    {
      id: "tinted",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant={row.original.isTinted ? "default" : "secondary"}>
          {row.original.isTinted ? "Tinted" : "Base"}
        </Badge>
      ),
    },
    {
      id: "prices",
      header: "Supplier Prices",
      cell: ({ row }) => {
        const prices = row.original.supplierPrices;
        if (!prices.length)
          return <span className="text-muted-foreground">—</span>;

        return (
          <div className="text-sm">
            {prices.slice(0, 2).map((price) => (
              <div key={price.id} className="flex items-center gap-1">
                <span className="font-medium">R{price.price.toFixed(2)}</span>
                <span className="text-muted-foreground">
                  {price.supplier.name}
                </span>
              </div>
            ))}
            {prices.length > 2 && (
              <div className="text-xs text-muted-foreground">
                +{prices.length - 2} more
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      size: 60,
      cell: ({ row }) => {
        const variant = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEditDialog(variant)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  setMergeTargets((prev) =>
                    prev.find((v) => v.id === variant.id)
                      ? prev.filter((v) => v.id !== variant.id)
                      : [...prev, variant],
                  )
                }
                className={
                  mergeTargets.find((v) => v.id === variant.id)
                    ? "bg-blue-50"
                    : ""
                }
              >
                <Merge className="mr-2 h-4 w-4" />
                {mergeTargets.find((v) => v.id === variant.id)
                  ? "Unselect for merge"
                  : "Select for merge"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteTarget(variant)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filteredVariants,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RotateCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Color Variants</h1>
          <p className="text-muted-foreground">
            Manage color variants for procurement products
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Variant
        </Button>
      </div>

      {/* Merge banner */}
      {mergeTargets.length > 1 && (
        <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Merge className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium">
            {mergeTargets.length} variants selected for merge
          </span>
          <Button size="sm" onClick={handleMerge} className="ml-auto">
            Merge Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMergeTargets([])}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search colors or products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filterProduct || ALL_PRODUCTS_VALUE}
          onValueChange={(value) =>
            setFilterProduct(value === ALL_PRODUCTS_VALUE ? "" : value)
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PRODUCTS_VALUE}>All Products</SelectItem>
            {uniqueProducts.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterBaseType || ALL_BASE_TYPES_VALUE}
          onValueChange={(value) =>
            setFilterBaseType(value === ALL_BASE_TYPES_VALUE ? "" : value)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Base Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_BASE_TYPES_VALUE}>All Base Types</SelectItem>
            {BASE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
                  No color variants found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing{" "}
          {table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
            1}{" "}
          to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            filteredVariants.length,
          )}{" "}
          of {filteredVariants.length} variants
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Color Variant" : "Create Color Variant"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the color variant details"
                : "Add a new color variant to a procurement product"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Product</label>
              <Select
                value={form.productId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, productId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Color Name</label>
              <Input
                value={form.colorName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, colorName: e.target.value }))
                }
                placeholder="e.g. Offshore 50, White, Deep Base"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Color Code (Optional)
              </label>
              <Input
                value={form.colorCode}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, colorCode: e.target.value }))
                }
                placeholder="e.g. #FFFFFF, BS123"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Base Type</label>
              <Select
                value={form.baseType}
                onValueChange={(value: ColorBaseType) =>
                  setForm((prev) => ({ ...prev, baseType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BASE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isTinted"
                checked={form.isTinted}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isTinted: e.target.checked }))
                }
              />
              <label htmlFor="isTinted" className="text-sm font-medium">
                Is Tinted Color
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <RotateCw className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Color Variant"
        description={`Are you sure you want to delete the "${deleteTarget?.colorName}" variant? This action cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  );
}
