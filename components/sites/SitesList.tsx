"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { Search, Plus, Download } from "lucide-react";

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
import { requestSiteGroupPhoto } from "@/actions/sites";
import { useUserRole } from "@/lib/user-role-context";
import { generateSitesPdf, downloadPdfBlob } from "@/lib/generateSitesPdf";

interface SitesListProps {
  initialSites: SiteRow[];
}

export default function SitesList({ initialSites }: SitesListProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const role = useUserRole();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const q = sp.get("q") ?? "";
  const show = (sp.get("show") ?? "active") as "active" | "all";
  const [query, setQuery] = React.useState(q);

  const [photoDialogOpen, setPhotoDialogOpen] = React.useState(false);
  const [photoSite, setPhotoSite] = React.useState<SiteRow | null>(null);
  const [photoWorkDate, setPhotoWorkDate] = React.useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [photoDueDate, setPhotoDueDate] = React.useState<string>("");
  const [photoNote, setPhotoNote] = React.useState<string>("");
  const [photoSubmitting, setPhotoSubmitting] = React.useState(false);
  const [pdfGenerating, setPdfGenerating] = React.useState(false);

  React.useEffect(() => setQuery(q), [q]);

  async function handleDownloadPdf() {
    if (filtered.length === 0) {
      toast.error("No sites to export");
      return;
    }
    setPdfGenerating(true);
    try {
      const pdfBytes = await generateSitesPdf(filtered);
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

  function updateUrl(next: { q?: string; show?: "active" | "all" }) {
    const params = new URLSearchParams(sp.toString());
    if (next.q !== undefined) {
      const v = next.q.trim();
      if (v) params.set("q", v);
      else params.delete("q");
    }
    if (next.show) params.set("show", next.show);
    router.push(`/sites?${params.toString()}`);
  }

  const filtered = initialSites;

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

      {/* Controls */}
      <div className="mb-2 rounded border border-zinc-200/50 bg-white/80 backdrop-blur-sm p-3 shadow-sm transition-all hover:shadow-md dark:border-zinc-700/50 dark:bg-card/40">
        <div className="flex flex-col gap-4 sm:flex-row items-end sm:justify-between">
          <div className="flex-3">
            <label
              htmlFor="search"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2"
            >
              Search Sites Manage and organize all your work sites in one place.
              Use the search to quickly find sites by name, code, or location.
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <Input
                  id="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateUrl({ q: query });
                  }}
                  placeholder="Search by name, code, location..."
                  className="h-10 pl-9 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
                />
              </div>
              <Button
                variant="outline"
                className="h-10 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
                onClick={handleDownloadPdf}
                disabled={pdfGenerating || filtered.length === 0}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
            {/* <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {filtered.length} site{filtered.length === 1 ? "" : "s"} found
              </p> */}
          </div>

          <div className="flex flex-1 gap-2">
            <Button
              variant={show === "active" ? "default" : "outline"}
              className="h-10 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
              onClick={() => updateUrl({ show: "active" })}
            >
              Active
            </Button>
            <Button
              variant={show === "all" ? "default" : "outline"}
              className="h-10 dark:border-zinc-700/50 dark:bg-zinc-800/50 dark:text-white dark:hover:bg-zinc-700/50"
              onClick={() => updateUrl({ show: "all" })}
            >
              All
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" size="lg">
                  <Plus className="h-4 w-4" />
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
