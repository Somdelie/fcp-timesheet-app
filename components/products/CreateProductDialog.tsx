"use client";

import * as React from "react";
import { ProductFormDialog } from "./ProductFormDialog";

type StockCategory = "PPE" | "TOOL";

export function CreateProductDialog() {
  const [open, setOpen] = React.useState(false);
  const [defaultCategory, setDefaultCategory] = React.useState<StockCategory>("PPE");

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ category?: StockCategory }>).detail;
      setDefaultCategory(detail?.category ?? "PPE");
      setOpen(true);
    };
    document.addEventListener("admin-products:create", handler);
    return () => document.removeEventListener("admin-products:create", handler);
  }, []);

  return (
    <ProductFormDialog
      open={open}
      onOpenChange={setOpen}
      defaultCategory={defaultCategory}
      onSaved={() => document.dispatchEvent(new CustomEvent("admin-products:reload"))}
    />
  );
}
