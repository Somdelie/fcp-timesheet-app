"use client";

import { useMemo, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type CatalogueActionResult = {
  success: boolean;
  error?: string;
};

export type UpdateMasterProductInput = {
  id: string;
  name: string;
  category: string;
  usage: "INT" | "EXT" | "INT_EXT";
  description: string;
};

export type UpdateMasterPricesInput = {
  productId: string;
  prices: Array<{ id: string; price: string }>;
};

type ActionPrice = {
  id: string;
  unitSize: string;
  uom: string;
  price: string;
  base: { name: string };
  finish: { name: string } | null;
};

type MasterCatalogueProductActionsProps = {
  product: {
    id: string;
    name: string;
    category: string;
    usage: "INT" | "EXT" | "INT_EXT";
    description: string;
    isActive: boolean;
    prices: ActionPrice[];
  };
  updateProductAction: (
    input: UpdateMasterProductInput,
  ) => Promise<CatalogueActionResult>;
  updatePricesAction: (
    input: UpdateMasterPricesInput,
  ) => Promise<CatalogueActionResult>;
  toggleProductAction: (
    id: string,
    isActive: boolean,
  ) => Promise<CatalogueActionResult>;
  deleteProductAction: (id: string) => Promise<CatalogueActionResult>;
};

export function MasterCatalogueProductActions({
  product,
  updateProductAction,
  updatePricesAction,
  toggleProductAction,
  deleteProductAction,
}: MasterCatalogueProductActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [usage, setUsage] = useState<"INT" | "EXT" | "INT_EXT">(product.usage);
  const [description, setDescription] = useState(product.description);
  const [error, setError] = useState("");

  const initialPrices = useMemo(
    () =>
      Object.fromEntries(
        product.prices.map((price) => [price.id, price.price]),
      ),
    [product.prices],
  );
  const [priceValues, setPriceValues] =
    useState<Record<string, string>>(initialPrices);

  function finish(result: CatalogueActionResult, close: () => void) {
    if (!result.success) {
      setError(result.error || "The action could not be completed.");
      return;
    }

    setError("");
    close();
    router.refresh();
  }

  function saveProduct() {
    setError("");
    startTransition(async () => {
      const result = await updateProductAction({
        id: product.id,
        name,
        category,
        usage,
        description,
      });
      finish(result, () => setEditOpen(false));
    });
  }

  function savePrices() {
    setError("");
    startTransition(async () => {
      const result = await updatePricesAction({
        productId: product.id,
        prices: product.prices.map((price) => ({
          id: price.id,
          price: priceValues[price.id] ?? price.price,
        })),
      });
      finish(result, () => setPricesOpen(false));
    });
  }

  function toggleProduct() {
    setError("");
    startTransition(async () => {
      const result = await toggleProductAction(product.id, !product.isActive);
      if (!result.success) {
        setError(result.error || "The product status could not be changed.");
        return;
      }
      router.refresh();
    });
  }

  function deleteProduct() {
    setError("");
    startTransition(async () => {
      const result = await deleteProductAction(product.id);
      finish(result, () => setDeleteOpen(false));
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-slate-700"
            aria-label={`Actions for ${product.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            Edit product
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPricesOpen(true)}>
            Manage prices
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleProduct} disabled={isPending}>
            {product.isActive ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            Delete product
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>
              Update the clean product identity. Colours remain separate.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor={`product-name-${product.id}`}>Product name</Label>
              <Input
                id={`product-name-${product.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`product-category-${product.id}`}>Category</Label>
              <Input
                id={`product-category-${product.id}`}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Paints"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`product-usage-${product.id}`}>Usage</Label>
              <Select
                value={usage}
                onValueChange={(value) =>
                  setUsage(
                    value === "INT" || value === "EXT" ? value : "INT_EXT",
                  )
                }
              >
                <SelectTrigger id={`product-usage-${product.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INT">Int</SelectItem>
                  <SelectItem value="EXT">Ext</SelectItem>
                  <SelectItem value="INT_EXT">Int/Ext</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`product-description-${product.id}`}>
                Description
              </Label>
              <Textarea
                id={`product-description-${product.id}`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveProduct} disabled={isPending || !name.trim()}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pricesOpen} onOpenChange={setPricesOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage prices</DialogTitle>
            <DialogDescription>
              Update the current base and size prices for {product.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {product.prices.map((price) => (
              <div
                key={price.id}
                className="grid grid-cols-[1fr_90px_140px] items-center gap-3 rounded-md border p-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {price.base.name}
                  </div>
                  {price.finish?.name ? (
                    <div className="truncate text-xs text-muted-foreground">
                      {price.finish.name}
                    </div>
                  ) : null}
                </div>
                <div className="text-sm text-muted-foreground">
                  {Number(price.unitSize)}
                  {price.uom}
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceValues[price.id] ?? price.price}
                  onChange={(event) =>
                    setPriceValues((current) => ({
                      ...current,
                      [price.id]: event.target.value,
                    }))
                  }
                  aria-label={`${price.base.name} ${price.unitSize}${price.uom} price`}
                />
              </div>
            ))}
            {product.prices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                This product has no price rows to edit yet.
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPricesOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={savePrices}
              disabled={isPending || product.prices.length === 0}
            >
              {isPending ? "Saving..." : "Save prices"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the product, its finishes, bases and
              prices. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                deleteProduct();
              }}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
