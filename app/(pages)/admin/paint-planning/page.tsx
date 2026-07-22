"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  listPaintPlans,
  listSitesForSelect,
  listProductsForSelect,
} from "@/actions/paint-planning";
import { SearchableSelect } from "@/components/paint-planning/SearchableSelect";
import PaintPlansTable from "@/components/paint-planning/PaintPlansTable";
import { Search, Plus, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  PaintPlan,
  SiteOption,
  ProductOption,
} from "@/types/paint-planning";

export default function PaintPlanningPage() {
  const pathname = usePathname();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [plans, setPlans] = useState<PaintPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState("");
  const [filterSiteId, setFilterSiteId] = useState<string>("");
  const [filterProductId, setFilterProductId] = useState<string>("");

  const loadPlans = useCallback(async () => {
    const filters: Record<string, string> = {};
    if (filterSiteId) filters.siteId = filterSiteId;
    if (filterProductId) filters.productId = filterProductId;
    const res = await listPaintPlans(filters);
    if (res.ok) setPlans(res.plans);
  }, [filterSiteId, filterProductId]);

  useEffect(() => {
    async function init() {
      const [sitesRes, productsRes] = await Promise.all([
        listSitesForSelect(),
        listProductsForSelect(),
      ]);
      if (sitesRes.ok) setSites(sitesRes.sites);
      if (productsRes.ok) setProducts(productsRes.products);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // Client-side text filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(
      (p) =>
        p.description.toLowerCase().includes(q) ||
        p.site.name.toLowerCase().includes(q) ||
        (p.site.code && p.site.code.toLowerCase().includes(q)) ||
        p.product.name.toLowerCase().includes(q) ||
        (p.boqReference && p.boqReference.toLowerCase().includes(q)),
    );
  }, [plans, query]);

  const returnTo =
    pathname === "/admin/sites-operations"
      ? "/admin/sites-operations?tab=paint-planning"
      : "/admin/paint-planning";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      {/* Toolbar bar — matches Sites pattern */}
      <div className="rounded border border-zinc-200/50 bg-white/80 backdrop-blur-sm px-3 py-2 shadow-sm transition-all hover:shadow-md dark:border-zinc-700/50 dark:bg-card/40">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plans..."
              className="h-8 pl-8 text-sm dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
            />
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

          {/* Site filter */}
          <div className="w-48">
            <SearchableSelect
              value={filterSiteId}
              onValueChange={setFilterSiteId}
              placeholder="All sites"
              options={sites.map((s) => ({
                value: s.id,
                label: s.name + (s.code ? ` (${s.code})` : ""),
              }))}
            />
          </div>

          {/* Product filter */}
          <div className="w-48">
            <SearchableSelect
              value={filterProductId}
              onValueChange={setFilterProductId}
              placeholder="All products"
              options={products.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />
          </div>

          {/* Actions — right side */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Link
              href={`/admin/paint-planning/new?returnTo=${encodeURIComponent(returnTo)}`}
            >
              <Button size="sm" className="h-8 gap-1.5 px-3">
                <Plus className="h-3.5 w-3.5" />
                New Paint Plan
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Table or empty state */}
      {filtered.length === 0 && plans.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
          <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-slate-950 flex items-center justify-center mb-4">
            <Paintbrush className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            No paint plans yet
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Create a new paint plan to start tracking paint requirements and
            usage.
          </p>
          <Link
            href={`/admin/paint-planning/new?returnTo=${encodeURIComponent(returnTo)}`}
          >
            <Button size="sm" className="mt-4 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New Paint Plan
            </Button>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
          <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-slate-950 flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            No plans found
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <PaintPlansTable data={filtered} onRefresh={loadPlans} />
      )}
    </div>
  );
}
