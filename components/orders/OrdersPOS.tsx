"use client";

import * as React from "react";
import { toast } from "react-toastify";

import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatCurrency";
import type { AdminProductDto } from "@/components/products/ProductsList";

export interface AdminForemanDto {
  id: string;
  userId: string;
  name: string;
  email: string;
}

interface OrdersPOSProps {
  foremen: AdminForemanDto[];
  products: AdminProductDto[];
  onOrderCreated?: () => void;
}

type CartItem = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  note: string;
};

export default function OrdersPOS({
  foremen,
  products,
  onOrderCreated,
}: OrdersPOSProps) {
  const [selectedForemanId, setSelectedForemanId] = React.useState<string>(
    foremen[0]?.id ?? "",
  );
  const [foremanOpen, setForemanOpen] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState("");
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const filteredProducts = React.useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [productSearch, products]);

  function addToCart(product: AdminProductDto) {
    const priceNum = Number(product.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Product price is invalid");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unitPrice: priceNum,
          quantity: 1,
          note: "",
        },
      ];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId ? { ...item, quantity } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function updateNote(productId: string, note: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, note } : item,
      ),
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  const cartTotal = React.useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  async function handleCreateOrder() {
    if (!selectedForemanId) {
      toast.error("Please select a foreman");
      return;
    }
    if (cart.length === 0) {
      toast.error("Add at least one product to the order");
      return;
    }

    const itemsPayload = cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      note: item.note.trim() || undefined,
    }));

    try {
      setSubmitting(true);
      const res = await fetch("/api/app/admin/orders", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          foremanId: selectedForemanId,
          items: itemsPayload,
        }),
      });
      const json = await res.json().catch(() => null as any);
      if (!res.ok) {
        const msg =
          json?.error ||
          json?.message ||
          `Failed to create order (${res.status})`;
        throw new Error(msg);
      }

      toast.success("Order created");
      setCart([]);
      onOrderCreated?.();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to create order",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedForeman = React.useMemo(
    () => foremen.find((f) => f.id === selectedForemanId) ?? null,
    [foremen, selectedForemanId],
  );

  return (
    <div className="h-full bg-background">
      {/* Top header bar */}
      <div className="border-b border-border bg-primary text-primary-foreground px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary-foreground/60">
            Admin
          </span>
          <span className="text-primary-foreground/40">/</span>
          <span className="text-sm font-bold tracking-wide uppercase">
            Product Order Entry
          </span>
        </div>
        {cart.length > 0 && (
          <span className="text-[10px] tracking-widest text-primary-foreground/70 uppercase">
            {cart.length} item{cart.length !== 1 ? "s" : ""} in order
          </span>
        )}
      </div>

      <div className="max-w-350 mx-auto p-6">
        {/* Page title block */}
        <div className="border-b border-border pb-4 mb-6">
          <p className="text-[11px] tracking-[0.15em] text-muted-foreground uppercase mb-1">
            Record products taken by foreman — applied as deductions on worker
            timesheets
          </p>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-0 border border-border rounded-md overflow-hidden">
          {/* LEFT PANEL */}
          <div className="border-r border-border">
            {/* Foreman selector */}
            <div className="border-b border-border p-5 bg-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Assign Foreman
                </span>
              </div>
              <Popover open={foremanOpen} onOpenChange={setForemanOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={foremanOpen}
                    className="w-full justify-between h-10 text-sm font-medium"
                  >
                    <span className="truncate">
                      {selectedForemanId
                        ? foremen.find((f) => f.id === selectedForemanId)
                            ?.name ||
                          foremen.find((f) => f.id === selectedForemanId)
                            ?.email ||
                          "Select foreman"
                        : "Select foreman"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search foreman..."
                      className="text-sm"
                    />
                    <CommandList>
                      <CommandEmpty>No foreman found.</CommandEmpty>
                      <CommandGroup>
                        {foremen.map((f) => (
                          <CommandItem
                            key={f.id}
                            value={f.name || f.email}
                            onSelect={() => {
                              setSelectedForemanId(f.id);
                              setForemanOpen(false);
                            }}
                            className="text-sm"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedForemanId === f.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {f.name || f.email}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedForeman && (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <p className="text-[11px] text-muted-foreground tracking-wide">
                    Order assigned to{" "}
                    <span className="font-bold text-foreground">
                      {selectedForeman.name || selectedForeman.email}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Order items section header */}
            <div className="border-b border-border px-5 py-3 bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Order Items
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
                  Total
                </span>
                <span className="text-base font-bold tabular-nums text-foreground">
                  {formatCurrency(cartTotal)}
                </span>
              </div>
            </div>

            {/* Cart table */}
            <div className="bg-card overflow-x-auto">
              {cart.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2 text-center">
                  <div className="w-8 h-8 border border-border rounded flex items-center justify-center text-muted-foreground/40 text-lg">
                    ∅
                  </div>
                  <p className="text-xs text-muted-foreground tracking-widest uppercase">
                    No items added yet
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Click "Add" on a product from the right panel
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 pl-5">
                        Product
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-20 text-right">
                        Qty
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-24 text-right">
                        Unit
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-24 text-right">
                        Total
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-36">
                        Note
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item, idx) => (
                      <TableRow
                        key={item.productId}
                        className={`border-b border-border transition-colors ${
                          idx % 2 === 0 ? "" : "bg-muted/20"
                        }`}
                      >
                        <TableCell className="py-2.5 pl-5 text-sm font-medium text-foreground">
                          {item.productName}
                        </TableCell>
                        <TableCell className="py-2 pr-2">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (!Number.isFinite(n)) return;
                              updateQuantity(
                                item.productId,
                                Math.max(1, Math.floor(n)),
                              );
                            }}
                            className="h-7 w-16 text-sm text-right tabular-nums px-2"
                          />
                        </TableCell>
                        <TableCell className="py-2.5 text-sm tabular-nums text-muted-foreground text-right pr-3">
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm font-semibold tabular-nums text-foreground text-right pr-3">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            value={item.note}
                            onChange={(e) =>
                              updateNote(item.productId, e.target.value)
                            }
                            placeholder="Note…"
                            className="h-7 text-xs px-2"
                          />
                        </TableCell>
                        <TableCell className="py-2 pr-3 text-center">
                          <button
                            onClick={() => removeFromCart(item.productId)}
                            className="text-muted-foreground/50 hover:text-destructive transition-colors text-lg leading-none font-light"
                            aria-label="Remove item"
                          >
                            ×
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Submit bar */}
            <div className="border-t border-border p-4 bg-primary flex items-center justify-between gap-4">
              <div className="text-primary-foreground">
                {cart.length > 0 ? (
                  <div>
                    <div className="text-[10px] tracking-widest text-primary-foreground/60 uppercase">
                      Order Total
                    </div>
                    <div className="text-xl font-bold tabular-nums">
                      {formatCurrency(cartTotal)}
                    </div>
                  </div>
                ) : (
                  <span className="text-[11px] text-primary-foreground/50 tracking-wide">
                    No items in order
                  </span>
                )}
              </div>
              <button
                onClick={handleCreateOrder}
                disabled={submitting || !selectedForemanId || cart.length === 0}
                className={`
                  px-6 py-2.5 text-xs font-bold tracking-[0.2em] uppercase rounded transition-all
                  ${
                    submitting || !selectedForemanId || cart.length === 0
                      ? "bg-primary-foreground/20 text-primary-foreground/40 cursor-not-allowed"
                      : "bg-primary-foreground text-primary hover:bg-primary-foreground/90 active:scale-95"
                  }
                `}
              >
                {submitting ? "Saving…" : "Confirm Order →"}
              </button>
            </div>
          </div>

          {/* RIGHT PANEL — Product Picker */}
          <div className="flex flex-col min-h-0">
            {/* Product picker header */}
            <div className="border-b border-border p-5 bg-muted/40 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Product Catalogue
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground/60">
                  ({filteredProducts.length})
                </span>
              </div>
              <div className="flex-1 sm:flex sm:justify-end">
                <Input
                  placeholder="Search products…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="text-sm h-9 w-full sm:max-w-72"
                />
              </div>
            </div>

            {/* Product table */}
            <div
              className="overflow-auto flex-1 bg-card"
              style={{ maxHeight: "520px" }}
            >
              {filteredProducts.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2">
                  <p className="text-xs text-muted-foreground tracking-widest uppercase">
                    No products found
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 pl-5">
                        Product Name
                      </TableHead>
                      <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-28 text-right">
                        Unit Price
                      </TableHead>
                      <TableHead className="w-24 text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 text-right pr-5">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((p, idx) => {
                      const inCart = cart.find((c) => c.productId === p.id);
                      return (
                        <TableRow
                          key={p.id}
                          className={`border-b border-border transition-colors group cursor-default
                            ${
                              inCart
                                ? "bg-primary/5 hover:bg-primary/10"
                                : idx % 2 === 0
                                  ? "hover:bg-muted/30"
                                  : "bg-muted/20 hover:bg-muted/30"
                            }`}
                        >
                          <TableCell className="py-3 pl-5">
                            <div className="flex items-center gap-2">
                              {inCart && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                              )}
                              <span className="text-sm font-medium text-foreground">
                                {p.name}
                              </span>
                            </div>
                            {inCart && (
                              <span className="text-[10px] text-primary tracking-wider mt-0.5 ml-3.5 block">
                                ×{inCart.quantity} in order
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-sm tabular-nums font-semibold text-muted-foreground text-right pr-4">
                            {formatCurrency(Number(p.price))}
                          </TableCell>
                          <TableCell className="py-3 text-right pr-5">
                            <button
                              onClick={() => addToCart(p)}
                              className={`
                                text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1.5 border rounded transition-all active:scale-95
                                ${
                                  inCart
                                    ? "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary"
                                    : "border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
                                }
                              `}
                            >
                              {inCart ? "+ Add" : "Add"}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Bottom legend */}
            <div className="border-t border-border px-5 py-3 bg-muted/40 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">
                  Already in order
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 border border-border rounded-sm" />
                <span className="text-[10px] text-muted-foreground tracking-wider uppercase">
                  Available
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
