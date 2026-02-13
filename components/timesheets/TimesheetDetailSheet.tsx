"use client";

import * as React from "react";
import { useMemo } from "react";
import { formatCurrency } from "@/lib/formatCurrency";

import { Button } from "@/components/ui/button";
import { AnimatedLoader } from "@/components/ui/animated-loader";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ✅ IMPORTANT: adjust this import path to where your grid model type lives
import type { TimesheetGridModel } from "@/lib/timesheets/gridModel";

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

export interface TimesheetDetailSheetProps<
  T extends {
    status?: string;
    sites?: any[];
    startISO?: string;
    endISO?: string;
  },
> {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: T | null;
  loading: boolean;
  error: string | null;
  activeId: string | null;
  onRetry: () => void;
  onRefreshDetail: () => Promise<void>;
  actions?: TimesheetAction[];

  /**
   * ✅ FIX: pass the SAME normalized model you use for the grid
   * so header totals always match the grid (mobile-style columns).
   */
  gridModel?: TimesheetGridModel | null;

  /**
   * Rendered grid component (usually <TimesheetGrid model={gridModel} />)
   */
  gridComponent: React.ReactNode;

  prettyRange: (startISO: string, endISO: string) => string;
}

function toSafeErrorText(e: unknown) {
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function safeDiv(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return n / d;
}

export default function TimesheetDetailSheet<
  T extends {
    status?: string;
    sites?: any[];
    startISO?: string;
    endISO?: string;
  },
>({
  open,
  onOpenChange,
  detail,
  loading,
  error,
  activeId,
  onRetry,
  onRefreshDetail,
  actions = [],
  gridModel,
  gridComponent,
  prettyRange,
}: TimesheetDetailSheetProps<T>) {
  const [actionLoading, setActionLoading] = React.useState<null | string>(null);
  const [actionErr, setActionErr] = React.useState<string | null>(null);

  const [reasonDialogOpen, setReasonDialogOpen] = React.useState(false);
  const [pendingActionId, setPendingActionId] = React.useState<string | null>(
    null,
  );
  const [reasonText, setReasonText] = React.useState("");

  const SUGGESTED_REASONS = [
    "Missing documentation",
    "Incorrect hours",
    "Incomplete information",
    "Cannot verify details",
    "Duplicate entry",
  ];

  const sites = useMemo(() => (detail as any)?.sites ?? [], [detail]);

  async function runAction(actionId: string) {
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;

    if (action.requiresReason) {
      setPendingActionId(actionId);
      setActionErr(null);
      setReasonDialogOpen(true);
      return;
    }

    setActionErr(null);
    setActionLoading(actionId);
    try {
      await action.handler();
      await onRefreshDetail();
    } catch (e) {
      setActionErr(toSafeErrorText(e));
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmRejectionWithReason() {
    if (!pendingActionId) return;

    const action = actions.find((a) => a.id === pendingActionId);
    if (!action) return;

    const reason = reasonText.trim();
    if (!reason) {
      setActionErr("Reason is required.");
      return;
    }

    setActionErr(null);
    setActionLoading(pendingActionId);
    setReasonDialogOpen(false);

    try {
      await action.handler(reason);
      await onRefreshDetail();
      setReasonText("");
    } catch (e) {
      setActionErr(toSafeErrorText(e));
    } finally {
      setActionLoading(null);
      setPendingActionId(null);
    }
  }

  const detailStatus = String((detail as any)?.status ?? "").trim();

  // ✅ FIX: accept either flattened strings OR nested objects OR normalized gridModel
  const foremanDisplay =
    String((gridModel as any)?.foremanName ?? "").trim() ||
    String((detail as any)?.foremanName ?? "").trim() ||
    String((detail as any)?.foreman?.name ?? "").trim() ||
    "—";

  const contractManagerDisplay =
    String((detail as any)?.supervisorName ?? "").trim() ||
    String((detail as any)?.supervisor?.name ?? "").trim() ||
    "—";

  /**
   * ✅ FIX: Use the normalized model totals (same numbers the grid uses)
   * so we match mobile: F/man totals + Team totals.
   */
  const foremanTotals = {
    days: Number(gridModel?.totals?.foremanDays ?? 0),
    pay: Number(gridModel?.totals?.foremanPay ?? 0),
  };

  const teamTotals = {
    days: Number(gridModel?.totals?.teamDays ?? 0),
    pay: Number(gridModel?.totals?.teamPay ?? 0),
  };

  const totalDays = foremanTotals.days + teamTotals.days;
  const totalPay = foremanTotals.pay + teamTotals.pay;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="w-full h-full p-0 m-0 gap-0 overflow-hidden overflow-y-scroll"
      >
        <SheetHeader className="px-3 pt-6">
          <SheetTitle className="hidden">Timesheet</SheetTitle>

          {detail && (
            <div className="rounded border py-2 mt-4 text-left flex items-start justify-between px-3 gap-3">
              <div className="text-sm text-muted-foreground flex flex-col gap-1 flex-1 pr-4">
                <span>Fortnight Range</span>
                <div className="font-semibold py-1 border rounded px-3">
                  {prettyRange(
                    String((detail as any).startISO ?? ""),
                    String((detail as any).endISO ?? ""),
                  )}{" "}
                  (Sat–Fri)
                </div>

                <div className="pt-2">
                  <span className="text-xs font-bold">
                    {detailStatus || "—"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 flex-1 px-4 border-l-2 border-card">
                <div className="text-sm text-muted-foreground">Foreman</div>
                <div className="font-medium py-1 border rounded px-3">
                  {foremanDisplay}
                </div>
              </div>

              <div className="flex flex-col gap-1 border-l-2 border-card px-4 flex-1">
                <div className="text-sm text-muted-foreground">
                  Contract Manager
                </div>
                <div className="font-medium py-1 border rounded px-3">
                  {contractManagerDisplay}
                </div>
              </div>

              <div className="flex flex-col gap-1 border-l-2 border-card px-4 flex-1">
                <div className="text-sm text-muted-foreground">Site Info</div>
                <div className="mt-1 flex flex-col gap-1">
                  {Array.isArray(sites) && sites.length ? (
                    sites.map((s: any) => {
                      const code = String(s?.code ?? "").trim();
                      const name = String(s?.name ?? "").trim();
                      return (
                        <div
                          key={String(s?.id ?? `${code}-${name}`)}
                          className="font-medium py-1 border rounded px-3 w-full"
                        >
                          {(code ? `${code} · ` : "") + (name || "—")}
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ACTION BAR */}
          {detail ? (
            <div className="mt-3 px-3 flex flex-col gap-2">
              {actionErr ? (
                <div className="text-sm text-rose-600 dark:text-rose-400">
                  {actionErr}
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => (
                    <Button
                      key={action.id}
                      variant={action.variant || "default"}
                      disabled={
                        !action.canPerform(detailStatus) ||
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
              </div>
            </div>
          ) : null}
        </SheetHeader>

        {/* REJECT REASON DIALOG */}
        <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejection Reason</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this timesheet.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {actionErr ? (
                <div className="text-sm text-rose-600 dark:text-rose-400">
                  {actionErr}
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <Textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder="Type reason…"
                  className="min-h-20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Suggested reasons
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_REASONS.map((reason) => (
                    <Button
                      key={reason}
                      variant="outline"
                      size="sm"
                      onClick={() => setReasonText(reason)}
                    >
                      {reason}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setReasonDialogOpen(false);
                  setReasonText("");
                  setActionErr(null);
                  setPendingActionId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!reasonText.trim() || actionLoading !== null}
                onClick={confirmRejectionWithReason}
              >
                {actionLoading === pendingActionId ? "Rejecting…" : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* GRID/DETAIL CONTENT */}
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
            <div className="h-[70vh] px-3 overflow-auto flex flex-col gap-4">
              <div className="max-w-7xl">{gridComponent}</div>
              {/* ✅ Mobile-style totals cards (driven by gridModel) */}

              <div className="flex gap-4 flex-wrap justify-end items-stretch">
                <div className="text-sm border rounded px-3 py-2 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-xs text-right">
                  <div className="text-muted-foreground text-xs font-semibold">
                    FOREMAN TOTAL
                  </div>
                  <div className="font-medium mt-1">
                    Total amount to be paid to {foremanDisplay}:
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-semibold">
                    {formatCurrency(totalPay)}
                  </div>
                </div>

                <div className="flex gap-4 flex-wrap justify-end">
                  <div className="text-sm border rounded px-3 py-2 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <div className="text-muted-foreground text-xs font-semibold">
                      TOTAL
                    </div>
                    <div className="font-medium mt-1">
                      {totalDays} days • {formatCurrency(totalPay)}
                    </div>
                  </div>

                  {foremanTotals.days > 0 ? (
                    <div className="text-sm border rounded px-3 py-2 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                      <div className="text-muted-foreground text-xs font-semibold">
                        FOREMAN
                      </div>
                      <div className="font-medium mt-1">
                        {foremanTotals.days} days ×{" "}
                        {formatCurrency(
                          safeDiv(foremanTotals.pay, foremanTotals.days),
                        )}
                        /day
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Total: {formatCurrency(foremanTotals.pay)}
                      </div>
                    </div>
                  ) : null}

                  {teamTotals.days > 0 ? (
                    <div className="text-sm border rounded px-3 py-2 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                      <div className="text-muted-foreground text-xs font-semibold">
                        TEAM
                      </div>
                      <div className="font-medium mt-1">
                        {teamTotals.days} days ×{" "}
                        {formatCurrency(
                          safeDiv(teamTotals.pay, teamTotals.days),
                        )}
                        /day
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Total: {formatCurrency(teamTotals.pay)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
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
