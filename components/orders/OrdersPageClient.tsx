"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Trash2,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PackagePlus,
  RotateCcw,
  ChevronsUpDown,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import OrdersPOS, { type AdminForemanDto } from "@/components/orders/OrdersPOS";
import type { AdminProductDto } from "@/components/products/ProductsList";
import { formatCurrency } from "@/lib/formatCurrency";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  note: string | null;
};

type Order = {
  id: string;
  foremanId: string;
  foremanName: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
};

type ParsedItem = {
  rawDescription: string;
  productCode: string;
  quantity: number;
  unit: string;
  matched: boolean;
  confidence: number;
  productId: string | null;
  productName: string | null;
  productCategory: string | null;
};

type ParseResult = {
  orderNumber: string;
  vendorName: string | null;
  foremanNameHint: string | null;
  suggestedForemanId: string | null;
  items: ParsedItem[];
};

type ImportRowState = {
  productId: string | null;
  quantity: number;
  include: boolean;
};

interface OrdersPageClientProps {
  foremen: AdminForemanDto[];
  products: AdminProductDto[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusBadgeVariant(status: string) {
  switch (status) {
    case "APPLIED": return "default" as const;
    case "PENDING": return "secondary" as const;
    case "PARTIALLY_APPLIED": return "outline" as const;
    case "CANCELLED": return "destructive" as const;
    default: return "secondary" as const;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orderTotal(items: OrderItem[]) {
  return items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
}

/* ------------------------------------------------------------------ */
/*  Foreman Combobox (searchable)                                      */
/* ------------------------------------------------------------------ */

function ForemanCombobox({
  foremen,
  value,
  onChange,
}: {
  foremen: AdminForemanDto[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = foremen.find((f) => f.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? selected.name || selected.email : "— select foreman —"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search foreman…" />
          <CommandList>
            <CommandEmpty>No foreman found.</CommandEmpty>
            <CommandGroup>
              {foremen.map((f) => (
                <CommandItem
                  key={f.id}
                  value={f.name || f.email || f.id}
                  onSelect={() => {
                    onChange(f.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${value === f.id ? "opacity-100" : "opacity-0"}`}
                  />
                  {f.name || f.email}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/*  BuildSmart Import Tab                                              */
/* ------------------------------------------------------------------ */

function BuildSmartImportTab({
  foremen,
  products,
}: {
  foremen: AdminForemanDto[];
  products: AdminProductDto[];
  onOrderCreated: () => void;
}) {
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [isParsing, setIsParsing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<ImportRowState[]>([]);
  const [foremanId, setForemanId] = useState("");
  const [doneForemanName, setDoneForemanName] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Select a PDF first"); return; }

    setIsParsing(true);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await fetch("/api/app/admin/stock-receipts/parse", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Parse failed");
      const result = json as ParseResult;
      setParsed(result);
      setRows(
        result.items.map((item: ParsedItem) => ({
          productId: item.productId,
          quantity: item.quantity,
          include: item.matched,
        })),
      );
      if (result.suggestedForemanId) setForemanId(result.suggestedForemanId);
      // Log raw text to console for debugging quantity parsing issues
      if ((json as any).rawText) console.log("[BuildSmart rawText]", (json as any).rawText);
      setStep("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse PDF");
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!foremanId) { toast.error("Select a foreman first"); return; }

    const items = rows
      .filter((r) => r.include && r.productId)
      .map((r) => ({ productId: r.productId!, quantity: r.quantity }));

    if (items.length === 0) { toast.error("No items selected"); return; }

    setIsConfirming(true);
    try {
      const res = await fetch("/api/app/admin/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ foremanId, items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create order");

      const fm = foremen.find((f) => f.id === foremanId);
      setDoneForemanName(fm?.name ?? "foreman");
      setDoneCount(items.length);
      toast.success(`Order created for ${fm?.name ?? "foreman"}`);
      setStep("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setIsConfirming(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setParsed(null);
    setRows([]);
    setForemanId("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const includedCount = rows.filter((r) => r.include && r.productId).length;

  if (step === "done") {
    return (
      <div className="py-12 text-center space-y-4">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
        <h2 className="text-xl font-semibold">Order Created</h2>
        <p className="text-sm text-muted-foreground">
          {doneCount} item{doneCount !== 1 ? "s" : ""} assigned to{" "}
          <strong>{doneForemanName}</strong>. View it in the Foreman Orders tab.
        </p>
        <Button onClick={reset} variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" />
          Import Another
        </Button>
      </div>
    );
  }

  if (step === "review" && parsed) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">PO #{parsed.orderNumber}{parsed.vendorName ? ` · ${parsed.vendorName}` : ""}</p>
            <p className="text-sm text-muted-foreground">{parsed.items.length} line items parsed</p>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Start Over
          </Button>
        </div>

        <div className="max-w-xs space-y-1.5">
          <Label>
            Assign to Foreman
            {parsed.foremanNameHint && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (detected: {parsed.foremanNameHint})
              </span>
            )}
          </Label>
          <ForemanCombobox
            foremen={foremen}
            value={foremanId}
            onChange={setForemanId}
          />
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => r.include)}
                    onChange={(e) =>
                      setRows((prev) => prev.map((r) => ({ ...r, include: e.target.checked })))
                    }
                  />
                </TableHead>
                <TableHead>PDF Description</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead className="w-28">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.items.map((item, i) => {
                const row = rows[i];
                if (!row) return null;
                return (
                  <TableRow key={i} className={!row.include ? "opacity-50" : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(e) =>
                          setRows((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i], include: e.target.checked };
                            return next;
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm font-medium truncate">{item.rawDescription}</p>
                      {item.productCode && (
                        <p className="text-xs text-muted-foreground">{item.productCode}</p>
                      )}
                    </TableCell>
                    <TableCell className="min-w-52">
                      <Select
                        value={row.productId ?? "__none__"}
                        onValueChange={(val) =>
                          setRows((prev) => {
                            const next = [...prev];
                            next[i] = {
                              ...next[i],
                              productId: val === "__none__" ? null : val,
                              include: val !== "__none__",
                            };
                            return next;
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="— select product —" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="__none__">— skip —</SelectItem>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              [{p.category}] {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(e) =>
                          setRows((prev) => {
                            const next = [...prev];
                            next[i] = { ...next[i], quantity: Math.max(1, Number(e.target.value)) };
                            return next;
                          })
                        }
                        className="h-8 w-20 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      {item.matched ? (
                        <Badge variant="outline" className="border-green-500 text-green-700 text-xs">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Matched
                        </Badge>
                      ) : item.confidence > 0 ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-700 text-xs">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Partial
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-red-400 text-red-600 text-xs">
                          <XCircle className="mr-1 h-3 w-3" />
                          Unmatched
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleConfirm}
            disabled={isConfirming || includedCount === 0 || !foremanId}
          >
            {isConfirming ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PackagePlus className="mr-2 h-4 w-4" />
            )}
            Create Order ({includedCount} item{includedCount !== 1 ? "s" : ""})
          </Button>
          <p className="text-sm text-muted-foreground">
            Adds a pending foreman order — apply deductions from the Foreman Orders tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a BuildSmart PO PDF. Items are matched to the PPE &amp; Tools catalogue
        and added as a pending foreman order ready for deduction.
      </p>
      <form onSubmit={handleUpload} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="bs-pdf-upload">BuildSmart PO PDF</Label>
          <Input
            id="bs-pdf-upload"
            type="file"
            accept=".pdf,application/pdf"
            ref={fileRef}
            className="cursor-pointer"
          />
        </div>
        <Button type="submit" disabled={isParsing}>
          {isParsing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {isParsing ? "Parsing PDF…" : "Upload & Parse"}
        </Button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function OrdersPageClient({
  foremen,
  products,
}: OrdersPageClientProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelDialogOrderId, setCancelDialogOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/admin/orders", {
        cache: "no-store",
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to load orders");
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const totalOrderValue = useMemo(
    () => orders.reduce((sum, o) => sum + orderTotal(o.items), 0),
    [orders],
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      setCancellingOrderId(orderId);
      const wasAlreadyCancelled =
        orders.find((o) => o.id === orderId)?.status === "CANCELLED";
      try {
        const res = await fetch(`/api/app/admin/orders/${orderId}`, {
          method: "DELETE",
          credentials: "include",
          headers: { accept: "application/json" },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Failed to delete order");
        toast.success(wasAlreadyCancelled ? "Order deleted" : "Order cancelled");
        loadOrders();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to delete order");
      } finally {
        setCancellingOrderId(null);
      }
    },
    [loadOrders, orders],
  );

  const handleOrderCreated = useCallback(() => {
    setSheetOpen(false);
    loadOrders();
  }, [loadOrders]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PPE & Tools Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage foreman orders and import BuildSmart purchase orders.
          </p>
        </div>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Foreman Orders</TabsTrigger>
          <TabsTrigger value="import">Import BuildSmart PO</TabsTrigger>
        </TabsList>

        {/* ── Foreman Orders Tab ── */}
        <TabsContent value="orders" className="space-y-5 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4 flex-wrap">
              <div className="border rounded px-4 py-3 bg-card">
                <div className="text-xs text-muted-foreground font-medium">Total Orders</div>
                <div className="text-2xl font-bold mt-1">{orders.length}</div>
              </div>
              <div className="border rounded px-4 py-3 bg-card">
                <div className="text-xs text-muted-foreground font-medium">Total Value</div>
                <div className="text-2xl font-bold mt-1">{formatCurrency(totalOrderValue)}</div>
              </div>
            </div>
            <Button onClick={() => setSheetOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </div>

          <div className="border rounded bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Foreman</TableHead>
                    <TableHead className="text-xs font-semibold">Items</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <span className="text-muted-foreground text-sm">Loading orders…</span>
                      </TableCell>
                    </TableRow>
                  ) : orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <span className="text-muted-foreground text-sm">No orders yet</span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => {
                      const isExpanded = expandedOrderId === order.id;
                      const isCancelled = order.status === "CANCELLED";
                      return (
                        <React.Fragment key={order.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() =>
                              setExpandedOrderId(isExpanded ? null : order.id)
                            }
                          >
                            <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
                            <TableCell className="text-sm font-medium">{order.foremanName}</TableCell>
                            <TableCell className="text-sm">
                              {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                            </TableCell>
                            <TableCell className="text-sm font-semibold text-right">
                              {formatCurrency(orderTotal(order.items))}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(order.status)}>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                disabled={cancellingOrderId === order.id}
                                title={isCancelled ? "Permanently delete order" : "Cancel order"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancelDialogOrderId(order.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={6} className="p-0">
                                <div className="px-6 py-3 space-y-2">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Order Items
                                  </div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-xs">Product</TableHead>
                                        <TableHead className="text-xs text-right">Qty</TableHead>
                                        <TableHead className="text-xs text-right">Unit Price</TableHead>
                                        <TableHead className="text-xs text-right">Subtotal</TableHead>
                                        <TableHead className="text-xs">Note</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {order.items.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-transparent">
                                          <TableCell className="text-sm">{item.productName}</TableCell>
                                          <TableCell className="text-sm text-right">{item.quantity}</TableCell>
                                          <TableCell className="text-sm text-right">
                                            {formatCurrency(Number(item.unitPrice))}
                                          </TableCell>
                                          <TableCell className="text-sm font-medium text-right">
                                            {formatCurrency(Number(item.unitPrice) * item.quantity)}
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">
                                            {item.note || "—"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── BuildSmart Import Tab ── */}
        <TabsContent value="import" className="mt-4">
          <BuildSmartImportTab
            foremen={foremen}
            products={products}
            onOrderCreated={loadOrders}
          />
        </TabsContent>
      </Tabs>

      {/* New Order Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-full lg:max-w-[85vw] p-0 overflow-y-auto"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>New Product Order</SheetTitle>
          </SheetHeader>
          <OrdersPOS
            foremen={foremen}
            products={products}
            onOrderCreated={handleOrderCreated}
          />
        </SheetContent>
      </Sheet>

      <ConfirmationDialog
        open={cancelDialogOrderId !== null}
        onOpenChange={(open) => { if (!open) setCancelDialogOrderId(null); }}
        title={
          orders.find((o) => o.id === cancelDialogOrderId)?.status === "CANCELLED"
            ? "Delete Order?"
            : "Cancel Order?"
        }
        description={
          orders.find((o) => o.id === cancelDialogOrderId)?.status === "CANCELLED"
            ? "This will permanently delete the order record. This action cannot be undone."
            : "This will cancel the order and remove any linked deductions. This action cannot be undone."
        }
        onConfirm={() => {
          if (cancelDialogOrderId) {
            cancelOrder(cancelDialogOrderId);
            setCancelDialogOrderId(null);
          }
        }}
        isLoading={cancellingOrderId !== null}
        confirmText={
          orders.find((o) => o.id === cancelDialogOrderId)?.status === "CANCELLED"
            ? "Delete"
            : "Cancel Order"
        }
        variant="destructive"
      />
    </div>
  );
}
