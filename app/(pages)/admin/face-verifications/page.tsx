"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScanFace, Check, X, Loader2, Smartphone, Clock } from "lucide-react";

type FaceEnrollment = {
  id: string;
  employeeId: string;
  employeeName: string;
  pose: "FRONT" | "LEFT" | "RIGHT" | "SMILE" | "NEUTRAL";
  imageUrl: string;
  qualityScore: number | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  enrolledAtISO: string;
  foremanName: string;
  device: string | null;
};

type EmployeeGroup = {
  employeeId: string;
  employeeName: string;
  foremanName: string;
  enrolledAtISO: string;
  photos: FaceEnrollment[];
};

function groupByEmployee(enrollments: FaceEnrollment[]): EmployeeGroup[] {
  const map = new Map<string, EmployeeGroup>();
  for (const e of enrollments) {
    const existing = map.get(e.employeeId);
    if (existing) {
      existing.photos.push(e);
    } else {
      map.set(e.employeeId, {
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        foremanName: e.foremanName,
        enrolledAtISO: e.enrolledAtISO,
        photos: [e],
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.enrolledAtISO).getTime() - new Date(b.enrolledAtISO).getTime(),
  );
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

export default function FaceVerificationsPage() {
  const [enrollments, setEnrollments] = useState<FaceEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ids currently mid-request — disables their buttons without blocking the rest of the page.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<FaceEnrollment | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/app/admin/face-enrollments?status=PENDING_APPROVAL")
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) throw new Error(data.error);
        setEnrollments(data.enrollments ?? []);
        setError(null);
      })
      .catch(() => setError("Failed to load pending face verifications"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const groups = useMemo(() => groupByEmployee(enrollments), [enrollments]);

  const setBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  const removeFromList = (id: string) =>
    setEnrollments((prev) => prev.filter((e) => e.id !== id));

  const handleApprove = async (photo: FaceEnrollment) => {
    setBusy(photo.id, true);
    try {
      const res = await fetch(`/api/app/admin/face-enrollments/${photo.id}/approve`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to approve");
      removeFromList(photo.id);
      toast.success(`${photo.employeeName} — ${photo.pose.toLowerCase()} approved`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to approve photo");
    } finally {
      setBusy(photo.id, false);
    }
  };

  const openReject = (photo: FaceEnrollment) => {
    setRejectReason("");
    setRejectTarget(photo);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const photo = rejectTarget;
    setBusy(photo.id, true);
    try {
      const res = await fetch(`/api/app/admin/face-enrollments/${photo.id}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to reject");
      removeFromList(photo.id);
      toast.success(`${photo.employeeName} — ${photo.pose.toLowerCase()} rejected`);
      setRejectTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reject photo");
    } finally {
      setBusy(photo.id, false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded border border-primary/30 bg-primary/10">
            <ScanFace className="size-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
              Face Verifications
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {groups.length} employee{groups.length === 1 ? "" : "s"} awaiting approval
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-secondary/60">
              <ScanFace className="size-5 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">All caught up</p>
            <p className="text-xs text-muted-foreground/60">
              No reference photos are waiting for approval
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <Card key={group.employeeId} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {group.employeeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Captured by {group.foremanName} · {timeAgo(group.enrolledAtISO)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {group.photos.length} photo{group.photos.length === 1 ? "" : "s"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                  {group.photos.map((photo) => {
                    const busy = busyIds.has(photo.id);
                    return (
                      <div
                        key={photo.id}
                        className="overflow-hidden rounded-lg border border-border bg-card"
                      >
                        <div className="relative aspect-square bg-secondary/20">
                          <img
                            src={photo.imageUrl}
                            alt={`${photo.employeeName} — ${photo.pose}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                            {photo.pose.charAt(0) + photo.pose.slice(1).toLowerCase()}
                          </span>
                        </div>
                        <div className="space-y-1.5 p-2">
                          {photo.qualityScore != null && (
                            <p className="text-[10px] text-muted-foreground/60">
                              Quality {Math.round(photo.qualityScore * 100)}%
                            </p>
                          )}
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 flex-1 bg-green-600 px-0 hover:bg-green-700"
                              disabled={busy}
                              onClick={() => handleApprove(photo)}
                            >
                              {busy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Check className="size-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 flex-1 px-0"
                              disabled={busy}
                              onClick={() => openReject(photo)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground/50">
                  {group.photos[0]?.device && (
                    <span className="flex items-center gap-1">
                      <Smartphone className="size-3" />
                      {group.photos[0].device}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {new Date(group.enrolledAtISO).toLocaleString("en-ZA")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reject {rejectTarget?.pose.toLowerCase()} photo
              {rejectTarget ? ` — ${rejectTarget.employeeName}` : ""}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason (required) — e.g. blurry, face obscured, wrong person"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={
                !rejectReason.trim() || (!!rejectTarget && busyIds.has(rejectTarget.id))
              }
            >
              {rejectTarget && busyIds.has(rejectTarget.id) ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : null}
              Reject Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
