"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OrdersPageClient from "@/components/orders/OrdersPageClient";
import { type AdminForemanDto } from "@/components/orders/OrdersPOS";
import type { AdminProductDto } from "@/components/products/ProductsList";
import MaterialOrdersPage from "../material-orders/page";
import { PlantAssignmentsTab } from "../plant-assignments/page";

const TABS = [
  { value: "ppe-orders", label: "PPE Orders" },
  { value: "material-orders", label: "Paints Orders" },
  { value: "tools-orders", label: "Tools Orders" },
  { value: "plant-orders", label: "Plant Orders" },
];

type AdminForemanApiDto = {
  foremanId: string;
  userId: string;
  name?: string | null;
  email?: string | null;
};

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<string>("ppe-orders");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [ppeCreateTrigger, setPpeCreateTrigger] = useState(0);
  const [paintCreateTrigger, setPaintCreateTrigger] = useState(0);
  const [plantCreateTrigger, setPlantCreateTrigger] = useState(0);
  const [toolsCreateTrigger, setToolsCreateTrigger] = useState(0);

  function createOrder(
    type: "ppe-orders" | "material-orders" | "plant-orders" | "tools-orders",
  ) {
    setActiveTab(type);
    setCreateDialogOpen(false);
    if (type === "ppe-orders") {
      setPpeCreateTrigger((value) => value + 1);
    } else if (type === "material-orders") {
      setPaintCreateTrigger((value) => value + 1);
    } else if (type === "plant-orders") {
      setPlantCreateTrigger((value) => value + 1);
    } else if (type === "tools-orders") {
      setToolsCreateTrigger((value) => value + 1);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="flex items-start justify-between gap-4">
        <div>
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

      <div className="rounded border border-muted/50 bg-card">
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
            <PpeOrdersWrapper createTrigger={ppeCreateTrigger} />
          ) : null}
          {activeTab === "material-orders" ? (
            <MaterialOrdersPage
              createTrigger={paintCreateTrigger}
              hideCreateButton
            />
          ) : null}
          {activeTab === "tools-orders" ? (
            <ToolsOrdersWrapper createTrigger={toolsCreateTrigger} />
          ) : null}
          {activeTab === "plant-orders" ? (
            <PlantAssignmentsTab createTrigger={plantCreateTrigger} />
          ) : null}
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
              onClick={() => createOrder("tools-orders")}
              className="rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-muted/40"
            >
              <div className="font-semibold">Tools Order</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Create a tool order for a foreman.
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

function PpeOrdersWrapper({ createTrigger }: { createTrigger?: number }) {
  const [foremen, setForemen] = useState<AdminForemanDto[]>([]);
  const [products, setProducts] = useState<AdminProductDto[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/app/admin/foremen", { credentials: "include" }).then((r) =>
        r.json(),
      ),
      fetch("/api/app/admin/users?role=ADMIN", { credentials: "include" }).then(
        (r) => r.json(),
      ),
      fetch("/api/app/admin/products?category=PPE", {
        credentials: "include",
      }).then((r) => r.json()),
    ])
      .then(([fRes, aRes, pRes]) => {
        const foremenList: AdminForemanApiDto[] = (fRes.foremen ??
          []) as AdminForemanApiDto[];
        const admins: {
          id: string;
          name?: string | null;
          email?: string | null;
        }[] = (aRes.users ?? []) as any[];

        setForemen([
          ...foremenList.map((f) => ({
            id: f.foremanId,
            userId: f.userId,
            name: f.name ?? "",
            email: f.email ?? "",
            type: "foreman" as const,
          })),
          ...admins.map((u) => ({
            id: u.id,
            userId: u.id,
            name: u.name ?? "",
            email: u.email ?? "",
            type: "admin" as const,
          })),
        ]);
        setProducts(pRes.products ?? []);
      })
      .catch(() => toast.error("Failed to load PPE order data"));
  }, []);

  return (
    <OrdersPageClient
      foremen={foremen}
      products={products}
      category="PPE"
      createTrigger={createTrigger}
      hideHeader
    />
  );
}

function ToolsOrdersWrapper({ createTrigger }: { createTrigger?: number }) {
  const [foremen, setForemen] = useState<AdminForemanDto[]>([]);
  const [products, setProducts] = useState<AdminProductDto[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/app/admin/foremen", { credentials: "include" }).then((r) =>
        r.json(),
      ),
      fetch("/api/app/admin/users?role=ADMIN", { credentials: "include" }).then(
        (r) => r.json(),
      ),
      fetch("/api/app/admin/products?category=TOOL", {
        credentials: "include",
      }).then((r) => r.json()),
    ])
      .then(([fRes, aRes, pRes]) => {
        const foremenList: AdminForemanApiDto[] = (fRes.foremen ??
          []) as AdminForemanApiDto[];
        const admins: {
          id: string;
          name?: string | null;
          email?: string | null;
        }[] = (aRes.users ?? []) as any[];

        setForemen([
          ...foremenList.map((f) => ({
            id: f.foremanId,
            userId: f.userId,
            name: f.name ?? "",
            email: f.email ?? "",
            type: "foreman" as const,
          })),
          ...admins.map((u) => ({
            id: u.id,
            userId: u.id,
            name: u.name ?? "",
            email: u.email ?? "",
            type: "admin" as const,
          })),
        ]);
        setProducts(pRes.products ?? []);
      })
      .catch(() => toast.error("Failed to load tools order data"));
  }, []);

  return (
    <OrdersPageClient
      foremen={foremen}
      products={products}
      category="TOOL"
      createTrigger={createTrigger}
      hideHeader
    />
  );
}
