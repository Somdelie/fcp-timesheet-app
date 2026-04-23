"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, X, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateSchedulerTaskColumn } from "@/actions/scheduler";
import type { Task } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Module-level session tracking — survives client-side navigation    */
/*  but resets on hard refresh (so overdue tasks re-alert each visit)  */
/* ------------------------------------------------------------------ */
const alertedThisSession = new Set<string>();

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function playAlert() {
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [0, 0.35, 0.7].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.45, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + offset + 0.28,
      );
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.3);
    });
  } catch {}
}

function isOverdue(task: Task): boolean {
  if (!task.time || task.column === "done") return false;
  const today = new Date().toISOString().slice(0, 10);
  if (task.date.slice(0, 10) !== today) return false;
  const [h, m] = task.time.split(":").map(Number);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-ZA", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/* ------------------------------------------------------------------ */
/*  Provider                                                            */
/* ------------------------------------------------------------------ */

export function SchedulerAlertProvider() {
  const [queue, setQueue] = useState<Task[]>([]);
  const [current, setCurrent] = useState<Task | null>(null);
  const [isMarkingDone, setIsMarkingDone] = useState(false);

  async function fetchAndCheck() {
    try {
      const res = await fetch("/api/app/scheduler", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const tasks: Task[] = data.tasks ?? [];

      const overdue = tasks.filter(
        (t) => isOverdue(t) && !alertedThisSession.has(t.id),
      );
      if (overdue.length === 0) return;

      overdue.forEach((t) => alertedThisSession.add(t.id));
      setQueue((prev) => {
        const existing = new Set(prev.map((t) => t.id));
        return [...prev, ...overdue.filter((t) => !existing.has(t.id))];
      });
    } catch {}
  }

  /* On mount: fetch immediately then every 60 s */
  useEffect(() => {
    fetchAndCheck();
    const interval = setInterval(fetchAndCheck, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Drain queue one at a time */
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
    playAlert();
  }, [queue, current]);

  async function handleMarkDone() {
    if (!current) return;
    setIsMarkingDone(true);
    try {
      await updateSchedulerTaskColumn(current.id, "done");
    } finally {
      setIsMarkingDone(false);
      setCurrent(null);
    }
  }

  function handleDismiss() {
    setCurrent(null);
  }

  if (!current) return null;

  const columnLabel =
    current.column === "in-progress"
      ? "In Progress"
      : current.column === "todo"
        ? "To Do"
        : current.column;

  const isPriorityHigh = current.priority === "high";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Outer pulsing ring */}
      <div className="absolute size-72 animate-ping rounded-full bg-primary/10" style={{ animationDuration: "1.5s" }} />

      <div className="relative w-full max-w-[420px] mx-4 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Priority accent bar */}
        <div
          className={cn(
            "h-1 w-full",
            isPriorityHigh
              ? "bg-rose-500"
              : current.priority === "medium"
                ? "bg-amber-500"
                : "bg-primary",
          )}
        />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 animate-bounce items-center justify-center rounded-xl bg-primary/10">
              <Bell className="size-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                Scheduled Reminder
              </p>
              <h3 className="text-lg font-bold leading-tight text-foreground">
                {current.title}
              </h3>
              {current.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {current.description}
                </p>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-secondary/50 px-4 py-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              {formatDate(current.date)}
            </span>
            {current.time && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Clock className="size-3.5 text-primary" />
                {current.time}
              </span>
            )}
            <span
              className={cn(
                "ml-auto rounded-full border px-2 py-px text-[9px] font-bold uppercase tracking-wide",
                current.column === "in-progress"
                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {columnLabel}
            </span>
          </div>

          {/* Queue indicator */}
          {queue.length > 0 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              +{queue.length} more reminder{queue.length > 1 ? "s" : ""} waiting
            </p>
          )}

          {/* Actions */}
          <div className="mt-5 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="flex-1 text-muted-foreground"
            >
              <X className="mr-1.5 size-3.5" />
              Dismiss
            </Button>
            <Button
              size="sm"
              disabled={isMarkingDone}
              onClick={handleMarkDone}
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCheck className="mr-1.5 size-3.5" />
              Mark Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
