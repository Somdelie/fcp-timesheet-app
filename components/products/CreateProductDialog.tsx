"use client";

import * as React from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CreateProductDialog() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const handler = () => {
      setOpen(true);
    };
    document.addEventListener("admin-products:create", handler);
    return () => document.removeEventListener("admin-products:create", handler);
  }, []);

  async function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedPrice = price.trim();

    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }
    if (!trimmedPrice) {
      toast.error("Price is required");
      return;
    }

    const n = Number(trimmedPrice.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Price must be a positive number");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/app/admin/products", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ name: trimmedName, price: trimmedPrice }),
      });
      const json = await res.json().catch(() => null as any);
      if (!res.ok) {
        const msg =
          json?.error ||
          json?.message ||
          `Failed to create product (${res.status})`;
        throw new Error(msg);
      }

      toast.success("Product created");
      setName("");
      setPrice("");
      setOpen(false);
      // Notify any listeners (e.g. ProductsList) to refresh
      document.dispatchEvent(new CustomEvent("admin-products:reload"));
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to create product",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
          <DialogDescription>
            Create a new product that can be used for product-based deductions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Safety boots"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Price</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 100.00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
