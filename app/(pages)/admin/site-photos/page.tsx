"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";

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

  // Sort dates descending (newest first)
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

export default function AdminSitePhotosPage() {
  const [photos, setPhotos] = useState<SitePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<SitePhoto | null>(null);
  const [foremen, setForemen] = useState<FilterOption[]>([]);
  const [supervisors, setSupervisors] = useState<FilterOption[]>([]);
  const [selectedForemanId, setSelectedForemanId] = useState<string>("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const imageWrapperRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const loadPhotos = async (foremanId?: string, supervisorId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (foremanId) params.set("foremanId", foremanId);
      if (supervisorId) params.set("supervisorId", supervisorId);
      const url = `/api/admin/site-day-photos${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to load photos");
      }
      const data = await res.json();
      setPhotos(data.photos || []);
      // Only update filter options on initial load (no filters)
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
    // Reset zoom and pan whenever a new photo is selected or modal is closed
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [selectedPhoto?.id]);

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

      // Update local state
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
    )
      return;
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

  const groupedPhotos = groupPhotosByDate(photos);

  // Carousel scroll refs – one per date group
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
    const newValue = value === "all" ? "" : value;
    setSelectedForemanId(newValue);
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
          <Select
            value={selectedForemanId || "all"}
            onValueChange={handleForemanChange}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Foremen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Foremen</SelectItem>
              {foremen.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {group.label}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {group.photos.length} photo
                    {group.photos.length !== 1 ? "s" : ""}
                  </Badge>
                </h2>
                {group.photos.length > 4 && (
                  <div className="flex items-center gap-1">
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
                  </div>
                )}
              </div>
              <div
                ref={(el) => {
                  carouselRefs.current[group.date] = el;
                }}
                className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40"
              >
                {group.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative flex-shrink-0 w-56 cursor-pointer overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:shadow-md snap-start"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <div className="aspect-square">
                      <img
                        src={photo.imageUrl}
                        alt={`${photo.siteName} - ${photo.foremanName}`}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>

                    {/* Site badge - top left */}
                    <div className="absolute left-2 top-2">
                      <Badge
                        variant="default"
                        className="bg-primary/90 backdrop-blur-sm text-[10px] px-1.5 py-0.5"
                      >
                        {photo.siteName}
                      </Badge>
                    </div>

                    {/* Status badge - top right */}
                    <div className="absolute right-2 top-2">
                      <Badge
                        variant={getStatusVariant(photo.verificationStatus)}
                        className="backdrop-blur-sm text-[10px] px-1.5 py-0.5"
                      >
                        {photo.verificationStatus}
                      </Badge>
                    </div>

                    {/* Foreman badge - bottom left */}
                    <div className="absolute bottom-2 left-2">
                      <Badge
                        variant="secondary"
                        className="bg-secondary/90 backdrop-blur-sm text-[10px] px-1.5 py-0.5"
                      >
                        {photo.foremanName}
                      </Badge>
                    </div>

                    {/* Time - bottom right */}
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

                    {/* Delete button - top right corner, behind status badge */}
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

      {/* Full image modal */}
      <Dialog
        open={!!selectedPhoto}
        onOpenChange={() => setSelectedPhoto(null)}
      >
        <DialogContent className="max-w-[90vw] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Photo Preview</DialogTitle>
          {selectedPhoto && (
            <div className="relative">
              <div
                ref={imageWrapperRef}
                className="h-[80vh] w-full bg-black flex items-center justify-center overflow-hidden"
                onMouseDown={(event) => {
                  if (zoom <= 1) return;
                  if (!imageWrapperRef.current) return;
                  isPanningRef.current = true;
                  panStartRef.current = {
                    mouseX: event.clientX,
                    mouseY: event.clientY,
                    startX: pan.x,
                    startY: pan.y,
                  };
                  imageWrapperRef.current.style.cursor = "grabbing";
                  event.preventDefault();
                }}
                onMouseMove={(event) => {
                  if (!isPanningRef.current || !panStartRef.current) return;
                  const dx = event.clientX - panStartRef.current.mouseX;
                  const dy = event.clientY - panStartRef.current.mouseY;
                  setPan({
                    x: panStartRef.current.startX + dx,
                    y: panStartRef.current.startY + dy,
                  });
                }}
                onMouseUp={() => {
                  if (!imageWrapperRef.current) return;
                  isPanningRef.current = false;
                  panStartRef.current = null;
                  imageWrapperRef.current.style.cursor =
                    zoom > 1 ? "grab" : "default";
                }}
                onMouseLeave={() => {
                  if (!imageWrapperRef.current) return;
                  isPanningRef.current = false;
                  panStartRef.current = null;
                  imageWrapperRef.current.style.cursor =
                    zoom > 1 ? "grab" : "default";
                }}
                onWheel={(event) => {
                  setZoom((z) => {
                    const delta = event.deltaY < 0 ? 0.2 : -0.2;
                    const next = Math.min(4, Math.max(1, z + delta));
                    if (next === 1) {
                      setPan({ x: 0, y: 0 });
                    }
                    return next;
                  });
                }}
              >
                <img
                  src={selectedPhoto.imageUrl}
                  alt={`${selectedPhoto.siteName} - ${selectedPhoto.foremanName}`}
                  className="h-full w-full object-contain md:object-cover select-none transition-transform"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "center center",
                  }}
                />
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
                <div className="flex gap-1 rounded-md bg-black/60 p-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-white/30 text-white hover:bg-white/10"
                    onClick={() =>
                      setZoom((z) => {
                        const next = z <= 1 ? 1 : Math.max(1, z - 0.5);
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
                    onClick={() => setZoom(1)}
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-white/30 text-white hover:bg-white/10"
                    onClick={() =>
                      setZoom((z) => (z >= 4 ? 4 : Math.min(4, z + 0.5)))
                    }
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-4">
                <div className="flex items-end justify-between">
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
                          <p className="text-sm text-white/80 mb-1">
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
                  {selectedPhoto.verificationStatus === "PENDING" && (
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
                  )}
                  {selectedPhoto.verificationStatus !== "PENDING" && (
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
