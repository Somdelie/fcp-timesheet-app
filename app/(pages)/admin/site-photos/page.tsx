"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Loader2,
  ImageIcon,
  RefreshCw,
  X,
  Check,
  XCircle,
  MapPin,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SitePhoto {
  id: string;
  imageUrl: string;
  dateTakenISO: string;
  uploadedAtISO: string;
  siteName: string;
  siteId: string;
  foremanName: string;
  foremanId: string;
  supervisorName: string | null;
  supervisorId: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "FLAGGED" | "REJECTED";
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

interface FilterOption {
  id: string;
  name: string;
}

interface GroupedPhotos {
  label: string;
  date: string;
  photos: SitePhoto[];
}

function formatDateHeading(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const photoDate = new Date(dateStr);
  photoDate.setHours(0, 0, 0, 0);

  if (photoDate.getTime() === today.getTime()) {
    return "Today's Submissions";
  }
  if (photoDate.getTime() === yesterday.getTime()) {
    return "Yesterday's Submissions";
  }

  return photoDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  });
}

function groupPhotosByDate(photos: SitePhoto[]): GroupedPhotos[] {
  const groups: Record<string, SitePhoto[]> = {};

  for (const photo of photos) {
    const dateKey = photo.dateTakenISO.split("T")[0];
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(photo);
  }

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return sortedDates.map((date) => ({
    label: formatDateHeading(date),
    date,
    photos: groups[date],
  }));
}

function getStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "VERIFIED":
      return "default";
    case "FLAGGED":
      return "destructive";
    case "REJECTED":
      return "destructive";
    default:
      return "secondary";
  }
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPhotoDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function chunkPhotos(photos: SitePhoto[], size = 10) {
  const chunks: SitePhoto[][] = [];
  for (let i = 0; i < photos.length; i += size) {
    chunks.push(photos.slice(i, i + size));
  }
  return chunks;
}

