"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowDownAZ,
  ArrowUpAZ,
  Layers3,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  MasterCatalogueProductActions,
  type CatalogueActionResult,
  type UpdateMasterPricesInput,
  type UpdateMasterProductInput,
} from "@/components/products/MasterCatalogueProductActions";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

export type CataloguePrice = {
  id: string;
  finishId: string | null;
  baseId: string;
  unitSize: string;
  uom: string;
  price: string;
  base: { name: string };
  finish: { name: string } | null;
};

export type MasterCatalogueTableProduct = {
  id: string;
  name: string;
  normalizedName: string;
  category: string;
  usage: "INT" | "EXT" | "INT_EXT";
  description: string;
  isActive: boolean;
  supplier: { name: string };
  finishes: Array<{ id: string; name: string }>;
  bases: Array<{ id: string; name: string }>;
  prices: CataloguePrice[];
};

type MasterCatalogueTableProps = {
  products: MasterCatalogueTableProduct[];
  updateProductAction: (
    input: UpdateMasterProductInput,
  ) => Promise<CatalogueActionResult>;
  updatePricesAction: (
    input: UpdateMasterPricesInput,
  ) => Promise<CatalogueActionResult>;
  toggleProductAction: (
    id: string,
    isActive: boolean,
  ) => Promise<CatalogueActionResult>;
  deleteProductAction: (id: string) => Promise<CatalogueActionResult>;
};

function formatPrice(value: string) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatSize(value: string, uom: string) {
  const amount = Number(value);
  return `${Number.isFinite(amount) ? amount : value}${uom}`;
}

function currentPrices(prices: CataloguePrice[]) {
  const seen = new Set<string>();

  return prices
    .filter((price) => {
      const key = [
        price.finishId ?? "",
        price.baseId,
        price.unitSize,
        price.uom,
      ].join("|");

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const sizeDifference = Number(b.unitSize) - Number(a.unitSize);
      if (sizeDifference !== 0) return sizeDifference;

      return b.base.name.localeCompare(a.base.name, undefined, {
        numeric: true,
      });
    });
}

