"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import type { TimesheetDetailDto2 } from "@/lib/dtos";
import { normalizeTimesheetToGrid } from "@/lib/timesheets/normalizeTimesheetDetail";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { AnimatedLoader } from "@/components/ui/animated-loader";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import TimesheetGrid from "../timesheets/TimesheetGrid";

function prettyRange(startISO: string, endISO: string) {
  const a = new Date(`${startISO}T00:00:00.000Z`);
  const b = new Date(`${endISO}T00:00:00.000Z`);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(a)} – ${fmt(b)}`;
}

function statusClass(s: string) {
  if (s === "APPROVED")
    return "border-emerald-500/25 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (s === "REJECTED")
    return "border-rose-500/25 bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (s === "SUBMITTED")
    return "border-sky-600/25 bg-sky-600/15 text-sky-700 dark:text-sky-300";
  if (s === "PAID")
    return "border-purple-500/25 bg-purple-500/15 text-purple-700 dark:text-purple-300";
  return "border-slate-500/25 bg-slate-500/15 text-slate-700 dark:text-slate-300";
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-1 text-xs font-extrabold",
        statusClass(status),
      ].join(" ")}
    >
      {status}
    </span>
  );
}

function toSafeErrorText(e: unknown) {
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

async function postJson(url: string, body?: any) {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      payload?.error || payload?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return payload;
}

export interface TimesheetAction {
  id: string;
  label: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  canPerform: (status: string) => boolean;
  handler: (reason?: string) => Promise<void>;
  requiresReason?: boolean;
}

export default function TimesheetSheet({
  open,
  onOpenChange,
  detail,
  loading,
  error,
  activeId,
  onRetry,
  onRefreshDetail,
  actions = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: TimesheetDetailDto2 | null;
  loading: boolean;
  error: string | null;
  activeId: string | null;
  onRetry: () => void;
  onRefreshDetail: () => Promise<void>;
  actions?: TimesheetAction[];
}) {
  const [actionLoading, setActionLoading] = useState<null | string>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const sites = useMemo(() => detail?.sites ?? [], [detail]);
  const actionWithReason = actions.find((a) => a.requiresReason);

  async function runAction(actionId: string) {
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;

    setActionErr(null);
    setActionLoading(actionId);
    try {
      if (action.requiresReason) {
        const reason = rejectReason.trim();
        if (!reason) throw new Error("Reason is required for this action.");
        await action.handler(reason);
      } else {
        await action.handler();
      }
      await onRefreshDetail();
    } catch (e) {
      setActionErr(toSafeErrorText(e));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* EXACT admin styling: full screen bottom, no padding */}
      <SheetContent side="bottom" className="w-full h-full p-0 m-0 gap-0">
        <SheetHeader className="px-3 pt-6">
          <SheetTitle className="hidden">Timesheet</SheetTitle>

          {detail && (
            <div className="rounded border py-2 mt-4 text-left flex items-start justify-between px-3 gap-3">
              <div className="text-sm text-muted-foreground flex flex-col gap-1 flex-1 pr-4">
                <span>Fortnight Range</span>
                <div className="font-semibold text-amber-50 py-1 border rounded px-3">
                  {prettyRange(detail.startISO, detail.endISO)} (Sat–Fri)
                </div>
                <div className="pt-2">
                  <StatusPill status={detail.status} />
                </div>
              </div>

              <div className="flex flex-col gap-1 flex-1 px-4 border-l-2 border-card">
                <div className="text-sm text-muted-foreground">Foreman</div>
                <div className="font-medium py-1 border rounded px-3">
                  {detail.foreman?.name ?? "—"}
                </div>
              </div>

              <div className="flex flex-col gap-1 border-l-2 border-card px-4 flex-1">
                <div className="text-sm text-muted-foreground">
                  Contract Manager:
                </div>
                <div className="font-medium py-1 border rounded px-3">
                  {detail.supervisor?.name ?? "—"}
                </div>
              </div>

              <div className="flex flex-col gap-1 border-l-2 border-card px-4 flex-1">
                <div className="text-sm text-muted-foreground">Site Info</div>
                <div className="mt-1 flex flex-col gap-1">
                  {sites.length ? (
                    sites.map((s) => (
                      <div
                        key={s.id}
                        className="font-medium py-1 border rounded px-3 w-full"
                      >
                        {(s.code ? `${s.code} · ` : "") + s.name}
                      </div>
                    ))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ACTION BAR (inside header like admin style) */}
          {detail ? (
            <div className="mt-3 px-3 flex flex-col gap-2">
              {actionErr ? (
                <div className="text-sm text-rose-600 dark:text-rose-400">
                  {actionErr}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                  <Button
                    key={action.id}
                    variant={action.variant || "default"}
                    disabled={
                      !action.canPerform(detail?.status ?? "") ||
                      actionLoading !== null
                    }
                    onClick={() => runAction(action.id)}
                  >
                    {actionLoading === action.id
                      ? `${action.label}…`
                      : action.label}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  onClick={onRetry}
                  disabled={!activeId}
                >
                  Refresh Detail
                </Button>

                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>

              {/* Show reason input for action that requires it */}
              {actionWithReason &&
              actionWithReason.canPerform(detail?.status ?? "") ? (
                <div className="mt-2 max-w-2xl">
                  <div className="text-xs text-muted-foreground mb-1">
                    {actionWithReason.label} reason (required)
                  </div>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Type reason…"
                    className="min-h-20"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetHeader>

        <div className="mt-4">
          {loading ? (
            <AnimatedLoader />
          ) : error ? (
            <div className="px-3 space-y-3">
              <div className="text-sm text-rose-600 dark:text-rose-400">
                {error}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onRetry}
                  disabled={!activeId}
                >
                  Retry
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : detail ? (
            <ScrollArea className="h-[90vh] px-3">
              <div className="space-y-3 pb-10">
                <TimesheetGrid model={normalizeTimesheetToGrid(detail)} />
              </div>
            </ScrollArea>
          ) : (
            <div className="px-3 text-sm text-muted-foreground">
              Select a timesheet to view details.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
