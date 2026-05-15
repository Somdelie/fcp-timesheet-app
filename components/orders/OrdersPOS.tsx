import * as React from "react";
import { toast } from "react-toastify";

import {
  Check,
  ChevronsUpDown,
  Printer,
  Loader2,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatCurrency";
import type { AdminProductDto } from "@/components/products/ProductsList";

export interface AdminForemanDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  type: "foreman" | "admin";
}

interface OrdersPOSProps {
  foremen: AdminForemanDto[];
  products: AdminProductDto[];
  requireReference?: boolean;
  onOrderCreated?: () => void;
}

type CartItem = {
  cartKey: string; // productId|size|color — allows same product in multiple variants
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  size: string | null;
  color: string | null;
  note: string;
};

function makeCartKey(
  productId: string,
  size: string | null,
  color: string | null,
) {
  return `${productId}|${size ?? ""}|${color ?? ""}`;
}

/* ------------------------------------------------------------------ */
/*  Variant Picker Dialog                                              */
/* ------------------------------------------------------------------ */

function VariantPickerDialog({
  product,
  open,
  onClose,
  onAdd,
}: {
  product: AdminProductDto | null;
  open: boolean;
  onClose: () => void;
  onAdd: (size: string | null, color: string | null, qty: number) => void;
}) {
  const [size, setSize] = React.useState<string>("");
  const [color, setColor] = React.useState<string>("");
  const [qty, setQty] = React.useState(1);

  React.useEffect(() => {
    if (open) {
      setSize(product?.sizes?.[0] ?? "");
      setColor(product?.colors?.[0] ?? "");
      setQty(1);
    }
  }, [open, product]);

  if (!product) return null;

  const hasSizes = product.sizes.length > 0;
  const hasColors = product.colors.length > 0;

  function handleAdd() {
    if (hasSizes && !size) {
      toast.error("Please select a size");
      return;
    }
    if (hasColors && !color) {
      toast.error("Please select a color");
      return;
    }
    onAdd(hasSizes ? size : null, hasColors ? color : null, qty);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {hasSizes && (
            <div className="space-y-1.5">
              <Label>Size</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {product.sizes.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {hasColors && (
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {product.colors.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) =>
                setQty(Math.max(1, Math.floor(Number(e.target.value))))
              }
              className="w-28"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add to Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main POS Component                                                 */
/* ------------------------------------------------------------------ */

export default function OrdersPOS({
  foremen,
  products,
  requireReference = false,
  onOrderCreated,
}: OrdersPOSProps) {
  const [selectedForemanIds, setSelectedForemanIds] = React.useState<string[]>(
    [],
  );
  const [foremanOpen, setForemanOpen] = React.useState(false);
  const [bulkProgress, setBulkProgress] = React.useState<{
    done: number;
    total: number;
  } | null>(null);
  const [productSearch, setProductSearch] = React.useState("");
  const [carts, setCarts] = React.useState<Record<string, CartItem[]>>({});
  const [reference, setReference] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  const [activeForemanId, setActiveForemanId] = React.useState<string>("");

  // Variant picker state
  const [pickerProduct, setPickerProduct] =
    React.useState<AdminProductDto | null>(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const filteredProducts = React.useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [productSearch, products]);

  // Update active foreman when selection changes
  React.useEffect(() => {
    if (selectedForemanIds.length > 0 && !activeForemanId) {
      setActiveForemanId(selectedForemanIds[0]);
    } else if (selectedForemanIds.length === 0) {
      setActiveForemanId("");
    } else if (!selectedForemanIds.includes(activeForemanId)) {
      setActiveForemanId(selectedForemanIds[0]);
    }
  }, [selectedForemanIds, activeForemanId]);

  const currentCart = carts[activeForemanId] || [];

  function openAddProduct(product: AdminProductDto) {
    const priceNum = Number(product.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Product price is invalid");
      return;
    }
    const hasSizes = product.sizes.length > 0;
    const hasColors = product.colors.length > 0;

    if (hasSizes || hasColors) {
      setPickerProduct(product);
      setPickerOpen(true);
    } else {
      addToCart(product, null, null, 1);
    }
  }

  function addToCart(
    product: AdminProductDto,
    size: string | null,
    color: string | null,
    qty: number,
  ) {
    if (!activeForemanId) {
      toast.error("Please select a foreman first");
      return;
    }
    const priceNum = Number(product.price);
    const key = makeCartKey(product.id, size, color);
    setCarts((prev) => {
      const foremanCart = prev[activeForemanId] || [];
      const existing = foremanCart.find((i) => i.cartKey === key);
      if (existing) {
        return {
          ...prev,
          [activeForemanId]: foremanCart.map((i) =>
            i.cartKey === key ? { ...i, quantity: i.quantity + qty } : i,
          ),
        };
      }
      return {
        ...prev,
        [activeForemanId]: [
          ...foremanCart,
          {
            cartKey: key,
            productId: product.id,
            productName: product.name,
            unitPrice: priceNum,
            quantity: qty,
            size,
            color,
            note: "",
          },
        ],
      };
    });
  }

  function updateQuantity(cartKey: string, quantity: number) {
    if (!activeForemanId) return;
    setCarts((prev) => ({
      ...prev,
      [activeForemanId]: (prev[activeForemanId] || [])
        .map((item) =>
          item.cartKey === cartKey ? { ...item, quantity } : item,
        )
        .filter((item) => item.quantity > 0),
    }));
  }

  function updateNote(cartKey: string, note: string) {
    if (!activeForemanId) return;
    setCarts((prev) => ({
      ...prev,
      [activeForemanId]: (prev[activeForemanId] || []).map((item) =>
        item.cartKey === cartKey ? { ...item, note } : item,
      ),
    }));
  }

  function removeFromCart(cartKey: string) {
    if (!activeForemanId) return;
    setCarts((prev) => ({
      ...prev,
      [activeForemanId]: (prev[activeForemanId] || []).filter(
        (item) => item.cartKey !== cartKey,
      ),
    }));
  }

  const cartTotal = React.useMemo(() => {
    return currentCart.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
  }, [currentCart]);

  const totalItemsAcrossAllCarts = React.useMemo(() => {
    return Object.values(carts).reduce((sum, cart) => sum + cart.length, 0);
  }, [carts]);

  function toggleForeman(id: string) {
    setSelectedForemanIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handlePrintVoucher() {
    const firstSelectedId = selectedForemanIds[0];
    if (!firstSelectedId) return;
    const firstCart = carts[firstSelectedId] || [];
    if (firstCart.length === 0) return;

    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const orderNumber =
      reference.trim() ||
      `PO-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const issuedDate = now.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const selected = foremen.find((f) => f.id === firstSelectedId);
    const voucherData = {
      orderNumber,
      issuedDate,
      recipientName: selected?.name || selected?.email || "",
      recipientType: (selected?.type ?? "foreman") as "foreman" | "admin",
      items: firstCart.map((i) => ({
        productName: i.productName,
        size: i.size ?? null,
        color: i.color ?? null,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        note: i.note.trim() || null,
      })),
    };
    setPrinting(true);
    try {
      const res = await fetch("/api/app/admin/product-order/pdf", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(voucherData),
      });
      if (!res.ok) throw new Error("Failed to generate voucher");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Could not generate voucher PDF");
    } finally {
      setPrinting(false);
    }
  }

  async function handlePrintBatchVouchers() {
    if (selectedForemanIds.length === 0) return;

    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const baseOrderNumber =
      reference.trim() ||
      `PO-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const issuedDate = now.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const batchData = selectedForemanIds
      .map((foremanId, index) => {
        const cart = carts[foremanId] || [];
        if (cart.length === 0) return null;

        const selected = foremen.find((f) => f.id === foremanId);
        const orderNumber =
          selectedForemanIds.length > 1
            ? `${baseOrderNumber}-${index + 1}`
            : baseOrderNumber;

        return {
          orderNumber,
          issuedDate,
          recipientName: selected?.name || selected?.email || "",
          recipientType: (selected?.type ?? "foreman") as "foreman" | "admin",
          items: cart.map((i) => ({
            productName: i.productName,
            size: i.size ?? null,
            color: i.color ?? null,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            note: i.note.trim() || null,
          })),
        };
      })
      .filter(Boolean);

    if (batchData.length === 0) return;

    setPrinting(true);
    try {
      const res = await fetch("/api/app/admin/product-order/pdf/batch", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orders: batchData }),
      });
      if (!res.ok) throw new Error("Failed to generate batch vouchers");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Could not generate batch voucher PDF");
    } finally {
      setPrinting(false);
    }
  }

  async function handleCreateOrder() {
    if (requireReference && !reference.trim()) {
      toast.error("Order number is required");
      return;
    }
    if (selectedForemanIds.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    // Check if any selected foreman has items in their cart
    const hasAnyItems = selectedForemanIds.some(
      (id) => (carts[id] || []).length > 0,
    );
    if (!hasAnyItems) {
      toast.error("Add at least one product to an order");
      return;
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const baseOrderNumber =
      reference.trim() ||
      `PO-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    try {
      setSubmitting(true);
      setBulkProgress({ done: 0, total: selectedForemanIds.length });
      let failed = 0;
      const successfulOrders: any[] = [];

      for (let i = 0; i < selectedForemanIds.length; i++) {
        const id = selectedForemanIds[i];
        const cart = carts[id] || [];

        // Skip foremen with empty carts
        if (cart.length === 0) {
          setBulkProgress({ done: i + 1, total: selectedForemanIds.length });
          continue;
        }

        const recipient = foremen.find((f) => f.id === id);
        const isAdmin = recipient?.type === "admin";
        const orderNumber =
          selectedForemanIds.length > 1
            ? `${baseOrderNumber}-${i + 1}`
            : baseOrderNumber;

        const itemsPayload = cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          ...(item.size ? { size: item.size } : {}),
          ...(item.color ? { color: item.color } : {}),
          note: item.note.trim() || undefined,
        }));

        const res = await fetch("/api/app/admin/orders", {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            ...(isAdmin ? { adminUserId: id } : { foremanId: id }),
            ...(orderNumber ? { reference: orderNumber } : {}),
            items: itemsPayload,
          }),
        });
        const json = await res.json().catch(() => null as any);
        if (!res.ok) {
          const name = recipient?.name || recipient?.email || id;
          const msg =
            res.status === 409
              ? `Order "${orderNumber}" already exists`
              : `Failed for ${name}: ${json?.error ?? res.status}`;
          toast.error(msg);
          failed++;
        } else {
          successfulOrders.push({
            orderNumber,
            recipientName: recipient?.name || recipient?.email || "",
            recipientType: (recipient?.type ?? "foreman") as
              | "foreman"
              | "admin",
            items: cart.map((i) => ({
              productName: i.productName,
              size: i.size ?? null,
              color: i.color ?? null,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              note: i.note.trim() || null,
            })),
          });
        }
        setBulkProgress({ done: i + 1, total: selectedForemanIds.length });
      }

      if (successfulOrders.length > 0) {
        const count = successfulOrders.length;
        toast.success(
          count === 1 ? "Order created" : `${count} orders created`,
        );

        // Auto-print batch vouchers
        if (successfulOrders.length > 0) {
          await handlePrintBatchVouchersAfterCreation(successfulOrders);
        }

        setCarts({});
        setSelectedForemanIds([]);
        setReference("");
        onOrderCreated?.();
      }
    } finally {
      setSubmitting(false);
      setBulkProgress(null);
    }
  }

  async function handlePrintBatchVouchersAfterCreation(orders: any[]) {
    const issuedDate = new Date().toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const batchData = orders.map((order) => ({
      ...order,
      issuedDate,
    }));

    try {
      const res = await fetch("/api/app/admin/product-order/pdf/batch", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orders: batchData }),
      });
      if (!res.ok) throw new Error("Failed to generate batch vouchers");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Could not generate batch voucher PDF");
    }
  }

  const selectedForemen = React.useMemo(
    () => foremen.filter((f) => selectedForemanIds.includes(f.id)),
    [foremen, selectedForemanIds],
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
        {totalItemsAcrossAllCarts > 0 && (
          <span className="text-[10px] tracking-widest text-primary-foreground/70 uppercase">
            {totalItemsAcrossAllCarts} item
            {totalItemsAcrossAllCarts !== 1 ? "s" : ""} in order
            {selectedForemanIds.length > 1 ? "s" : ""}
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
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-0 border border-border rounded-md overflow-hidden">
          {/* LEFT PANEL */}
          <div className="border-r border-border">
            {/* Order reference */}
            <div className="border-b border-border p-5 bg-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Order Number
                </span>
                {requireReference && (
                  <span className="text-[10px] font-bold text-destructive uppercase tracking-wide">
                    required
                  </span>
                )}
              </div>
              <Input
                placeholder={
                  requireReference
                    ? "e.g. 68090 (BuildSmart PO #)"
                    : "e.g. 68090 (optional)"
                }
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={`h-10 text-sm font-medium ${requireReference && !reference.trim() ? "border-destructive/50" : ""}`}
              />
            </div>

            {/* Foreman / Admin selector */}
            <div className="border-b border-border p-5 bg-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Assign Recipients
                </span>
                {selectedForemanIds.length > 0 && (
                  <span className="text-[10px] font-bold tabular-nums bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                    {selectedForemanIds.length}
                  </span>
                )}
              </div>
              <Popover open={foremanOpen} onOpenChange={setForemanOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={foremanOpen}
                    className="w-full justify-between h-10 text-sm font-medium"
                  >
                    <span className="truncate text-muted-foreground">
                      {selectedForemanIds.length === 0
                        ? "Select foremen or admins…"
                        : `${selectedForemanIds.length} recipient${selectedForemanIds.length !== 1 ? "s" : ""} selected`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search…" className="text-sm" />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup heading="Foremen">
                        {foremen
                          .filter((f) => f.type === "foreman")
                          .map((f) => (
                            <CommandItem
                              key={f.id}
                              value={`foreman ${f.name || f.email}`}
                              onSelect={() => toggleForeman(f.id)}
                              className="text-sm"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedForemanIds.includes(f.id)
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {f.name || f.email}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                      <CommandGroup heading="Admins">
                        {foremen
                          .filter((f) => f.type === "admin")
                          .map((f) => (
                            <CommandItem
                              key={f.id}
                              value={`admin ${f.name || f.email}`}
                              onSelect={() => toggleForeman(f.id)}
                              className="text-sm"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedForemanIds.includes(f.id)
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 px-1 rounded mr-1.5">
                                Admin
                              </span>
                              {f.name || f.email}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Selected recipient badges */}
              {selectedForemen.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedForemen.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted border border-border px-2 py-1 rounded-full"
                    >
                      {f.type === "admin" && (
                        <span className="text-[9px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 px-1 rounded">
                          Admin
                        </span>
                      )}
                      {f.name || f.email}
                      <button
                        type="button"
                        onClick={() => toggleForeman(f.id)}
                        className="ml-0.5 text-muted-foreground hover:text-destructive leading-none"
                        aria-label={`Remove ${f.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Order items section */}
            {selectedForemen.length > 1 ? (
              <Tabs
                value={activeForemanId}
                onValueChange={setActiveForemanId}
                className="w-full"
              >
                <div className="border-b border-border px-5 py-3 bg-muted/40">
                  <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
                    {selectedForemen.map((f) => {
                      const cartItems = carts[f.id] || [];
                      return (
                        <TabsTrigger
                          key={f.id}
                          value={f.id}
                          className="text-xs relative"
                        >
                          <div className="flex items-center gap-1">
                            {f.type === "admin" && (
                              <span className="text-[8px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 px-1 rounded">
                                A
                              </span>
                            )}
                            <span className="truncate max-w-20">
                              {f.name || f.email}
                            </span>
                            {cartItems.length > 0 && (
                              <span className="ml-1 bg-primary text-primary-foreground text-[8px] px-1 rounded-full min-w-4 h-4 flex items-center justify-center">
                                {cartItems.length}
                              </span>
                            )}
                          </div>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>
                {selectedForemen.map((f) => {
                  const foremanCart = carts[f.id] || [];
                  const foremanTotal = foremanCart.reduce(
                    (sum, item) => sum + item.unitPrice * item.quantity,
                    0,
                  );
                  return (
                    <TabsContent key={f.id} value={f.id} className="m-0">
                      {/* Cart header for this foreman */}
                      <div className="border-b border-border px-5 py-3 bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
                            {f.name || f.email}'s Order
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
                            Total
                          </span>
                          <span className="text-base font-bold tabular-nums text-foreground">
                            {formatCurrency(foremanTotal)}
                          </span>
                        </div>
                      </div>

                      {/* Cart table for this foreman */}
                      <div className="bg-card overflow-x-auto">
                        {foremanCart.length === 0 ? (
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
                          <Table className="w-full">
                            <TableHeader>
                              <TableRow className="border-b border-border hover:bg-transparent">
                                <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 pl-5 w-[180px]">
                                  Product
                                </TableHead>
                                <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-28 text-right">
                                  Qty
                                </TableHead>
                                <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-28 text-right">
                                  Unit
                                </TableHead>
                                <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-28 text-right">
                                  Total
                                </TableHead>
                                <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-58 text-right">
                                  Note
                                </TableHead>
                                <TableHead className="w-10" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {foremanCart.map((item, idx) => (
                                <TableRow
                                  key={item.cartKey}
                                  className={`border-b border-border transition-colors ${
                                    idx % 2 === 0 ? "" : "bg-muted/20"
                                  }`}
                                >
                                  <TableCell className="py-2.5 pl-5">
                                    <div className="text-sm font-medium text-foreground">
                                      {item.productName}
                                    </div>
                                    {(item.size || item.color) && (
                                      <div className="mt-0.5 flex flex-wrap gap-1">
                                        {item.size && (
                                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-muted-foreground">
                                            {item.size}
                                          </span>
                                        )}
                                        {item.color && (
                                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-muted-foreground">
                                            {item.color}
                                          </span>
                                        )}
                                      </div>
                                    )}
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
                                          item.cartKey,
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
                                    {formatCurrency(
                                      item.unitPrice * item.quantity,
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Input
                                      value={item.note}
                                      onChange={(e) =>
                                        updateNote(item.cartKey, e.target.value)
                                      }
                                      placeholder="Note…"
                                      className="h-7 text-xs px-2"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2 pr-3 text-center">
                                    <button
                                      onClick={() =>
                                        removeFromCart(item.cartKey)
                                      }
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
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : (
              <>
                {/* Single foreman - Order items section header */}
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
                  {currentCart.length === 0 ? (
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
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="border-b border-border hover:bg-transparent">
                          <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 pl-5 w-[180px]">
                            Product
                          </TableHead>
                          <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-28 text-right">
                            Qty
                          </TableHead>
                          <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-28 text-right">
                            Unit
                          </TableHead>
                          <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-28 text-right">
                            Total
                          </TableHead>
                          <TableHead className="text-[10px] font-bold tracking-[0.15em] uppercase py-2.5 w-58 text-right">
                            Note
                          </TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentCart.map((item, idx) => (
                          <TableRow
                            key={item.cartKey}
                            className={`border-b border-border transition-colors ${
                              idx % 2 === 0 ? "" : "bg-muted/20"
                            }`}
                          >
                            <TableCell className="py-2.5 pl-5">
                              <div className="text-sm font-medium text-foreground">
                                {item.productName}
                              </div>
                              {(item.size || item.color) && (
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  {item.size && (
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-muted-foreground">
                                      {item.size}
                                    </span>
                                  )}
                                  {item.color && (
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-muted-foreground">
                                      {item.color}
                                    </span>
                                  )}
                                </div>
                              )}
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
                                    item.cartKey,
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
                                  updateNote(item.cartKey, e.target.value)
                                }
                                placeholder="Note…"
                                className="h-7 text-xs px-2"
                              />
                            </TableCell>
                            <TableCell className="py-2 pr-3 text-center">
                              <button
                                onClick={() => removeFromCart(item.cartKey)}
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
              </>
            )}

            {/* Submit bar */}
            <div className="border-t border-border p-4 bg-primary flex items-center justify-between gap-4">
              <div className="text-primary-foreground">
                {bulkProgress ? (
                  <div>
                    <div className="text-[10px] tracking-widest text-primary-foreground/60 uppercase">
                      Creating Orders
                    </div>
                    <div className="text-xl font-bold tabular-nums">
                      {bulkProgress.done} / {bulkProgress.total}
                    </div>
                  </div>
                ) : totalItemsAcrossAllCarts > 0 ? (
                  <div>
                    <div className="text-[10px] tracking-widest text-primary-foreground/60 uppercase">
                      {selectedForemen.length > 1
                        ? "Combined Order Total"
                        : "Order Total"}
                    </div>
                    <div className="text-xl font-bold tabular-nums">
                      {formatCurrency(
                        Object.values(carts).reduce(
                          (sum, cart) =>
                            sum +
                            cart.reduce(
                              (cartSum, item) =>
                                cartSum + item.unitPrice * item.quantity,
                              0,
                            ),
                          0,
                        ),
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-[11px] text-primary-foreground/50 tracking-wide">
                    No items in order{selectedForemen.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {totalItemsAcrossAllCarts > 0 && (
                  <button
                    onClick={handlePrintBatchVouchers}
                    disabled={printing}
                    className="flex items-center px-4 py-2.5 text-xs font-bold tracking-[0.15em] uppercase rounded border border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {printing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    {printing
                      ? "Generating…"
                      : selectedForemen.length > 1
                        ? "Print All Orders"
                        : "Print Order"}
                  </button>
                )}
                <button
                  onClick={handleCreateOrder}
                  disabled={
                    submitting ||
                    selectedForemanIds.length === 0 ||
                    totalItemsAcrossAllCarts === 0
                  }
                  className={`
                    px-6 py-2.5 text-xs font-bold tracking-[0.2em] uppercase rounded transition-all
                    ${
                      submitting ||
                      selectedForemanIds.length === 0 ||
                      totalItemsAcrossAllCarts === 0
                        ? "bg-primary-foreground/20 text-primary-foreground/40 cursor-not-allowed"
                        : "bg-primary-foreground text-primary hover:bg-primary-foreground/90 active:scale-95"
                    }
                  `}
                >
                  {submitting
                    ? bulkProgress
                      ? `Creating ${bulkProgress.done + 1} of ${bulkProgress.total}…`
                      : "Saving…"
                    : selectedForemanIds.length > 1
                      ? `Confirm ${selectedForemanIds.length} Orders →`
                      : "Confirm Order →"}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — Product Picker */}
          <div className="flex flex-col min-h-0 flex-1">
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
                      const cartItems = Object.values(carts)
                        .flat()
                        .filter((c) => c.productId === p.id);
                      const inCart = cartItems.length > 0;
                      const cartQty = cartItems.reduce(
                        (s, c) => s + c.quantity,
                        0,
                      );
                      const hasVariants =
                        p.sizes.length > 0 || p.colors.length > 0;
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
                                ×{cartQty} in order
                              </span>
                            )}
                            {hasVariants && (
                              <div className="mt-0.5 ml-3.5 flex flex-wrap gap-1">
                                {p.sizes.slice(0, 3).map((s) => (
                                  <span
                                    key={s}
                                    className="text-[9px] border border-border rounded px-1 text-muted-foreground/70"
                                  >
                                    {s}
                                  </span>
                                ))}
                                {p.sizes.length > 3 && (
                                  <span className="text-[9px] text-muted-foreground/50">
                                    +{p.sizes.length - 3}
                                  </span>
                                )}
                                {p.colors.slice(0, 3).map((c) => (
                                  <span
                                    key={c}
                                    className="text-[9px] border border-border rounded px-1 text-muted-foreground/70"
                                  >
                                    {c}
                                  </span>
                                ))}
                                {p.colors.length > 3 && (
                                  <span className="text-[9px] text-muted-foreground/50">
                                    +{p.colors.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-sm tabular-nums font-semibold text-muted-foreground text-right pr-4">
                            {formatCurrency(Number(p.price))}
                          </TableCell>
                          <TableCell className="py-3 text-right pr-5">
                            <button
                              onClick={() => openAddProduct(p)}
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

      {/* Variant picker dialog */}
      <VariantPickerDialog
        product={pickerProduct}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={(size, color, qty) => {
          if (pickerProduct) addToCart(pickerProduct, size, color, qty);
        }}
      />
    </div>
  );
}
