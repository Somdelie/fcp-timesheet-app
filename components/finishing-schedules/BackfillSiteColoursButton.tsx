"use client";

import * as React from "react";
import { Loader2, Palette } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type BackfillJob = {
  id: string;
  status: "queued" | "running" | "complete" | "failed";
  total: number;
  processed: number;
  seeded: number;
  created: number;
  updated: number;
  duplicates: number;
  skipped: number;
  failed: number;
  currentSite: string | null;
  percent: number;
  error: string | null;
};

async function readJson(res: Response) {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error ?? "Backfill request failed.");
  }
  return json as { job: BackfillJob };
}

export default function BackfillSiteColoursButton() {
  const router = useRouter();
  const [job, setJob] = React.useState<BackfillJob | null>(null);
  const [starting, setStarting] = React.useState(false);

  const running = job?.status === "queued" || job?.status === "running";

  async function poll(jobId: string) {
    const res = await fetch(
      `/api/admin/finishing-schedules/backfill-colours?jobId=${encodeURIComponent(jobId)}`,
      { credentials: "include", headers: { accept: "application/json" } },
    );
    const json = await readJson(res);
    setJob(json.job);
    return json.job;
  }

  async function startBackfill() {
    setStarting(true);
    try {
      const res = await fetch("/api/admin/finishing-schedules/backfill-colours", {
        method: "POST",
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const json = await readJson(res);
      setJob(json.job);
      toast.info("Colour backfill started.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start backfill.",
      );
    } finally {
      setStarting(false);
    }
  }

  React.useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) return;

    const id = window.setInterval(async () => {
      try {
        const next = await poll(job.id);
        if (next.status === "complete") {
          toast.success("Colour backfill complete.");
          setJob(null);
          router.refresh();
        } else if (next.status === "failed") {
          toast.error(next.error ?? "Colour backfill failed.");
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to read progress.",
        );
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [job, router]);

  return (
    <div className="flex min-w-72 flex-col items-stretch gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={startBackfill}
        disabled={starting || running}
        className="justify-center"
      >
        {starting || running ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Palette className="mr-2 h-4 w-4" />
        )}
        Backfill Colours
      </Button>

      {job ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {job.processed} / {job.total || "..."} items
            </span>
            <span>{job.percent}%</span>
          </div>
          <Progress value={job.percent} />
          <div className="truncate text-xs text-muted-foreground">
            {running
              ? job.currentSite
                ? `Scanning ${job.currentSite}`
                : "Preparing..."
              : `Created ${job.created}, updated ${job.updated}, existing ${job.duplicates}, skipped ${job.skipped}`}
          </div>
        </div>
      ) : null}
    </div>
  );
}
