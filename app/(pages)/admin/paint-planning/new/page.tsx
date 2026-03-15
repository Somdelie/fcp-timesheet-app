"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  listSitesForSelect,
  listProductsForSelect,
  listCoverageProfiles,
} from "@/actions/paint-planning";
import { PaintPlanningForm } from "@/components/paint-planning/PaintPlanningForm";
import { ArrowLeft } from "lucide-react";
import type {
  SiteOption,
  ProductOption,
  CoverageOption,
} from "@/types/paint-planning";

export default function NewPaintPlanPage() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [coverages, setCoverages] = useState<CoverageOption[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCoverages = useCallback(async () => {
    const res = await listCoverageProfiles();
    if (res.ok) setCoverages(res.coverages);
  }, []);

  useEffect(() => {
    async function init() {
      const [sitesRes, productsRes, coveragesRes] = await Promise.all([
        listSitesForSelect(),
        listProductsForSelect(),
        listCoverageProfiles(),
      ]);
      if (sitesRes.ok) setSites(sitesRes.sites);
      if (productsRes.ok) setProducts(productsRes.products);
      if (coveragesRes.ok) setCoverages(coveragesRes.coverages);
      setLoading(false);
    }
    init();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl py-3">
      {/* Back navigation */}
      <div className="mb-2">
        <Link
          href="/admin/paint-planning"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Paint Plans
        </Link>
      </div>

      {/* Header Card */}
      <div className="mb-4 rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-4 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          New Paint Plan
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Calculate paint requirements and save a plan for tracking usage.
        </p>
      </div>

      {/* Form + Calculator */}
      <PaintPlanningForm
        sites={sites}
        products={products}
        coverages={coverages}
        onPlanCreated={() => router.push("/admin/paint-planning")}
        onCoverageCreated={loadCoverages}
      />
    </div>
  );
}