function groupPricesByBase(prices: CataloguePrice[]) {
  const groups = new Map<
    string,
    { baseId: string; baseName: string; prices: CataloguePrice[] }
  >();

  for (const price of currentPrices(prices)) {
    const existing = groups.get(price.baseId);
    if (existing) {
      existing.prices.push(price);
    } else {
      groups.set(price.baseId, {
        baseId: price.baseId,
        baseName: price.base.name,
        prices: [price],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    b.baseName.localeCompare(a.baseName, undefined, { numeric: true }),
  );
}

function formatUsage(usage: "INT" | "EXT" | "INT_EXT") {
  if (usage === "INT") return "Int";
  if (usage === "EXT") return "Ext";
  return "Int/Ext";
}

export function MasterCatalogueTable({
  products,
  updateProductAction,
  updatePricesAction,
  toggleProductAction,
  deleteProductAction,
}: MasterCatalogueTableProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"active" | "all">("active");
  const [nameSortDirection, setNameSortDirection] = useState<"asc" | "desc">(
    "asc",
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      if (status === "active" && !product.isActive) return false;
      if (!normalizedQuery) return true;

      const searchableText = [
        product.name,
        product.normalizedName,
        product.category,
        formatUsage(product.usage),
        product.supplier.name,
        ...product.finishes.map((finish) => finish.name),
        ...product.bases.map((base) => base.name),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [products, query, status]);

  const sortedProducts = useMemo(
    () =>
      [...filteredProducts].sort((a, b) => {
        const comparison = a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return nameSortDirection === "asc" ? comparison : -comparison;
      }),
    [filteredProducts, nameSortDirection],
  );

  const pageCount = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);

  const visibleProducts = useMemo(() => {
    const start = safePageIndex * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [sortedProducts, pageSize, safePageIndex]);

  const rangeStart =
    filteredProducts.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const rangeEnd = Math.min(
    (safePageIndex + 1) * pageSize,
    filteredProducts.length,
  );

  return (
    <div className="relative space-y-3">
      <div className="flex items-center gap-4">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPageIndex(0);
            }}
            placeholder="Search name, supplier, finish or base..."
            className="h-8 rounded pl-9"
            aria-label="Search catalogue products"
          />
        </div>

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value === "all" ? "all" : "active");
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="h-8 w-44 rounded">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active products</SelectItem>
            <SelectItem value="all">All products</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-10 rounded"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={isRefreshing}
          aria-label="Refresh catalogue"
          title="Refresh catalogue"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </Button>

        {query || status !== "active" ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded"
            onClick={() => {
              setQuery("");
              setStatus("active");
              setPageIndex(0);
            }}
          >
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        ) : null}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded border border-black bg-white p-12 text-center shadow-sm">
          <Layers3 className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-3 text-lg font-semibold text-slate-900">
            No master catalogue products found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Adjust the search, status or supplier filter.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-black bg-white shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-190 border-collapse text-sm">
              <TableHeader>
                <TableRow className="border-0 bg-primary hover:bg-primary">
                  <TableHead className="h-8 w-[32%] border-r border-slate-300 px-3 text-sm font-semibold text-white">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 px-0 text-sm font-semibold text-white hover:bg-transparent hover:text-white"
                      onClick={() => {
                        setNameSortDirection((direction) =>
                          direction === "asc" ? "desc" : "asc",
                        );
                        setPageIndex(0);
                      }}
                      aria-label={`Sort by name ${nameSortDirection === "asc" ? "descending" : "ascending"}`}
                      title={`Sorted ${nameSortDirection === "asc" ? "A to Z" : "Z to A"}`}
                    >
                      Name
                      {nameSortDirection === "asc" ? (
                        <ArrowDownAZ className="ml-1 h-4 w-4" />
                      ) : (
                        <ArrowUpAZ className="ml-1 h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="h-8 w-[14%] border-r border-slate-300 px-3 text-sm font-semibold text-white">
                    Supplier(s)
                  </TableHead>
                  <TableHead className="h-8 w-[32%] border-r border-slate-300 px-3 text-sm font-semibold text-white">
                    Prices
                  </TableHead>
                  <TableHead className="h-8 w-[16%] border-r border-slate-300 px-3 text-sm font-semibold text-white">
                    Category
                  </TableHead>
                  <TableHead className="h-8 w-12 px-1 text-center text-sm font-semibold text-white">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleProducts.map((product) => {
                  const priceGroups = groupPricesByBase(product.prices);
                  const editablePrices = currentPrices(product.prices);
                  return (
                    <Fragment key={product.id}>
                      <TableRow className="border-0 bg-slate-300 hover:bg-slate-300">
                        <TableCell className="border-r border-t border-slate-400 px-3 py-0 font-bold uppercase text-slate-950">
                          {product.name}
                        </TableCell>
                        <TableCell className="border-r border-t border-slate-400 px-3 py-0 font-bold text-slate-950">
                          {product.supplier.name}
                        </TableCell>
                        <TableCell className="border-r border-t border-slate-400 px-3 py-0 font-bold text-slate-950">
                          {formatUsage(product.usage)}
                        </TableCell>
                        <TableCell className="border-r border-t border-slate-400 px-3 py-0 font-bold text-slate-950">
                          {product.category}
                        </TableCell>
                        <TableCell className="w-12 border-t border-slate-400 px-1 py-0 text-center">
                          <MasterCatalogueProductActions
                            product={{
                              id: product.id,
                              name: product.name,
                              category: product.category,
                              usage: product.usage,
                              description: product.description,
                              isActive: product.isActive,
                              prices: editablePrices,
                            }}
                            updateProductAction={updateProductAction}
                            updatePricesAction={updatePricesAction}
                            toggleProductAction={toggleProductAction}
                            deleteProductAction={deleteProductAction}
                          />
                        </TableCell>
                      </TableRow>

                      {priceGroups.length ? (
                        priceGroups.map((group) => (
                          <TableRow
                            key={group.baseId}
                            className="border-0 bg-white hover:bg-slate-50"
                          >
                            <TableCell className="border-r border-t border-slate-300 px-7 py-0 text-slate-500">
                              {group.baseName}
                            </TableCell>
                            <TableCell className="border-r border-t border-slate-300 px-3 py-0" />
                            <TableCell className="border-r border-t border-slate-300 px-3 py-0 text-slate-600">
                              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                                {group.prices.map((price) => (
                                  <span
                                    key={price.id}
                                    className="whitespace-nowrap"
                                  >
                                    {formatSize(price.unitSize, price.uom)} -{" "}
                                    <strong>{formatPrice(price.price)}</strong>
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="border-r border-t border-slate-300 px-3 py-0" />
                            <TableCell className="w-12 border-t border-slate-300 px-1 py-0" />
                          </TableRow>
                        ))
                      ) : (
                        <TableRow className="border-0 bg-white hover:bg-white">
                          <TableCell className="border-r border-t border-slate-300 px-7 py-0 text-slate-400">
                            No price variants loaded
                          </TableCell>
                          <TableCell className="border-r border-t border-slate-300 px-3 py-0 text-slate-400">
                            -
                          </TableCell>
                          <TableCell className="border-r border-t border-slate-300 px-3 py-0 text-slate-400">
                            -
                          </TableCell>
                          <TableCell className="border-r border-t border-slate-300 px-3 py-0" />
                          <TableCell className="w-12 border-t border-slate-300 px-1 py-0" />
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-300 bg-slate-50 px-4 py-2">
            <div className="text-sm text-slate-500">
              Showing {rangeStart} to {rangeEnd} of {filteredProducts.length}{" "}
              products
            </div>

            <div className="flex flex-wrap items-center gap-4 lg:gap-8">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Rows per page
                </span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPageIndex(0);
                  }}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm font-medium text-slate-700">
                Page {safePageIndex + 1} of {pageCount}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="hidden h-8 w-8 rounded lg:inline-flex"
                  onClick={() => setPageIndex(0)}
                  disabled={safePageIndex === 0}
                  aria-label="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded"
                  onClick={() =>
                    setPageIndex((current) => Math.max(0, current - 1))
                  }
                  disabled={safePageIndex === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded"
                  onClick={() =>
                    setPageIndex((current) =>
                      Math.min(pageCount - 1, current + 1),
                    )
                  }
                  disabled={safePageIndex >= pageCount - 1}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="hidden h-8 w-8 rounded lg:inline-flex"
                  onClick={() => setPageIndex(pageCount - 1)}
                  disabled={safePageIndex >= pageCount - 1}
                  aria-label="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
