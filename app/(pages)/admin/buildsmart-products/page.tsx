"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package, Search, X, RotateCw, AlertCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "react-toastify";

type ProcurementProduct = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  supplier: { id: string; name: string } | null;
  _count: { orderItems: number; supplierPrices: number };
};

export default function BuildSmartProductsPage() {
  const [products, setProducts] = useState<ProcurementProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("includeInactive", "true");
        const res = await fetch(
          `/api/app/admin/procurement-products?${params.toString()}`,
          {
            credentials: "include",
          },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Failed to load products");
        setProducts(json.data ?? []);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load BuildSmart products");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const buildSmartProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (products || [])
      .filter((p) =>
        (p.description || "").toLowerCase().includes("buildsmart import (po"),
      )
      .filter((p) => {
        if (!term) return true;
        const name = p.name.toLowerCase();
        const sku = p.sku ? p.sku.toLowerCase() : "";
        return name.includes(term) || sku.includes(term);
      });
  }, [products, search]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            BuildSmart Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-created procurement products originating from BuildSmart PDF
            imports.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => location.reload()}>
          <RotateCw className="mr-1 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">
                BuildSmart Imported Products
              </CardTitle>
              <CardDescription>
                These products were created automatically during BuildSmart
                order imports.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64 max-w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-8 h-9"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="border border-dashed border-zinc-300 bg-white/50 p-10 text-center text-sm text-muted-foreground dark:border-zinc-700/50 dark:bg-card/30">
              Loading BuildSmart products...
            </div>
          ) : buildSmartProducts.length === 0 ? (
            <div className="border border-dashed border-zinc-300 bg-white/50 p-10 text-center dark:border-zinc-700/50 dark:bg-card/30">
              <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
              <h3 className="text-lg font-semibold">
                No BuildSmart products found
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                New products will appear here when BuildSmart PDF imports
                auto-create them.
              </p>
            </div>
          ) : (
            <div className="border bg-card overflow-x-auto rounded-md">
              <Table>
                <TableHeader className="bg-muted/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40px]" />
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-center">
                      Used In Orders
                    </TableHead>
                    <TableHead className="text-center">
                      Supplier Prices
                    </TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buildSmartProducts.map((p) => (
                    <TableRow
                      key={p.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                    >
                      <TableCell className="w-[40px]">
                        {p.thumbnailUrl ? (
                          <img
                            src={p.thumbnailUrl}
                            alt={p.name}
                            className="h-9 w-9 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded bg-muted">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="font-medium flex items-center gap-2">
                            {p.name}
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase"
                            >
                              BuildSmart
                            </Badge>
                          </div>
                          {p.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {p.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{p.sku || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {p.supplier ? (
                          p.supplier.name
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {p._count.orderItems > 0 ? (
                          <span>{p._count.orderItems}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {p._count.supplierPrices > 0 ? (
                          <span>{p._count.supplierPrices}</span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1 text-xs text-amber-600">
                            <AlertCircle className="h-3 w-3" />
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.isActive ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs bg-zinc-100 text-zinc-600 border-zinc-300"
                          >
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next steps</CardTitle>
          <CardDescription>
            Use the main procurement products page to edit or merge these
            auto-created items.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/procurement-products">
              Open procurement products
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground max-w-xl">
            BuildSmart imports will continue to create products when no matching
            item is found. You can update pricing and other details from the
            procurement products screen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
