"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  Loader2,
  Trash2,
  Users,
  MapPin,
  FileCheck,
  RefreshCw,
} from "lucide-react";

interface Preview {
  inactiveEmployees: number;
  inactiveSites: number;
  paidTimesheets: number;
}

interface CleanupResult {
  task: string;
  deletedCount?: number;
  prunedCount?: number;
  employees?: { id: string; name: string }[];
  sites?: { id: string; name: string }[];
}

export default function AdminCleanupPage() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);

  // Confirmation dialog state
  const [confirmTask, setConfirmTask] = useState<string | null>(null);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cleanup", {
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to load preview");
      setPreview(data.preview);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load cleanup preview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const runTask = useCallback(
    async (task: string) => {
      setRunning(task);
      setLastResult(null);
      try {
        const res = await fetch("/api/admin/cleanup", {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ task }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Cleanup failed");
        setLastResult(data);
        toast.success(
          `Cleanup complete: ${data.deletedCount ?? data.prunedCount ?? 0} items processed`,
        );
        loadPreview();
      } catch (err: any) {
        toast.error(err?.message ?? "Cleanup failed");
      } finally {
        setRunning(null);
      }
    },
    [loadPreview],
  );

  const openConfirm = (task: string, title: string, desc: string) => {
    setConfirmTask(task);
    setConfirmTitle(title);
    setConfirmDesc(desc);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Database Cleanup
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Remove inactive records and prune paid timesheet data to keep the
            database lean.
          </p>
        </div>
        <Button variant="outline" onClick={loadPreview} disabled={loading}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {loading && !preview ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Inactive Employees */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-base">Inactive Employees</CardTitle>
              </div>
              <CardDescription>
                Employees with no attendance scans in the last 2 months will be
                permanently removed. They can re-register if they return.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Found inactive:
                </span>
                <Badge
                  variant={
                    (preview?.inactiveEmployees ?? 0) > 0
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {preview?.inactiveEmployees ?? 0}
                </Badge>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={
                  running !== null || (preview?.inactiveEmployees ?? 0) === 0
                }
                onClick={() =>
                  openConfirm(
                    "inactive-employees",
                    "Delete Inactive Employees?",
                    `This will permanently delete ${preview?.inactiveEmployees ?? 0} employee(s) who have not scanned in the last 2 months. Their face images will also be removed from cloud storage. This cannot be undone.`,
                  )
                }
              >
                {running === "inactive-employees" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {running === "inactive-employees"
                  ? "Cleaning…"
                  : "Clean Up Employees"}
              </Button>
            </CardContent>
          </Card>

          {/* Inactive Sites */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-base">Inactive Sites</CardTitle>
              </div>
              <CardDescription>
                Sites with no attendance scans in the last 6 months will be
                permanently removed along with their associated data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Found inactive:
                </span>
                <Badge
                  variant={
                    (preview?.inactiveSites ?? 0) > 0
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {preview?.inactiveSites ?? 0}
                </Badge>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={
                  running !== null || (preview?.inactiveSites ?? 0) === 0
                }
                onClick={() =>
                  openConfirm(
                    "inactive-sites",
                    "Delete Inactive Sites?",
                    `This will permanently delete ${preview?.inactiveSites ?? 0} site(s) with no scans in the last 6 months, including all related assignments, site days, and timesheets. This cannot be undone.`,
                  )
                }
              >
                {running === "inactive-sites" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {running === "inactive-sites" ? "Cleaning…" : "Clean Up Sites"}
              </Button>
            </CardContent>
          </Card>

          {/* Prune Paid Timesheets */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base">
                  Prune Paid Timesheets
                </CardTitle>
              </div>
              <CardDescription>
                Remove raw attendance scan data for timesheets already marked as
                PAID. The PDF archive should be saved locally first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Paid timesheets:
                </span>
                <Badge variant="secondary">
                  {preview?.paidTimesheets ?? 0}
                </Badge>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={
                  running !== null || (preview?.paidTimesheets ?? 0) === 0
                }
                onClick={() =>
                  openConfirm(
                    "prune-paid",
                    "Prune Paid Timesheet Data?",
                    `This will delete the raw attendance scan records for ${preview?.paidTimesheets ?? 0} paid timesheet(s). Make sure you have downloaded the PDF archive for each before proceeding. This cannot be undone.`,
                  )
                }
              >
                {running === "prune-paid" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {running === "prune-paid" ? "Pruning…" : "Prune Scan Data"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Last result */}
      {lastResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Last Cleanup Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Task:</span>{" "}
                <Badge variant="outline">{lastResult.task}</Badge>
              </div>
              {lastResult.deletedCount !== undefined && (
                <div>
                  <span className="text-muted-foreground">
                    Records deleted:
                  </span>{" "}
                  <span className="font-semibold">
                    {lastResult.deletedCount}
                  </span>
                </div>
              )}
              {lastResult.prunedCount !== undefined && (
                <div>
                  <span className="text-muted-foreground">Scans pruned:</span>{" "}
                  <span className="font-semibold">
                    {lastResult.prunedCount}
                  </span>
                </div>
              )}
              {lastResult.employees && lastResult.employees.length > 0 && (
                <div>
                  <span className="text-muted-foreground">
                    Deleted employees:
                  </span>
                  <ul className="mt-1 ml-4 list-disc text-xs">
                    {lastResult.employees.map((e) => (
                      <li key={e.id}>{e.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lastResult.sites && lastResult.sites.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Deleted sites:</span>
                  <ul className="mt-1 ml-4 list-disc text-xs">
                    {lastResult.sites.map((s) => (
                      <li key={s.id}>{s.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmationDialog
        open={confirmTask !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTask(null);
        }}
        title={confirmTitle}
        description={confirmDesc}
        onConfirm={() => {
          if (confirmTask) {
            runTask(confirmTask);
            setConfirmTask(null);
          }
        }}
        isLoading={running !== null}
        confirmText="Run Cleanup"
        variant="destructive"
      />
    </div>
  );
}
