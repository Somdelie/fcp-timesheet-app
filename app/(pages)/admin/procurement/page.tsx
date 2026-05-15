"use client";

import { useState, useEffect } from "react";
import ProcurementProductsPage from "../procurement-products/page";

type Supplier = {
  id: string;
  name: string;
  isActive: boolean;
};

export default function ProcurementPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  useEffect(() => {
    fetch("/api/app/admin/suppliers", { credentials: "include" })
      .then((r) => r.json())
      .then((json) => setSuppliers(json.data ?? []));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl items-start gap-4">
      {/* Supplier sidebar */}
      <div className="w-56 shrink-0 sticky top-4">
        <div className="rounded border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Suppliers
            </p>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
            <button
              type="button"
              onClick={() => setSelectedSupplierId("")}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                selectedSupplierId === ""
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              All Suppliers
            </button>
            {suppliers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSupplierId(s.id)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors truncate ${
                  selectedSupplierId === s.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products panel */}
      <div className="min-w-0 flex-1">
        <ProcurementProductsPage supplierId={selectedSupplierId} />
      </div>
    </div>
  );
}
