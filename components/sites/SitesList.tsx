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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import CreateSiteForm from "./CreateSiteForm";
import SitesTable, { type SiteRow } from "./SitesTable";
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SitesListProps {
  initialSites: SiteRow[];
}

export default function SitesList({ initialSites }: SitesListProps) {
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
  const [selectedSites, setSelectedSites] = React.useState<SiteRow[]>([]);
  const [exportColumns, setExportColumns] = React.useState<SitesPrintColumns>({
    client: true,
    supervisor: true,
    wages: true,
    material: true,
    total: true,
    created: true,
  });
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [dateFilteredSites, setDateFilteredSites] = React.useState<
    SiteRow[] | null
  >(null);
  const [dateLoading, setDateLoading] = React.useState(false);

  // The effective data set: if date range is applied use date-filtered data, otherwise initialSites
  const effectiveData = dateFilteredSites ?? initialSites;

  async function handleApplyDateRange() {
    if (!dateFrom && !dateTo) {
      setDateFilteredSites(null);
      return;
    }
    setDateLoading(true);
    try {
      const res = await listSites({ q: "", show, take: 300, dateFrom, dateTo });
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
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return effectiveData;
    return effectiveData.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.location && s.location.toLowerCase().includes(q)),
    );
  }, [effectiveData, query]);

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
        <div className="flex items-center gap-2">
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

          {/* From */}
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-34 text-sm dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white"
            />
          </div>

          <span className="text-xs text-zinc-400">→</span>

          {/* To */}
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-34 text-sm dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white"
          />

          <Button
            size="sm"
            onClick={handleApplyDateRange}
            disabled={dateLoading || (!dateFrom && !dateTo)}
            className="h-8 px-3 text-sm"
          >
            {dateLoading ? "Loading..." : "Apply"}
          </Button>

          {dateFilteredSites !== null && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearDateRange}
              className="h-8 px-3 text-sm dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white"
            >
              Clear
            </Button>
          )}

          {/* Divider */}
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />

          {/* Actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            {selectedSites.length > 0 && (
              <span className="text-xs font-medium text-primary mr-1">
                {selectedSites.length} site
                {selectedSites.length === 1 ? "" : "s"} selected
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
              onClick={handleDownloadPdf}
              disabled={pdfGenerating || filtered.length === 0}
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
              disabled={filtered.length === 0}
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
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setExportColumns((prev) => ({
                      ...prev,
                      wages: !prev.wages,
                    }));
                  }}
                >
                  {exportColumns.wages ? "✓ " : ""}Wages
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setExportColumns((prev) => ({
                      ...prev,
                      material: !prev.material,
                    }));
                  }}
                >
                  {exportColumns.material ? "✓ " : ""}Material
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setExportColumns((prev) => ({
                      ...prev,
                      total: !prev.total,
                    }));
                  }}
                >
                  {exportColumns.total ? "✓ " : ""}Total Cost
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setExportColumns((prev) => ({
                      ...prev,
                      created: !prev.created,
                    }));
                  }}
                >
                  {exportColumns.created ? "✓ " : ""}Created Date
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          onSelectionChange={setSelectedSites}
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
