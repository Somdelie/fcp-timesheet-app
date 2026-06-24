"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import {
  Search,
  Plus,
  Download,
  Printer,
  CalendarDays,
  SlidersHorizontal,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import SitesTable, {
  SITE_TABLE_COLUMN_OPTIONS,
  type SiteRow,
} from "./SitesTable";
import { requestSiteGroupPhoto, listSites } from "@/actions/sites";
import { useUserRole } from "@/lib/user-role-context";
import {
  generateSitesPdf,
  downloadPdfBlob,
  printSites,
  type SitesPrintColumns,
} from "@/lib/generateSitesPdf";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import CreateSiteForm from "./CreateSiteForm";
import { Input } from "../ui/input";

interface SitesListProps {
  initialSites: SiteRow[];
  supervisorOptions?: Array<{ id: string; name: string; email: string }>;
  adminOptions?: Array<{ id: string; name: string; email: string }>;
  foremanOptions?: Array<{ id: string; name: string; email: string }>;
}

const ALL_SUPERVISORS = "__all_supervisors__";
const UNASSIGNED_SUPERVISOR = "__unassigned_supervisor__";

function formatShortNumber(value: number) {
  return value.toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}

function hasFiniteRange(bounds: [number, number]) {
  return Number.isFinite(bounds[0]) && Number.isFinite(bounds[1]);
}

function clampRange(value: [number, number], bounds: [number, number]) {
  const min = Math.max(bounds[0], Math.min(value[0], bounds[1]));
  const max = Math.max(min, Math.min(value[1], bounds[1]));
  return [min, max] as [number, number];
}

function RangeSlider({
  label,
  value,
  bounds,
  step,
  valuePrefix = "",
  valueSuffix = "",
  onChange,
}: {
  label: string;
  value: [number, number];
  bounds: [number, number];
  step: number;
  valuePrefix?: string;
  valueSuffix?: string;
  onChange: (value: [number, number]) => void;
}) {
  const [minBound, maxBound] = bounds;
  const [minValue, maxValue] = value;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {valuePrefix}
          {formatShortNumber(minValue)}
          {valueSuffix} - {valuePrefix}
          {formatShortNumber(maxValue)}
          {valueSuffix}
        </span>
      </div>
      <div className="relative h-8">
        <input
          type="range"
          min={minBound}
          max={maxBound}
          step={step}
          value={minValue}
          onChange={(e) => {
            const next = Math.min(Number(e.target.value), maxValue);
            onChange([next, maxValue]);
          }}
          className="absolute inset-x-0 top-2 h-2 w-full accent-primary"
        />
        <input
          type="range"
          min={minBound}
          max={maxBound}
          step={step}
          value={maxValue}
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), minValue);
            onChange([minValue, next]);
          }}
          className="absolute inset-x-0 top-2 h-2 w-full accent-primary"
        />
      </div>
    </div>
  );
}

// pnpm prisma migrate deploy

// # Or with npx if you prefer:
// npx prisma migrate deploy

// # Then regenerate the client
// pnpm prisma generate
// # or
// npx prisma generate

