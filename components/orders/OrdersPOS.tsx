"use client";

import * as React from "react";
import { toast } from "react-toastify";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatCurrency";
import type { AdminProductDto } from "@/components/products/ProductsList";

export interface AdminForemanDto {
  id: string; // foreman.id
  userId: string;
  name: string;
  email: string;
}

interface OrdersPOSProps {
  foremen: AdminForemanDto[];
  products: AdminProductDto[];
}

type CartItem = {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  note: string;
};

export default function OrdersPOS({ foremen, products }: OrdersPOSProps) {
  const [selectedForemanId, setSelectedForemanId] = React.useState<string>(
    foremen[0]?.id ?? "",
  );
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
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Create Product Order</h1>
        <p className="text-sm text-muted-foreground">
          Record products taken by a foreman so they can later be applied as
          deductions on worker timesheets.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Left: foreman + cart */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Foreman</label>
            <Select
              value={selectedForemanId}
              onValueChange={(value) => setSelectedForemanId(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select foreman" />
              </SelectTrigger>
              <SelectContent>
                {foremen.length === 0 ? (
                  <SelectItem value="" disabled>
                    No foremen found
                  </SelectItem>
                ) : (
                  foremen.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name || f.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedForeman ? (
              <p className="text-xs text-muted-foreground">
                Creating order for:{" "}
                <span className="font-medium">
                  {selectedForeman.name || selectedForeman.email}
                </span>
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Order items</h2>
              <div className="text-xs text-muted-foreground">
                Total: {formatCurrency(cartTotal)}
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-24">Price</TableHead>
                    <TableHead className="w-24">Line total</TableHead>
                    <TableHead className="w-40">Note</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground text-sm"
                      >
                        No items in order yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>
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
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell>
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.note}
                            onChange={(e) =>
                              updateNote(item.productId, e.target.value)
                            }
                            placeholder="Optional note"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.productId)}
                          >
                            ×
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleCreateOrder}
                disabled={submitting || !selectedForemanId || cart.length === 0}
              >
                {submitting ? "Saving order…" : "Create Order"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right: product picker */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Products</h2>
            <Input
              placeholder="Search products…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <div className="border rounded-md max-h-120 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24">Price</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground text-sm"
                    >
                      No products found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{formatCurrency(Number(p.price))}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addToCart(p)}
                        >
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
