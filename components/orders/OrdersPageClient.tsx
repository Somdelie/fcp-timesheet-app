"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { Badge } from "@/components/ui/badge";
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

interface OrdersPageClientProps {
  foremen: AdminForemanDto[];
  products: AdminProductDto[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusBadgeVariant(status: string) {
  switch (status) {
    case "APPLIED":
      return "default" as const;
    case "PENDING":
      return "secondary" as const;
    case "PARTIALLY_APPLIED":
      return "outline" as const;
    case "CANCELLED":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
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
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function OrdersPageClient({
  foremen,
  products,
}: OrdersPageClientProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null,
  );
  const [cancelDialogOrderId, setCancelDialogOrderId] = useState<string | null>(
    null,
  );

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
      try {
        const res = await fetch(`/api/app/admin/orders/${orderId}`, {
          method: "DELETE",
          credentials: "include",
          headers: { accept: "application/json" },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Failed to cancel order");
        toast.success("Order cancelled");
        loadOrders();
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to cancel order");
      } finally {
        setCancellingOrderId(null);
      }
    },
    [loadOrders],
  );

  const handleOrderCreated = useCallback(() => {
    setSheetOpen(false);
    loadOrders();
  }, [loadOrders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PPE Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage ppe orders for foremen — orders are automatically applied as
            deductions.
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-4 flex-wrap">
        <div className="border rounded px-4 py-3 bg-card">
          <div className="text-xs text-muted-foreground font-medium">
            Total Orders
          </div>
          <div className="text-2xl font-bold mt-1">{orders.length}</div>
        </div>
        <div className="border rounded px-4 py-3 bg-card">
          <div className="text-xs text-muted-foreground font-medium">
            Total Value
          </div>
          <div className="text-2xl font-bold mt-1">
            {formatCurrency(totalOrderValue)}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="border rounded bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Date</TableHead>
                <TableHead className="text-xs font-semibold">Foreman</TableHead>
                <TableHead className="text-xs font-semibold">Items</TableHead>
                <TableHead className="text-xs font-semibold text-right">
                  Total
                </TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <span className="text-muted-foreground text-sm">
                      Loading orders…
                    </span>
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <span className="text-muted-foreground text-sm">
                      No orders yet
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  return (
                    <React.Fragment key={order.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() =>
                          setExpandedOrderId(isExpanded ? null : order.id)
                        }
                      >
                        <TableCell className="text-sm">
                          {formatDate(order.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {order.foremanName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {order.items.length} item
                          {order.items.length !== 1 ? "s" : ""}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-right">
                          {formatCurrency(orderTotal(order.items))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(order.status)}>
                            {order.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={5} className="p-0">
                            <div className="px-6 py-3 space-y-2">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Order Items
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-xs">
                                      Product
                                    </TableHead>
                                    <TableHead className="text-xs text-right">
                                      Qty
                                    </TableHead>
                                    <TableHead className="text-xs text-right">
                                      Unit Price
                                    </TableHead>
                                    <TableHead className="text-xs text-right">
                                      Subtotal
                                    </TableHead>
                                    <TableHead className="text-xs">
                                      Note
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {order.items.map((item) => (
                                    <TableRow
                                      key={item.id}
                                      className="hover:bg-transparent"
                                    >
                                      <TableCell className="text-sm">
                                        {item.productName}
                                      </TableCell>
                                      <TableCell className="text-sm text-right">
                                        {item.quantity}
                                      </TableCell>
                                      <TableCell className="text-sm text-right">
                                        {formatCurrency(Number(item.unitPrice))}
                                      </TableCell>
                                      <TableCell className="text-sm font-medium text-right">
                                        {formatCurrency(
                                          Number(item.unitPrice) *
                                            item.quantity,
                                        )}
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
                      {isExpanded && order.status !== "CANCELLED" && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={5}>
                            <div className="flex justify-end">
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={cancellingOrderId === order.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancelDialogOrderId(order.id);
                                }}
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                {cancellingOrderId === order.id
                                  ? "Cancelling…"
                                  : "Cancel Order"}
                              </Button>
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
        onOpenChange={(open) => {
          if (!open) setCancelDialogOrderId(null);
        }}
        title="Cancel Order?"
        description="This will cancel the order and remove any linked deductions. This action cannot be undone."
        onConfirm={() => {
          if (cancelDialogOrderId) {
            cancelOrder(cancelDialogOrderId);
            setCancelDialogOrderId(null);
          }
        }}
        isLoading={cancellingOrderId !== null}
        confirmText="Cancel Order"
        variant="destructive"
      />
    </div>
  );
}
