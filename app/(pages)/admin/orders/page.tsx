"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PpeOrdersTab } from "@/components/orders/PpeOrdersTab";
import MaterialOrdersPage from "../material-orders/page";
import { PlantAssignmentsTab } from "../plant-assignments/page";

const TABS = [
  { value: "ppe-orders", label: "PPE Orders" },
  { value: "material-orders", label: "Paints Orders" },
  { value: "tools-orders", label: "Tools Orders" },
  { value: "plant-orders", label: "Plant Orders" },
];

type OrderItem = {
  id: string;
  productName: string;
  productCategory: "PPE" | "TOOL" | null;
  quantity: number;
  unitPrice: string;
};

type ToolOrder = {
  id: string;
  foremanName: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
};

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<string>("ppe-orders");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [ppeCreateTrigger, setPpeCreateTrigger] = useState(0);
  const [paintCreateTrigger, setPaintCreateTrigger] = useState(0);

  function createOrder(
    type: "ppe-orders" | "material-orders" | "plant-orders",
  ) {
    setActiveTab(type);
    setCreateDialogOpen(false);
    if (type === "ppe-orders") {
      setPpeCreateTrigger((value) => value + 1);
    } else if (type === "material-orders") {
      setPaintCreateTrigger((value) => value + 1);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Centralised order management for PPE, paints, tools and plant
            orders.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Order
        </Button>
      </div>

      <div className="rounded border border-muted/50 bg-card p-4">
        <div className="flex gap-1 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-6">
          {activeTab === "ppe-orders" ? (
            <PpeOrdersTab createTrigger={ppeCreateTrigger} hideCreateButton />
          ) : null}
          {activeTab === "material-orders" ? (
            <MaterialOrdersPage
              createTrigger={paintCreateTrigger}
              hideCreateButton
            />
          ) : null}
          {activeTab === "tools-orders" ? <ToolsOrdersTab /> : null}
          {activeTab === "plant-orders" ? <PlantAssignmentsTab /> : null}
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Order</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => createOrder("ppe-orders")}
              className="rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
            >
              <div className="font-semibold">PPE Order</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Create PPE orders for foremen and supervisors.
              </div>
            </button>
            <button
              type="button"
              onClick={() => createOrder("material-orders")}
              className="rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
            >
              <div className="font-semibold">Paints Order</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Create a paint/material order for a site.
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("tools-orders");
                setCreateDialogOpen(false);
              }}
              className="rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
            >
              <div className="font-semibold">Tools Order</div>
              <div className="mt-1 text-sm text-muted-foreground">
                View and manage tool orders from the tools tab.
              </div>
            </button>
            <button
              type="button"
              onClick={() => createOrder("plant-orders")}
              className="rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
            >
              <div className="font-semibold">Plant Order</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Open the plant deployments list.
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "R 0.00";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(amount);
}

function ToolsOrdersTab() {
  const [orders, setOrders] = useState<ToolOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/app/admin/orders?category=TOOL", {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json?.error ?? "Failed to load tools orders");
      setOrders(json.orders ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="icon" onClick={load}>
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          Loading tools orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="mx-auto h-8 w-8 mb-2 opacity-40" />
          <p className="font-semibold">No tools orders found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tool orders will appear here once orders contain tool items.
          </p>
        </div>
      ) : (
        <div className="rounded border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const toolItems = order.items.filter(
                  (item) => item.productCategory === "TOOL",
                );
                const total = toolItems.reduce(
                  (sum, item) => sum + Number(item.unitPrice) * item.quantity,
                  0,
                );
                return (
                  <TableRow key={order.id}>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell className="font-medium">
                      {order.foremanName}
                    </TableCell>
                    <TableCell>
                      {toolItems.length} item{toolItems.length !== 1 ? "s" : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{order.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatMoney(String(total))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
