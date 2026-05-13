"use client";

import { useState } from "react";
import SuppliersPage from "../suppliers/page";
import ProcurementProductsPage from "../procurement-products/page";
import SupplierPricesPage from "../supplier-prices/page";

const TABS = [
  { value: "paints", label: "Paints" },
  { value: "tools", label: "Tools" },
  { value: "suppliers", label: "Suppliers" },
  { value: "supplier-prices", label: "Supplier Prices" },
];

export default function ProcurementPage() {
  const [activeTab, setActiveTab] = useState<string>("paints");

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="rounded border border-muted/50 bg-card">
        <div className="flex border-b border-border overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === "paints" ? (
            <ProcurementProductsPage defaultProductType="MATERIAL" />
          ) : activeTab === "tools" ? (
            <ProcurementProductsPage defaultProductType="PLANT" />
          ) : activeTab === "suppliers" ? (
            <SuppliersPage />
          ) : activeTab === "supplier-prices" ? (
            <SupplierPricesPage />
          ) : null}
        </div>
      </div>
    </div>
  );
}