function buildPhotosPrintHtml(group: GroupedPhotos) {
  const pages = chunkPhotos(group.photos, 12);
  const title = `${group.label} - Site Photos`;
  const fullDate = formatPhotoDate(`${group.date}T00:00:00`);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f8fafc;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 12px 16px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .toolbar button {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0f172a;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 13px;
      cursor: pointer;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 10mm;
      background: #ffffff;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 7mm;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 4mm;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
    }
    .meta {
      margin-top: 3px;
      color: #475569;
      font-size: 12px;
    }
    .count {
      color: #475569;
      font-size: 12px;
      white-space: nowrap;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(3, auto);
      gap: 4mm;
    }
    .photo {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      background: #ffffff;
      break-inside: avoid;
    }
    .imageBox {
      height: 50mm;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: auto;
    }
    .caption {
      min-height: 20mm;
      padding: 2.5mm;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      line-height: 1.3;
    }
    .site {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 1mm;
    }
    .detail {
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status {
      display: inline-block;
      margin-top: 1.5mm;
      border-radius: 999px;
      background: #e2e8f0;
      color: #0f172a;
      padding: 1mm 2mm;
      font-size: 9px;
      font-weight: 700;
    }
    @media print {
      body { background: #ffffff; }
      .toolbar { display: none; }
      .page {
        width: auto;
        min-height: auto;
        margin: 0;
        box-shadow: none;
      }
    }
    @page { size: A4 portrait; margin: 0; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  ${pages
    .map(
      (photos, pageIndex) => `
      <section class="page">
        <div class="header">
          <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">${escapeHtml(fullDate)} · Page ${pageIndex + 1} of ${pages.length}</div>
          </div>
          <div class="count">${group.photos.length} photo${group.photos.length === 1 ? "" : "s"}</div>
        </div>
        <div class="grid">
          ${photos
            .map(
              (photo) => `
              <article class="photo">
                <div class="imageBox">
                  <img src="${escapeHtml(photo.imageUrl)}" alt="${escapeHtml(`${photo.siteName} - ${photo.foremanName}`)}" />
                </div>
                <div class="caption">
                  <div class="site">${escapeHtml(photo.siteName)}</div>
                  <div class="detail">${escapeHtml(photo.foremanName)}</div>
                  <div class="detail">${escapeHtml(
                    new Date(photo.uploadedAtISO).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  )}</div>
                  <span class="status">${escapeHtml(photo.verificationStatus)}</span>
                </div>
              </article>`,
            )
            .join("")}
        </div>
      </section>`,
    )
    .join("")}
</body>
</html>`;
}

function safeFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type NaturalImageSize = {
  width: number;
  height: number;
};

type FittedImageSize = {
  width: number;
  height: number;
};

export default function AdminSitePhotosPage() {
  const [photos, setPhotos] = useState<SitePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<SitePhoto | null>(null);
  const [foremen, setForemen] = useState<FilterOption[]>([]);
  const [supervisors, setSupervisors] = useState<FilterOption[]>([]);
  const [selectedForemanId, setSelectedForemanId] = useState<string>("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [foremanOpen, setForemanOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [naturalImageSize, setNaturalImageSize] =
    useState<NaturalImageSize | null>(null);
  const [fittedImageSize, setFittedImageSize] =
    useState<FittedImageSize | null>(null);

  const imageWrapperRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const getContainerSize = () => {
    const el = imageWrapperRef.current;
    if (!el) return null;
    return {
      width: el.clientWidth,
      height: el.clientHeight,
    };
  };

  const calculateFittedSize = (
    image: NaturalImageSize,
    container: { width: number; height: number },
  ): FittedImageSize => {
    const imageRatio = image.width / image.height;
    const containerRatio = container.width / container.height;

    if (imageRatio > containerRatio) {
      const width = container.width;
      const height = width / imageRatio;
      return { width, height };
    }

    const height = container.height;
    const width = height * imageRatio;
    return { width, height };
  };

  const clampPan = (
    nextPan: { x: number; y: number },
    nextZoom: number,
    baseSize?: FittedImageSize | null,
  ) => {
    const container = getContainerSize();
    const fitted = baseSize ?? fittedImageSize;

    if (!container || !fitted || nextZoom <= 1) {
      return { x: 0, y: 0 };
    }

    const scaledWidth = fitted.width * nextZoom;
    const scaledHeight = fitted.height * nextZoom;

    const overflowX = Math.max(0, (scaledWidth - container.width) / 2);
    const overflowY = Math.max(0, (scaledHeight - container.height) / 2);

    return {
      x: clamp(nextPan.x, -overflowX, overflowX),
      y: clamp(nextPan.y, -overflowY, overflowY),
    };
  };

  const resetViewer = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNaturalImageSize(null);
    setFittedImageSize(null);
    isPanningRef.current = false;
    panStartRef.current = null;
  };

  const setZoomSafely = (updater: number | ((prev: number) => number)) => {
    setZoom((currentZoom) => {
      const rawNextZoom =
        typeof updater === "function" ? updater(currentZoom) : updater;
      const nextZoom = clamp(rawNextZoom, 1, 5);

      setPan((currentPan) => clampPan(currentPan, nextZoom));

      if (nextZoom <= 1) {
        setPan({ x: 0, y: 0 });
      }

      return nextZoom;
    });
  };

  const updateFittedImageSize = () => {
    if (!naturalImageSize) return;
    const container = getContainerSize();
    if (!container) return;

    const nextFitted = calculateFittedSize(naturalImageSize, container);
    setFittedImageSize(nextFitted);
    setPan((currentPan) => clampPan(currentPan, zoom, nextFitted));
  };

  const loadPhotos = async (foremanId?: string, supervisorId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (foremanId) params.set("foremanId", foremanId);
      if (supervisorId) params.set("supervisorId", supervisorId);

      const url = `/api/admin/site-day-photos${
        params.toString() ? `?${params}` : ""
      }`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to load photos");
      }

      const data = await res.json();
      setPhotos(data.photos || []);

      if (!foremanId && !supervisorId) {
        setForemen(data.foremen || []);
        setSupervisors(data.supervisors || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load photos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  useEffect(() => {
    resetViewer();
  }, [selectedPhoto?.id]);

  useEffect(() => {
    if (!selectedPhoto || !naturalImageSize) return;
    updateFittedImageSize();

    const handleResize = () => {
      updateFittedImageSize();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [selectedPhoto, naturalImageSize, zoom]);

  const handleVerify = async (
    photoId: string,
    status: "VERIFIED" | "REJECTED",
  ) => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/admin/site-day-photos/${photoId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update verification status");
      }

      toast.success(
        status === "VERIFIED"
          ? "Photo verified"
          : "Photo rejected - foreman notified",
      );

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photoId ? { ...p, verificationStatus: status } : p,
        ),
      );

      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto((prev) =>
          prev ? { ...prev, verificationStatus: status } : null,
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update verification status");
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this photo? This cannot be undone.",
      )
    ) {
      return;
    }

    setDeleting(photoId);
    try {
      const res = await fetch(`/api/admin/site-day-photos/${photoId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete photo");
      }

      toast.success("Photo deleted");
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));

      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete photo");
    } finally {
      setDeleting(null);
    }
  };

  const scrollCarousel = (date: string, direction: "left" | "right") => {
    const el = carouselRefs.current[date];
    if (!el) return;

    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleForemanChange = (value: string) => {
    const newValue = value === selectedForemanId ? "" : value;
    setSelectedForemanId(newValue);
    setForemanOpen(false);
    loadPhotos(newValue, selectedSupervisorId);
  };

  const handleSupervisorChange = (value: string) => {
    const newValue = value === "all" ? "" : value;
    setSelectedSupervisorId(newValue);
    loadPhotos(selectedForemanId, newValue);
  };

  const clearFilters = () => {
    setSelectedForemanId("");
    setSelectedSupervisorId("");
    loadPhotos();
  };

  const hasFilters = selectedForemanId || selectedSupervisorId;
  const groupedPhotos = groupPhotosByDate(photos);

  const openPrintWindow = (group: GroupedPhotos, autoPrint: boolean) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Allow popups to print site photos");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPhotosPrintHtml(group));
    printWindow.document.close();

    if (autoPrint) {
      printWindow.addEventListener("load", () => {
        setTimeout(() => printWindow.print(), 500);
      });
    }
  };

  const handlePrintGroup = (group: GroupedPhotos) => {
    openPrintWindow(group, true);
  };

  const handleDownloadGroup = (group: GroupedPhotos) => {
    const html = buildPhotosPrintHtml(group);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-photos-${group.date}-${safeFilename(group.label)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Photo sheet downloaded");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Site Photos</h1>
          <p className="text-muted-foreground">
            Review photos submitted by foremen in the last 7 days
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedSupervisorId || "all"}
            onValueChange={handleSupervisorChange}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Supervisors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Supervisors</SelectItem>
              {supervisors.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover open={foremanOpen} onOpenChange={setForemanOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={foremanOpen}
                className="w-52 justify-between font-normal"
              >
                <span className="truncate">
                  {selectedForemanId
                    ? (foremen.find((f) => f.id === selectedForemanId)?.name ??
                      "All Foremen")
                    : "All Foremen"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search foremen..." />
                <CommandList>
                  <CommandEmpty>No foremen found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__all_foremen__"
                      keywords={["all", "foremen"]}
                      onSelect={() => {
                        setSelectedForemanId("");
                        setForemanOpen(false);
                        loadPhotos("", selectedSupervisorId);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          !selectedForemanId ? "opacity-100" : "opacity-0",
                        )}
                      />
                      All Foremen
                    </CommandItem>
                    {foremen.map((foreman) => (
                      <CommandItem
                        key={foreman.id}
                        value={foreman.id}
                        keywords={[foreman.name]}
                        onSelect={() => handleForemanChange(foreman.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedForemanId === foreman.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {foreman.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => loadPhotos(selectedForemanId, selectedSupervisorId)}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              No photos submitted
            </p>
            <p className="text-sm text-muted-foreground">
              Photos submitted by foremen will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedPhotos.map((group) => (
            <div key={group.date}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {group.label}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {group.photos.length} photo
                    {group.photos.length !== 1 ? "s" : ""}
                  </Badge>
                </h2>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintGroup(group)}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadGroup(group)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  {group.photos.length > 4 && (
                    <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => scrollCarousel(group.date, "left")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => scrollCarousel(group.date, "right")}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    </>
                  )}
                </div>
              </div>

              <div
                ref={(el) => {
                  carouselRefs.current[group.date] = el;
                }}
                className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
              >
                {group.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative w-56 flex-shrink-0 cursor-pointer overflow-hidden rounded border bg-card shadow-sm transition-all hover:shadow-md snap-start"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <div className="aspect-square bg-muted">
                      <img
                        src={photo.imageUrl}
                        alt={`${photo.siteName} - ${photo.foremanName}`}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>

                    <div className="absolute left-2 top-2">
                      <Badge
                        variant="default"
                        className="bg-primary/90 px-1.5 py-0.5 text-[10px] backdrop-blur-sm"
                      >
                        {photo.siteName}
                      </Badge>
                    </div>

                    <div className="absolute right-2 top-2">
                      <Badge
                        variant={getStatusVariant(photo.verificationStatus)}
                        className="px-1.5 py-0.5 text-[10px] backdrop-blur-sm"
                      >
                        {photo.verificationStatus}
                      </Badge>
                    </div>

                    <div className="absolute bottom-2 left-2">
                      <Badge
                        variant="secondary"
                        className="bg-secondary/90 px-1.5 py-0.5 text-[10px] backdrop-blur-sm"
                      >
                        {photo.foremanName}
                      </Badge>
                    </div>

                    <div className="absolute bottom-2 right-2">
                      <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
                        {new Date(photo.uploadedAtISO).toLocaleTimeString(
                          "en-GB",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    </div>

                    <button
                      className="absolute right-2 top-10 z-10 rounded-full bg-red-600/80 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
                      title="Delete photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(photo.id);
                      }}
                      disabled={deleting === photo.id}
                    >
                      {deleting === photo.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!selectedPhoto}
        onOpenChange={() => setSelectedPhoto(null)}
      >
        <DialogContent className="max-w-[94vw] overflow-hidden p-0">
          <DialogTitle className="sr-only">Photo Preview</DialogTitle>

          {selectedPhoto && (
            <div className="relative">
              <div
                ref={imageWrapperRef}
                className={`flex h-[82vh] w-full items-center justify-center overflow-hidden bg-black ${
                  zoom > 1 ? "cursor-grab" : "cursor-default"
                }`}
                onMouseDown={(event) => {
                  if (zoom <= 1) return;

                  isPanningRef.current = true;
                  panStartRef.current = {
                    mouseX: event.clientX,
                    mouseY: event.clientY,
                    startX: pan.x,
                    startY: pan.y,
                  };

                  if (imageWrapperRef.current) {
                    imageWrapperRef.current.style.cursor = "grabbing";
                  }

                  event.preventDefault();
                }}
                onMouseMove={(event) => {
                  if (!isPanningRef.current || !panStartRef.current) return;

                  const dx = event.clientX - panStartRef.current.mouseX;
                  const dy = event.clientY - panStartRef.current.mouseY;

                  setPan(
                    clampPan(
                      {
                        x: panStartRef.current.startX + dx,
                        y: panStartRef.current.startY + dy,
                      },
                      zoom,
                    ),
                  );
                }}
                onMouseUp={() => {
                  isPanningRef.current = false;
                  panStartRef.current = null;

                  if (imageWrapperRef.current) {
                    imageWrapperRef.current.style.cursor =
                      zoom > 1 ? "grab" : "default";
                  }
                }}
                onMouseLeave={() => {
                  isPanningRef.current = false;
                  panStartRef.current = null;

                  if (imageWrapperRef.current) {
                    imageWrapperRef.current.style.cursor =
                      zoom > 1 ? "grab" : "default";
                  }
                }}
                onWheel={(event) => {
                  event.preventDefault();

                  const delta = event.deltaY < 0 ? 0.2 : -0.2;
                  const nextZoom = clamp(zoom + delta, 1, 5);

                  setZoom(nextZoom);
                  setPan((currentPan) => clampPan(currentPan, nextZoom));
                }}
                onDoubleClick={() => {
                  if (zoom === 1) {
                    setZoom(2);
                    setPan({ x: 0, y: 0 });
                  } else {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }
                }}
              >
                {naturalImageSize && fittedImageSize ? (
                  <div
                    className="relative select-none"
                    style={{
                      width: fittedImageSize.width,
                      height: fittedImageSize.height,
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: "center center",
                      transition: isPanningRef.current
                        ? "none"
                        : "transform 120ms ease-out",
                    }}
                  >
                    <img
                      src={selectedPhoto.imageUrl}
                      alt={`${selectedPhoto.siteName} - ${selectedPhoto.foremanName}`}
                      draggable={false}
                      className="block h-full w-full select-none object-contain"
                    />
                  </div>
                ) : (
                  <img
                    src={selectedPhoto.imageUrl}
                    alt={`${selectedPhoto.siteName} - ${selectedPhoto.foremanName}`}
                    draggable={false}
                    className="max-h-full max-w-full select-none object-contain opacity-0"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      const nextNatural = {
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                      };
                      setNaturalImageSize(nextNatural);

                      const container = getContainerSize();
                      if (!container) return;

                      const nextFitted = calculateFittedSize(
                        nextNatural,
                        container,
                      );
                      setFittedImageSize(nextFitted);
                    }}
                  />
                )}
              </div>

              <div className="absolute left-4 top-4 flex flex-col gap-2">
                <Badge variant="default" className="w-fit">
                  {selectedPhoto.siteName}
                </Badge>
                <Badge variant="secondary" className="w-fit">
                  {selectedPhoto.foremanName}
                </Badge>
              </div>

              <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
                <Badge
                  variant={getStatusVariant(selectedPhoto.verificationStatus)}
                >
                  {selectedPhoto.verificationStatus}
                </Badge>

                <div className="flex gap-1 rounded bg-black/60 p-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-white/30 text-white hover:bg-white/10"
                    onClick={() =>
                      setZoom((current) => {
                        const next = clamp(current - 0.5, 1, 5);
                        setPan((p) => clampPan(p, next));
                        if (next === 1) {
                          setPan({ x: 0, y: 0 });
                        }
                        return next;
                      })
                    }
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-white/30 text-white hover:bg-white/10"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    title="Fit to screen"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-white/30 text-white hover:bg-white/10"
                    onClick={() =>
                      setZoom((current) => {
                        const next = clamp(current + 0.5, 1, 5);
                        setPan((p) => clampPan(p, next));
                        return next;
                      })
                    }
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-white">
                      Uploaded:{" "}
                      {new Date(selectedPhoto.uploadedAtISO).toLocaleString(
                        "en-GB",
                      )}
                    </p>
                    <p className="text-sm text-white/80">
                      Work Date:{" "}
                      {new Date(selectedPhoto.dateTakenISO).toLocaleDateString(
                        "en-GB",
                        {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </p>

                    {selectedPhoto.latitude && selectedPhoto.longitude ? (
                      <div className="mt-1">
                        {selectedPhoto.address && (
                          <p className="mb-1 text-sm text-white/80">
                            {selectedPhoto.address}
                          </p>
                        )}
                        <a
                          href={`https://www.google.com/maps?q=${selectedPhoto.latitude},${selectedPhoto.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200 hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          View on map
                        </a>
                      </div>
                    ) : selectedPhoto.address ? (
                      <p className="mt-1 text-sm text-white/80">
                        <MapPin className="mr-1 inline h-3 w-3" />
                        {selectedPhoto.address}
                      </p>
                    ) : (
                      <p className="mt-1 flex items-center gap-1 text-sm text-white/50">
                        <MapPin className="h-3 w-3" />
                        No location data
                      </p>
                    )}
                  </div>

                  {selectedPhoto.verificationStatus === "PENDING" ? (
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          handleVerify(selectedPhoto.id, "REJECTED")
                        }
                        disabled={verifying}
                      >
                        {verifying ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="mr-1 h-4 w-4" />
                        )}
                        Reject
                      </Button>

                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          handleVerify(selectedPhoto.id, "VERIFIED")
                        }
                        disabled={verifying}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {verifying ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-1 h-4 w-4" />
                        )}
                        Accept
                      </Button>

                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(selectedPhoto.id)}
                        disabled={deleting === selectedPhoto.id}
                      >
                        {deleting === selectedPhoto.id ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1 h-4 w-4" />
                        )}
                        Delete
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(selectedPhoto.id)}
                      disabled={deleting === selectedPhoto.id}
                    >
                      {deleting === selectedPhoto.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1 h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