export default function SitesList({
  initialSites,
  supervisorOptions = [],
  adminOptions = [],
  foremanOptions = [],
}: SitesListProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const role = useUserRole();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const show = (sp.get("show") ?? "active") as "active" | "all";
  const [query, setQuery] = React.useState("");

  const [photoDialogOpen, setPhotoDialogOpen] = React.useState(false);
  const [photoSite, setPhotoSite] = React.useState<SiteRow | null>(null);
  const [photoWorkDate, setPhotoWorkDate] = React.useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [photoDueDate, setPhotoDueDate] = React.useState<string>("");
  const [photoNote, setPhotoNote] = React.useState<string>("");
  const [photoSubmitting, setPhotoSubmitting] = React.useState(false);
  const [pdfGenerating, setPdfGenerating] = React.useState(false);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [dateFilteredSites, setDateFilteredSites] = React.useState<
    SiteRow[] | null
  >(null);
  const [dateLoading, setDateLoading] = React.useState(false);
  const [claimFilter, setClaimFilter] = React.useState<
    "all" | "has" | "missing"
  >("all");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "NOT_STARTED" | "ONGOING" | "COMPLETED" | "ON_HOLD"
  >("ONGOING");
  const [supervisorFilter, setSupervisorFilter] =
    React.useState(ALL_SUPERVISORS);
  const [costRange, setCostRange] = React.useState<[number, number] | null>(
    null,
  );
  const [profitPctRange, setProfitPctRange] = React.useState<
    [number, number] | null
  >(null);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(() => {
      const hiddenByDefault = new Set([
        "daysWorked",
        "claimOutstanding",
        "claimPaidToDate",
        "siteClaimDate",
        "profitLoss",
      ]);

      return Object.fromEntries(
        SITE_TABLE_COLUMN_OPTIONS.map(({ id }) => [id, !hiddenByDefault.has(id)]),
      );
    });
  const exportColumns = React.useMemo<SitesPrintColumns>(
    () => ({
      code: columnVisibility.code !== false,
      name: columnVisibility.name !== false,
      client: columnVisibility.client !== false,
      claimDate: columnVisibility.siteClaimDate !== false,
      supervisor: columnVisibility.supervisorName !== false,
      daysWorked: columnVisibility.daysWorked !== false,
      wages: columnVisibility.totalWages !== false,
      material: columnVisibility.totalMaterialCost !== false,
      total: columnVisibility.totalCost !== false,
      amountClaimed: columnVisibility.amountClaimed !== false,
      paidToDate: columnVisibility.claimPaidToDate !== false,
      outstanding: columnVisibility.claimOutstanding !== false,
      profitLoss: columnVisibility.profitLoss !== false,
      created: false,
    }),
    [columnVisibility],
  );

  // The effective data set: if date range is applied use date-filtered data, otherwise initialSites
  const effectiveData = dateFilteredSites ?? initialSites;
  const siteById = React.useMemo(
    () => new Map(effectiveData.map((site) => [site.id, site])),
    [effectiveData],
  );
  const selectedSites = React.useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => siteById.get(id))
        .filter((site): site is SiteRow => Boolean(site)),
    [rowSelection, siteById],
  );

  const supervisorFilterOptions = React.useMemo(() => {
    return Array.from(
      new Set(
        effectiveData
          .map((site) => site.supervisorName?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    ).sort((left, right) => left.localeCompare(right));
  }, [effectiveData]);

  React.useEffect(() => {
    if (
      supervisorFilter !== ALL_SUPERVISORS &&
      supervisorFilter !== UNASSIGNED_SUPERVISOR &&
      !supervisorFilterOptions.includes(supervisorFilter)
    ) {
      setSupervisorFilter(ALL_SUPERVISORS);
    }
  }, [supervisorFilter, supervisorFilterOptions]);

  async function handleApplyDateRange() {
    if (!dateFrom && !dateTo) {
      setDateFilteredSites(null);
      return;
    }
    setDateLoading(true);
    try {
      const res = await listSites({ q: query, show, dateFrom, dateTo });
      if (res.ok) setDateFilteredSites(res.sites);
    } catch {
      toast.error("Failed to filter by date");
    } finally {
      setDateLoading(false);
    }
  }

  function handleClearDateRange() {
    setDateFrom("");
    setDateTo("");
    setDateFilteredSites(null);
  }

  // Determine the sites to print/download: selected sites if any, otherwise all filtered
  function getSitesForExport() {
    return selectedSites.length > 0 ? selectedSites : filtered;
  }

  async function handleDownloadPdf() {
    const exportSites = getSitesForExport();
    if (exportSites.length === 0) {
      toast.error("No sites to export");
      return;
    }
    setPdfGenerating(true);
    try {
      const pdfBytes = await generateSitesPdf(exportSites, exportColumns);
      const filename = `sites-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadPdfBlob(pdfBytes, filename);
      toast.success("PDF downloaded");
    } catch (err: any) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfGenerating(false);
    }
  }

  function updateUrl(next: { show?: "active" | "all" }) {
    const params = new URLSearchParams();
    if (next.show) params.set("show", next.show);
    router.push(`/sites?${params.toString()}`);
  }

  /** Pure client-side filtering — instant, no server round-trips */
  // Apply search filter first
  const searchFiltered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return effectiveData;
    return effectiveData.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.location && s.location.toLowerCase().includes(q)),
    );
  }, [effectiveData, query]);

  const supervisorFiltered = React.useMemo(() => {
    if (supervisorFilter === ALL_SUPERVISORS) return searchFiltered;
    if (supervisorFilter === UNASSIGNED_SUPERVISOR) {
      return searchFiltered.filter((site) => !site.supervisorName?.trim());
    }
    return searchFiltered.filter(
      (site) => site.supervisorName?.trim() === supervisorFilter,
    );
  }, [searchFiltered, supervisorFilter]);

  // Then apply claim-date filter (running vs not-running)
  const claimFiltered = React.useMemo(() => {
    if (claimFilter === "all") return supervisorFiltered;
    return supervisorFiltered.filter((s) => {
      const hasClaim = !!s.siteClaimDate;
      return claimFilter === "has" ? hasClaim : !hasClaim;
    });
  }, [supervisorFiltered, claimFilter]);

  // Then apply job status filter
  const statusFiltered = React.useMemo(() => {
    if (statusFilter === "all") return claimFiltered;
    return claimFiltered.filter((s) => s.jobStatus === statusFilter);
  }, [claimFiltered, statusFilter]);

  const costBounds = React.useMemo<[number, number]>(() => {
    const values = statusFiltered.map(
      (site) => (site.totalWages ?? 0) + (site.totalMaterialCost ?? 0),
    );
    const max = Math.max(0, ...values);
    return [0, Math.max(1000, Math.ceil(max / 1000) * 1000)];
  }, [statusFiltered]);

  const profitPctBounds = React.useMemo<[number, number]>(() => {
    const values = statusFiltered
      .map((site) => {
        const totalCost =
          (site.totalWages ?? 0) + (site.totalMaterialCost ?? 0);
        const claimed = site.amountClaimed ?? 0;
        return claimed > 0 ? ((claimed - totalCost) / claimed) * 100 : null;
      })
      .filter((value): value is number => value !== null);
    if (values.length === 0) return [-100, 100];
    const min = Math.floor(Math.min(...values) / 10) * 10;
    const max = Math.ceil(Math.max(...values) / 10) * 10;
    return [Math.min(-100, min), Math.max(100, max)];
  }, [statusFiltered]);

  const activeCostRange = costRange ? clampRange(costRange, costBounds) : costBounds;
  const activeProfitPctRange = profitPctRange
    ? clampRange(profitPctRange, profitPctBounds)
    : profitPctBounds;
  const activeRangeFilterCount =
    (costRange ? 1 : 0) + (profitPctRange ? 1 : 0);
  const activeFilterCount =
    activeRangeFilterCount + (dateFilteredSites !== null ? 1 : 0);

  const filtered = React.useMemo(() => {
    return statusFiltered.filter((site) => {
      const totalCost =
        (site.totalWages ?? 0) + (site.totalMaterialCost ?? 0);
      const claimed = site.amountClaimed ?? 0;
      const profitPct =
        claimed > 0 ? ((claimed - totalCost) / claimed) * 100 : null;

      if (costRange && totalCost < activeCostRange[0]) return false;
      if (costRange && totalCost > activeCostRange[1]) return false;
      if (
        profitPctRange &&
        (profitPct === null || profitPct < activeProfitPctRange[0])
      )
        return false;
      if (
        profitPctRange &&
        (profitPct === null || profitPct > activeProfitPctRange[1])
      )
        return false;
      return true;
    });
  }, [
    statusFiltered,
    costRange,
    profitPctRange,
    activeCostRange,
    activeProfitPctRange,
  ]);

  async function handleSubmitPhotoRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!photoSite) {
      toast.error("No site selected");
      return;
    }
    if (!photoWorkDate) {
      toast.error("Please choose a work date");
      return;
    }

    setPhotoSubmitting(true);
    try {
      const res = await requestSiteGroupPhoto({
        siteId: photoSite.id,
        workDate: photoWorkDate,
        note: photoNote || undefined,
        dueDate: photoDueDate || undefined,
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to create photo request");
        return;
      }

      toast.success(
        res.count === 1
          ? "Photo request sent to foreman."
          : `Photo requests sent to ${res.count} foremen.`,
      );
      setPhotoDialogOpen(false);
      setPhotoNote("");
      setPhotoDueDate("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create photo request");
    } finally {
      setPhotoSubmitting(false);
    }
  }

  return (
    <div className="">
      {/* Header */}

      <div className="mb-2 rounded border border-zinc-200/50 bg-white/80 backdrop-blur-sm px-3 py-2 shadow-sm transition-all hover:shadow-md dark:border-zinc-700/50 dark:bg-card/40">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <Input
              id="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="h-8 pl-8 text-sm dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
            />
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

          <div className="flex items-center gap-1.5">
            <Select
              value={supervisorFilter}
              onValueChange={setSupervisorFilter}
            >
              <SelectTrigger className="h-8 w-48 text-xs md:text-sm dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white">
                <SelectValue placeholder="Supervisor" />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value={ALL_SUPERVISORS}>All supervisors</SelectItem>
                <SelectItem value={UNASSIGNED_SUPERVISOR}>
                  Unassigned
                </SelectItem>
                {supervisorFilterOptions.map((supervisorName, index) => (
                  <SelectItem
                    key={`${supervisorName ?? "unknown"}-${index}`}
                    value={supervisorName}
                  >
                    {supervisorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-5 p-4" align="end">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <CalendarDays className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                  <span>Date range</span>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 text-sm dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white"
                  />
                  <span className="text-xs text-zinc-400">to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 text-sm dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  {dateFilteredSites !== null && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleClearDateRange}
                      className="h-8 px-3 text-sm dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white"
                    >
                      Clear dates
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyDateRange}
                    disabled={dateLoading || (!dateFrom && !dateTo)}
                    className="h-8 px-3 text-sm"
                  >
                    {dateLoading ? "Loading..." : "Apply dates"}
                  </Button>
                </div>
              </div>

              <div className="border-t" />

              {hasFiniteRange(costBounds) && (
                <RangeSlider
                  label="Total cost"
                  bounds={costBounds}
                  value={activeCostRange}
                  step={1000}
                  valuePrefix="R "
                  onChange={setCostRange}
                />
              )}

              {hasFiniteRange(profitPctBounds) && (
                <RangeSlider
                  label="Profit / Loss"
                  bounds={profitPctBounds}
                  value={activeProfitPctRange}
                  step={1}
                  valueSuffix="%"
                  onChange={setProfitPctRange}
                />
              )}

              <div className="flex justify-end border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCostRange(null);
                    setProfitPctRange(null);
                  }}
                  disabled={activeRangeFilterCount === 0}
                >
                  Reset ranges
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Claim date filter */}
          {/* <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <Select
              value={claimFilter}
              onValueChange={(value) =>
                setClaimFilter(value as "all" | "has" | "missing")
              }
            >
              <SelectTrigger className="h-8 w-40 text-xs md:text-sm dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white">
                <SelectValue
                  placeholder="Claim status"
                  aria-label="Filter by claim status"
                />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="all">All sites</SelectItem>
                <SelectItem value="has">With claim date</SelectItem>
                <SelectItem value="missing">
                  No claim date (not running)
                </SelectItem>
              </SelectContent>
            </Select>
          </div> */}

          {/* Divider */}
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

          {/* Actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            {selectedSites.length > 0 && (
              <button
                type="button"
                onClick={() => setRowSelection({})}
                className="mr-1 text-xs font-medium text-primary hover:underline"
              >
                {selectedSites.length} site
                {selectedSites.length === 1 ? "" : "s"} selected
              </button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
              onClick={handleDownloadPdf}
              disabled={pdfGenerating || getSitesForExport().length === 0}
              title={
                selectedSites.length > 0
                  ? `Download ${selectedSites.length} selected`
                  : "Download all"
              }
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
              onClick={() => {
                const exportSites = getSitesForExport();
                if (exportSites.length === 0) {
                  toast.error("No sites to print");
                  return;
                }
                printSites(exportSites, exportColumns);
              }}
              disabled={getSitesForExport().length === 0}
              title={
                selectedSites.length > 0
                  ? `Print ${selectedSites.length} selected`
                  : "Print all"
              }
            >
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Columns</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {SITE_TABLE_COLUMN_OPTIONS.map(({ id, label }) => (
                  <DropdownMenuCheckboxItem
                    key={id}
                    checked={columnVisibility[id] !== false}
                    onCheckedChange={(checked) => {
                      setColumnVisibility((prev) => ({
                        ...prev,
                        [id]: checked === true,
                      }));
                    }}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(
                  v as
                    | "all"
                    | "NOT_STARTED"
                    | "ONGOING"
                    | "COMPLETED"
                    | "ON_HOLD",
                )
              }
            >
              <SelectTrigger className="h-8 w-36 text-xs md:text-sm dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white">
                <SelectValue placeholder="Job status" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                <SelectItem value="ONGOING">Ongoing</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1.5 px-3">
                  <Plus className="h-3.5 w-3.5" />
                  New Site
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create a New Site</DialogTitle>
                  <DialogDescription>
                    Add a new work site to your organization.
                  </DialogDescription>
                </DialogHeader>
                <CreateSiteForm
                  supervisorOptions={supervisorOptions}
                  adminOptions={adminOptions}
                  onSuccess={() => {
                    setIsDialogOpen(false);
                    router.refresh();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Sites Table */}
      {filtered.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
          <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-slate-950 flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            No sites found
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Try adjusting your search or filters, or create a new site to get
            started.
          </p>
        </div>
      ) : (
        <SitesTable
          data={filtered}
          role={role}
          onRequestPhoto={(site) => {
            setPhotoSite(site);
            setPhotoDialogOpen(true);
          }}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          supervisorOptions={supervisorOptions}
          foremanOptions={foremanOptions}
        />
      )}

      {/* Admin: Random group photo request dialog */}
      {role === "ADMIN" && (
        <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Group Photo</DialogTitle>
              <DialogDescription>
                Ask the assigned foreman(s) to upload a group photo for a
                specific work date.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitPhotoRequest} className="space-y-4">
              <div className="text-sm text-zinc-700 dark:text-zinc-300">
                <div className="font-semibold">
                  Site:{" "}
                  <span className="font-normal">
                    {photoSite ? photoSite.name : "Select from Sites list"}
                  </span>
                </div>
                {photoSite?.code && (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Job Number: {photoSite.code}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Work Date
                </label>
                <Input
                  type="date"
                  value={photoWorkDate}
                  onChange={(e) => setPhotoWorkDate(e.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Photo request will be sent to foreman assignments that were
                  active on this date.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Due Date (optional)
                </label>
                <Input
                  type="date"
                  value={photoDueDate}
                  onChange={(e) => setPhotoDueDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Note to foreman (optional)
                </label>
                <Input
                  value={photoNote}
                  onChange={(e) => setPhotoNote(e.target.value)}
                  placeholder="e.g. Please include all workers on shift."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhotoDialogOpen(false)}
                  disabled={photoSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={photoSubmitting}>
                  {photoSubmitting ? "Sending..." : "Send Request"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
