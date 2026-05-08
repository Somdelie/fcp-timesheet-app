"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuppliersPage from "../suppliers/page";
import CategoriesPage from "../product-categories/page";
import ProcurementProductsPage from "../procurement-products/page";
import SupplierPricesPage from "../supplier-prices/page";

const TABS = [
  { value: "materials", label: "Paints & Tools" },
  { value: "suppliers", label: "Suppliers" },
  { value: "categories", label: "Categories" },
  { value: "supplier-prices", label: "Supplier Prices" },
];

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<string>("materials");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Procurement</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Manage paints, tools, suppliers, categories, and supplier pricing from
          a single procurement page.
        </p>
      </div>

      <div className="rounded border border-muted/50 bg-card p-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4">
            <TabsContent value="materials" className="space-y-6">
              {activeTab === "materials" ? <ProcurementProductsPage /> : null}
            </TabsContent>
            <TabsContent value="suppliers" className="space-y-6">
              {activeTab === "suppliers" ? <SuppliersPage /> : null}
            </TabsContent>
            <TabsContent value="categories" className="space-y-6">
              {activeTab === "categories" ? <CategoriesPage /> : null}
            </TabsContent>
            <TabsContent value="supplier-prices" className="space-y-6">
              {activeTab === "supplier-prices" ? <SupplierPricesPage /> : null}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
