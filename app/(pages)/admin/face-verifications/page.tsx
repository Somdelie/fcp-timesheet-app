"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ScanFace,
  Check,
  X,
  Loader2,
  Smartphone,
  Clock,
  ShieldCheck,
  Activity,
  Trash2,
} from "lucide-react";

type FaceEnrollment = {
  id: string;
  employeeId: string;
  employeeName: string;
  pose: "FRONT" | "LEFT" | "RIGHT" | "SMILE" | "NEUTRAL";
  imageUrl: string;
  qualityScore: number | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  enrolledAtISO: string;
  approvedAtISO: string | null;
  foremanName: string;
  approvedByName: string | null;
  device: string | null;
};

type EmployeeGroup = {
  employeeId: string;
  employeeName: string;
  foremanName: string;
  enrolledAtISO: string;
  photos: FaceEnrollment[];
};

type VerificationAttempt = {
  id: string;
  confidence: number;
  livenessPassed: boolean | null;
  processingTimeMs: number | null;
  createdAtISO: string;
  matchedPose: string | null;
  workDateISO: string | null;
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
    (a, b) =>
      new Date(a.enrolledAtISO).getTime() - new Date(b.enrolledAtISO).getTime(),
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

function poseLabel(pose: string) {
  return pose.charAt(0) + pose.slice(1).toLowerCase();
}

const POSE_ORDER = ["FRONT", "LEFT", "RIGHT", "SMILE", "NEUTRAL"] as const;

/** Approved photos for one employee, grouped by pose and sorted newest-first within each — purely a display grouping, doesn't touch any record. */
function groupPhotosByPose(
  photos: FaceEnrollment[],
): Record<(typeof POSE_ORDER)[number], FaceEnrollment[]> {
  const map = Object.fromEntries(
    POSE_ORDER.map((pose) => [pose, [] as FaceEnrollment[]]),
  ) as Record<(typeof POSE_ORDER)[number], FaceEnrollment[]>;
  for (const photo of photos) {
    map[photo.pose]?.push(photo);
  }
  for (const pose of POSE_ORDER) {
    map[pose].sort(
      (a, b) =>
        new Date(b.enrolledAtISO).getTime() -
        new Date(a.enrolledAtISO).getTime(),
    );
  }
  return map;
}

export default function FaceVerificationsPage() {
  const [tab, setTab] = useState<"pending" | "verified">("pending");

  // Pending-approval queue
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
      const res = await fetch(
        `/api/app/admin/face-enrollments/${photo.id}/approve`,
        {
          method: "POST",
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to approve");
      removeFromList(photo.id);
      toast.success(
        `${photo.employeeName} — ${photo.pose.toLowerCase()} approved`,
      );
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
      const res = await fetch(
        `/api/app/admin/face-enrollments/${photo.id}/reject`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to reject");
      removeFromList(photo.id);
      toast.success(
        `${photo.employeeName} — ${photo.pose.toLowerCase()} rejected`,
      );
      setRejectTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reject photo");
    } finally {
      setBusy(photo.id, false);
    }
  };

  // Verified employees — loaded lazily on first visit to the tab, since most
  // admin sessions may never open it.
  const [verifiedEnrollments, setVerifiedEnrollments] = useState<
    FaceEnrollment[]
  >([]);
  const [verifiedLoading, setVerifiedLoading] = useState(false);
  const [verifiedLoaded, setVerifiedLoaded] = useState(false);
  const [verifiedError, setVerifiedError] = useState<string | null>(null);

  const loadVerified = () => {
    setVerifiedLoading(true);
    fetch("/api/app/admin/face-enrollments?status=APPROVED")
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) throw new Error(data.error);
        setVerifiedEnrollments(data.enrollments ?? []);
        setVerifiedError(null);
      })
      .catch(() => setVerifiedError("Failed to load verified team members"))
      .finally(() => {
        setVerifiedLoading(false);
        setVerifiedLoaded(true);
      });
  };

  useEffect(() => {
    if (tab === "verified" && !verifiedLoaded) loadVerified();
  }, [tab, verifiedLoaded]);

  const verifiedGroups = useMemo(
    () => groupByEmployee(verifiedEnrollments),
    [verifiedEnrollments],
  );

  // Profile dialog — reference photos come from the already-loaded verified
  // group; verification history is fetched per employee only when opened.
  const [profileTarget, setProfileTarget] = useState<EmployeeGroup | null>(
    null,
  );
  const [attempts, setAttempts] = useState<VerificationAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);

  const openProfile = (group: EmployeeGroup) => {
    setProfileTarget(group);
    setAttempts([]);
    setAttemptsError(null);
    setAttemptsLoading(true);
    fetch(
      `/api/app/admin/employees/${group.employeeId}/face-verification-history`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) throw new Error(data.error);
        setAttempts(data.attempts ?? []);
      })
      .catch(() => setAttemptsError("Failed to load verification history"))
      .finally(() => setAttemptsLoading(false));
  };

  const approvedAtForGroup = (group: EmployeeGroup) =>
    group.photos.find((p) => p.approvedAtISO)?.approvedAtISO ?? null;
  const approvedByForGroup = (group: EmployeeGroup) =>
    group.photos.find((p) => p.approvedByName)?.approvedByName ?? null;

  // Delete confirmation — targets a single reference photo from the profile
  // dialog. lastForPose is computed at open time so the warning reflects the
  // grouping the admin was actually looking at.
  const [deleteTarget, setDeleteTarget] = useState<
    (FaceEnrollment & { lastForPose: boolean }) | null
  >(null);

  const openDeleteConfirm = (
    photo: FaceEnrollment,
    photosForPose: FaceEnrollment[],
  ) => {
    setDeleteTarget({ ...photo, lastForPose: photosForPose.length === 1 });
  };

  const confirmDeletePhoto = async () => {
    if (!deleteTarget) return;
    const photo = deleteTarget;
    setBusy(photo.id, true);
    try {
      const res = await fetch(`/api/app/admin/face-enrollments/${photo.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete photo");

      setVerifiedEnrollments((prev) => prev.filter((e) => e.id !== photo.id));
      setProfileTarget((prev) =>
        prev
          ? { ...prev, photos: prev.photos.filter((p) => p.id !== photo.id) }
          : prev,
      );
      toast.success(
        `${photo.employeeName} — ${photo.pose.toLowerCase()} reference deleted`,
      );
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete photo");
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
              {tab === "pending"
                ? `${groups.length === 1 ? "1 personel member" : `${groups.length} team members`} awaiting approval`
                : `${verifiedGroups.length === 1 ? "1 verified personel member" : `${verifiedGroups.length} verified team members`}`}
            </p>
          </div>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "pending" | "verified")}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="mt-3 w-fit shrink-0">
          <TabsTrigger value="pending">Pending Approval</TabsTrigger>
          <TabsTrigger value="verified">Verified</TabsTrigger>
        </TabsList>

        {/* Pending Approval */}
        <TabsContent
          value="pending"
          className="min-h-0 flex-1 space-y-6 overflow-auto py-4"
        >
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
              <p className="text-sm font-medium text-muted-foreground">
                All caught up
              </p>
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
                        Captured by {group.foremanName} ·{" "}
                        {timeAgo(group.enrolledAtISO)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {group.photos.length} photo
                      {group.photos.length === 1 ? "" : "s"}
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
                              {poseLabel(photo.pose)}
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
        </TabsContent>

        {/* Verified */}
        <TabsContent
          value="verified"
          className="min-h-0 flex-1 overflow-auto py-4"
        >
          {verifiedLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : verifiedError ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-destructive">{verifiedError}</p>
            </div>
          ) : verifiedGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg bg-secondary/60">
                <ShieldCheck className="size-5 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                No verified team members yet
              </p>
              <p className="text-xs text-muted-foreground/60">
                Approved reference photos will appear here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {verifiedGroups.map((group) => {
                const cover =
                  group.photos.find((p) => p.pose === "FRONT") ??
                  group.photos[0];
                return (
                  <button
                    key={group.employeeId}
                    onClick={() => openProfile(group)}
                    className="overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/40"
                  >
                    <div className="relative aspect-square bg-secondary/20">
                      <img
                        src={cover.imageUrl}
                        alt={group.employeeName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="space-y-0.5 p-2">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {group.employeeName}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                        <ShieldCheck className="size-3" />
                        {group.photos.length} photo
                        {group.photos.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reject reason dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => !open && setRejectTarget(null)}
      >
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
                !rejectReason.trim() ||
                (!!rejectTarget && busyIds.has(rejectTarget.id))
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

      {/* Delete reference photo confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {deleteTarget?.pose.toLowerCase()} reference
              {deleteTarget ? ` — ${deleteTarget.employeeName}` : ""}
            </DialogTitle>
            <DialogDescription>
              This permanently removes this photo and its embedding. It will no
              longer be used for future scan-out matching. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget?.lastForPose && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
              This is the only approved reference for{" "}
              {poseLabel(deleteTarget.pose)}. Deleting it will leave this pose
              with no approved reference.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeletePhoto}
              disabled={!!deleteTarget && busyIds.has(deleteTarget.id)}
            >
              {deleteTarget && busyIds.has(deleteTarget.id) ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : null}
              Delete Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee face-verification profile dialog */}
      <Dialog
        open={!!profileTarget}
        onOpenChange={(open) => !open && setProfileTarget(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              {profileTarget?.employeeName}
            </DialogTitle>
            <DialogDescription>Face verification profile</DialogDescription>
          </DialogHeader>

          {profileTarget && (
            <div className="space-y-5">
              <div className="space-y-1.5 rounded border border-border bg-secondary/20 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className="bg-emerald-600 text-[10px] hover:bg-emerald-600">
                    APPROVED
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Captured by</span>
                  <span className="font-medium text-foreground">
                    {profileTarget.foremanName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Enrolled</span>
                  <span className="font-medium text-foreground">
                    {new Date(profileTarget.enrolledAtISO).toLocaleString(
                      "en-ZA",
                    )}
                  </span>
                </div>
                {approvedAtForGroup(profileTarget) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Approved</span>
                    <span className="font-medium text-foreground">
                      {new Date(
                        approvedAtForGroup(profileTarget)!,
                      ).toLocaleString("en-ZA")}
                      {approvedByForGroup(profileTarget)
                        ? ` by ${approvedByForGroup(profileTarget)}`
                        : ""}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Reference Faces — 5 poses
                </p>
                <div className="space-y-4">
                  {POSE_ORDER.map((pose) => {
                    const photosForPose = groupPhotosByPose(
                      profileTarget.photos,
                    )[pose];
                    return (
                      <div key={pose}>
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {poseLabel(pose)}
                          </span>
                          {photosForPose.length > 1 && (
                            <Badge variant="outline" className="text-[10px]">
                              {photosForPose.length} approved references
                            </Badge>
                          )}
                        </div>

                        {photosForPose.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-border p-2 text-center text-[10px] text-muted-foreground/60">
                            No approved reference for this pose
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {/* Every approved reference is shown — an older one never disappears just
                                because a newer one for the same pose was approved later; whether that
                                accumulation should be pruned is a separate product decision. */}
                            {photosForPose.map((photo, i) => (
                              <div
                                key={photo.id}
                                className="overflow-hidden rounded border border-border bg-card"
                              >
                                <div className="relative aspect-square bg-secondary/20">
                                  <img
                                    src={photo.imageUrl}
                                    alt={`${profileTarget.employeeName} — ${pose}`}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                  {photosForPose.length > 1 && (
                                    <span
                                      className={`absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm ${
                                        i === 0
                                          ? "bg-emerald-600/80"
                                          : i === photosForPose.length - 1
                                            ? "bg-amber-600/80"
                                            : "bg-black/60"
                                      }`}
                                    >
                                      {i === 0
                                        ? "Newest"
                                        : i === photosForPose.length - 1
                                          ? "Oldest"
                                          : "Older"}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDeleteConfirm(photo, photosForPose)
                                    }
                                    disabled={busyIds.has(photo.id)}
                                    title="Delete this reference photo"
                                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-destructive disabled:opacity-50"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>
                                <div className="space-y-0.5 p-1.5 text-center">
                                  {photo.qualityScore != null && (
                                    <p className="text-[9px] text-muted-foreground/70">
                                      Quality{" "}
                                      {Math.round(photo.qualityScore * 100)}%
                                    </p>
                                  )}
                                  <p className="text-[9px] text-muted-foreground/50">
                                    {new Date(
                                      photo.enrolledAtISO,
                                    ).toLocaleDateString("en-ZA")}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Activity className="size-3" />
                  Verification history
                </p>
                {attemptsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : attemptsError ? (
                  <p className="text-xs text-destructive">{attemptsError}</p>
                ) : attempts.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground/70">
                    No scan-out verification attempts recorded yet
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {attempts.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-lg border border-border p-2 text-xs"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {Math.round(a.confidence * 100)}% match
                          </p>
                          <p className="text-muted-foreground">
                            {new Date(a.createdAtISO).toLocaleString("en-ZA")}
                          </p>
                        </div>
                        {a.livenessPassed !== null && (
                          <Badge variant="outline" className="text-[10px]">
                            {a.livenessPassed
                              ? "Liveness OK"
                              : "Liveness flagged"}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
