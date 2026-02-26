"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatCurrency";

export interface AdminProductDto {
  id: string;
  name: string;
  price: string; // decimal string
  isActive: boolean;
}

interface ProductsListProps {
  initialProducts: AdminProductDto[];
}

export default function ProductsList({ initialProducts }: ProductsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] =
    React.useState<AdminProductDto[]>(initialProducts);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  async function reload() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const url =
        "/api/app/admin/products" +
        (params.toString() ? `?${params.toString()}` : "");

      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          accept: "application/json",
        },
      });
      const json = await res.json().catch(() => null as any);
      if (!res.ok) {
        const msg =
          json?.error ||
          json?.message ||
          `Failed to load products (${res.status})`;
        throw new Error(msg);
      }
      if (json?.ok && Array.isArray(json.products)) {
        setProducts(json.products);
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to load products",
      );
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    const handler = () => {
      void reload();
    };
    document.addEventListener("admin-products:reload", handler);
    return () => document.removeEventListener("admin-products:reload", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySearch() {
    const params = new URLSearchParams(window.location.search);
    if (q.trim()) {
      params.set("q", q.trim());
    } else {
      params.delete("q");
    }
    router.push(`?/products?${params.toString()}`.replace("?/?", "/"));
    void reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search products…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-60"
          />
          <Button size="sm" onClick={applySearch} disabled={loading}>
            Search
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setQ("");
              void reload();
            }}
            disabled={loading}
          >
            Clear
          </Button>
        </div>

        <Button
          size="sm"
          variant="default"
          onClick={() => {
            // Fire a custom event so the parent page can open the create dialog
            document.dispatchEvent(new CustomEvent("admin-products:create"));
          }}
        >
          Add Product
        </Button>
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-32">Price</TableHead>
              <TableHead className="w-28">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground"
                >
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{formatCurrency(Number(p.price))}</TableCell>
                  <TableCell>
                    {p.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Inactive
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
