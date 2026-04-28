"use client";

import { useEffect, useState } from "react";
import { Camera, MapPin, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

type Photo = {
  id: string;
  imageUrl: string;
  dateTakenISO: string;
  uploadedAtISO: string;
  siteName: string;
  siteId: string;
  foremanName: string;
  foremanId: string;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  latitude: number | null;
  longitude: number | null;
};

const STATUS_CFG = {
  PENDING: {
    label: "Pending",
    icon: AlertCircle,
    pill: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700",
  },
  APPROVED: {
    label: "Approved",
    icon: CheckCircle,
    pill: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    pill: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700",
  },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SupervisorPhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  useEffect(() => {
    fetch("/api/app/supervisor/site-day-photos")
      .then((r) => r.json())
      .then((data) => {
        setPhotos(data.photos ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load photos");
        setLoading(false);
      });
  }, []);

  const filtered =
    filter === "ALL" ? photos : photos.filter((p) => p.verificationStatus === filter);

  const counts = {
    ALL: photos.length,
    PENDING: photos.filter((p) => p.verificationStatus === "PENDING").length,
    APPROVED: photos.filter((p) => p.verificationStatus === "APPROVED").length,
    REJECTED: photos.filter((p) => p.verificationStatus === "REJECTED").length,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded border border-primary/30 bg-primary/10">
              <Camera className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                Photo Verification
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Last 7 days · your sites
              </p>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-3 flex gap-1">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-secondary/60">
              <Camera className="size-5 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No photos found
            </p>
            <p className="text-xs text-muted-foreground/60">
              {filter === "ALL"
                ? "No site day photos uploaded in the last 7 days"
                : `No ${filter.toLowerCase()} photos`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((photo) => {
              const cfg = STATUS_CFG[photo.verificationStatus];
              const Icon = cfg.icon;

              return (
                <div
                  key={photo.id}
                  className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-border/80"
                >
                  {/* Photo */}
                  <div
                    className="relative aspect-video cursor-pointer overflow-hidden bg-secondary/20"
                    onClick={() => setLightbox(photo)}
                  >
                    <img
                      src={photo.imageUrl}
                      alt={`${photo.siteName} — ${photo.foremanName}`}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                    />
                    {/* Status badge overlay */}
                    <div className="absolute right-2 top-2">
                      <span
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${cfg.pill}`}
                      >
                        <Icon className="size-2.5" />
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="p-3 space-y-1.5">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {photo.siteName}
                    </p>
                    <p className="text-xs text-muted-foreground">{photo.foremanName}</p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(photo.dateTakenISO)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/40">
                      Uploaded {timeAgo(photo.uploadedAtISO)}
                    </p>
                    {photo.latitude && photo.longitude && (
                      <a
                        href={`https://maps.google.com/?q=${photo.latitude},${photo.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        <MapPin className="size-3" />
                        View on map
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.imageUrl}
              alt={lightbox.siteName}
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
            <div className="mt-3 flex items-center justify-between text-sm text-white/80">
              <div>
                <p className="font-semibold text-white">{lightbox.siteName}</p>
                <p className="text-xs">{lightbox.foremanName} · {formatDate(lightbox.dateTakenISO)}</p>
              </div>
              <button
                onClick={() => setLightbox(null)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
