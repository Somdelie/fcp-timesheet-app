"use client";

import * as React from "react";
import { useMemo } from "react";
import { Printer } from "lucide-react";
import { toast } from "react-toastify";
import { formatCurrency } from "@/lib/formatCurrency";
import { printTimesheet } from "@/lib/generateTimesheetPdf";

import { Button } from "@/components/ui/button";
import { AnimatedLoader } from "@/components/ui/animated-loader";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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

// ✅ adjust to your real path
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

  gridModel?: TimesheetGridModel | null;
  gridComponent: React.ReactNode;
  prettyRange: (startISO: string, endISO: string) => string;

  // Optional: distinguish admin vs supervisor for UI controls
  mode?: "ADMIN" | "SUPERVISOR";
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
>(props: TimesheetDetailSheetProps<T>) {
  const {
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
    mode,
  } = props;

  const [actionLoading, setActionLoading] = React.useState<null | string>(null);
  const [actionErr, setActionErr] = React.useState<string | null>(null);

  const [reasonDialogOpen, setReasonDialogOpen] = React.useState(false);
  const [pendingActionId, setPendingActionId] = React.useState<string | null>(
    null,
  );
  const [reasonText, setReasonText] = React.useState("");

  // Manage Deductions dialog (ADMIN only)
  const [deductionDialogOpen, setDeductionDialogOpen] = React.useState(false);
  const [deductionSubmitting, setDeductionSubmitting] = React.useState(false);
  const [deductionEmployeeId, setDeductionEmployeeId] =
    React.useState<string>("");
  const [deductionType, setDeductionType] = React.useState<"CASH" | "PRODUCT">(
    "CASH",
  );
  const [deductionApplyTo, setDeductionApplyTo] = React.useState<
    "CURRENT" | "NEXT"
  >("CURRENT");
  const [deductionAmount, setDeductionAmount] = React.useState<string>("");
  const [deductionProductId, setDeductionProductId] =
    React.useState<string>("");
  const [deductionQuantity, setDeductionQuantity] = React.useState<string>("1");
  const [deductionNote, setDeductionNote] = React.useState<string>("");

  const [productOptions, setProductOptions] = React.useState<
    { id: string; name: string; price: string }[]
  >([]);
  const [productOptionsLoading, setProductOptionsLoading] =
    React.useState(false);

  // ✅ export EXACT table look without changing your UI theme:
  // we snapshot a cloned node (handled in exportDomToPdf)
  const gridExportRef = React.useRef<HTMLDivElement | null>(null);

  const safeGridModel = gridModel ?? ({} as any);
  const detailStatus = (detail as any)?.status ?? "—";

  const foremanDisplay = String(
    (safeGridModel as any)?.foremanName ??
      (detail as any)?.foremanName ??
      (detail as any)?.foreman?.name ??
      "—",
  ).trim();

  const contractManagerDisplay = String(
    (detail as any)?.supervisorName ?? (detail as any)?.supervisor?.name ?? "—",
  ).trim();

  const sites = useMemo(() => (detail as any)?.sites ?? [], [detail]);

  const employeeOptions = useMemo(() => {
    const rows = (gridModel as any)?.rows ?? [];
    if (!Array.isArray(rows)) return [] as Array<{ id: string; label: string }>;
    return rows.map((r: any) => ({
      id: String(r?.id ?? r?.employeeId ?? ""),
      label: String(r?.label ?? r?.fullName ?? "Employee").trim() || "Employee",
    }));
  }, [gridModel]);

  const foremanId = (detail as any)?.foreman?.id as string | undefined;

  const SUGGESTED_REASONS = [
    "Missing documentation",
    "Incorrect hours",
    "Incomplete information",
    "Cannot verify details",
    "Duplicate entry",
  ];

  async function runAction(actionId: string) {
    const action = actions.find((a) => a.id === actionId);
    if (!action || !detail) return;

    if (!action.canPerform(detailStatus)) {
      toast.info("Action not available for this status");
      return;
    }

    if (action.requiresReason) {
      setPendingActionId(actionId);
      setActionErr(null);
      setReasonText("");
      setReasonDialogOpen(true);
      return;
    }

    setActionErr(null);
    setActionLoading(actionId);
    try {
      await action.handler();
      toast.success(action.label);
      await onRefreshDetail?.();
    } catch (err) {
      console.error(err);
      setActionErr(err instanceof Error ? err.message : "Action failed");
      toast.error("Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmRejectionWithReason() {
    const actionId = pendingActionId;
    if (!actionId) return;

    const action = actions.find((a) => a.id === actionId);
    if (!action) return;

    const reason = reasonText.trim();
    if (!reason) {
      toast.error("Please enter a reason");
      return;
    }

    setActionErr(null);
    setActionLoading(actionId);
    try {
      await action.handler(reason);
      toast.success(action.label);

      setReasonDialogOpen(false);
      setReasonText("");
      setPendingActionId(null);

      await onRefreshDetail?.();
    } catch (err) {
      console.error(err);
      setActionErr(err instanceof Error ? err.message : "Action failed");
      toast.error("Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  React.useEffect(() => {
    if (!deductionDialogOpen || deductionType !== "PRODUCT") return;

    setProductOptionsLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/app/admin/products", {
          method: "GET",
          credentials: "include",
          headers: {
            accept: "application/json",
          },
        });

        const json = await res.json().catch(() => null as any);
        if (!res.ok) {
          const msg =
            json?.error ||
            json?.message ||
            `Failed to load products (${res.status})`;
          throw new Error(msg);
        }

        if (json?.ok && Array.isArray(json.products)) {
          setProductOptions(json.products);
        } else {
          setProductOptions([]);
        }
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "Failed to load products",
        );
      } finally {
        setProductOptionsLoading(false);
      }
    })();
  }, [deductionDialogOpen, deductionType]);

  // ✅ totals from normalized model (same numbers grid uses)
  const foremanTotals = {
    days: Number((gridModel as any)?.totals?.foremanDays ?? 0),
    pay: Number((gridModel as any)?.totals?.foremanPay ?? 0),
  };
  const teamTotals = {
    days: Number((gridModel as any)?.totals?.teamDays ?? 0),
    pay: Number((gridModel as any)?.totals?.teamPay ?? 0),
  };

  const totalDays = foremanTotals.days + teamTotals.days;
  const totalPay = foremanTotals.pay + teamTotals.pay;

  // Optional deductions + net pay from detail payload (admin view)
  const totalsFromDetail = (detail as any)?.totals as
    | { totalDeductions?: number; netPay?: number; totalPay?: number }
    | undefined;

  const totalDeductions = Number(totalsFromDetail?.totalDeductions ?? 0);
  const netPay =
    typeof totalsFromDetail?.netPay === "number"
      ? Number(totalsFromDetail?.netPay)
      : totalPay - totalDeductions;

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
                <div className="text-sm text-muted-foreground">Manager</div>
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
                  {actions
                    .filter((action) => action.canPerform(detailStatus))
                    .map((action) => (
                      <Button
                        key={action.id}
                        variant={action.variant || "default"}
                        disabled={actionLoading !== null}
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

                  {mode === "ADMIN" &&
                  employeeOptions.length > 0 &&
                  foremanId ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!deductionEmployeeId && employeeOptions[0]) {
                          setDeductionEmployeeId(employeeOptions[0].id);
                        }
                        setDeductionDialogOpen(true);
                      }}
                    >
                      Add Deduction
                    </Button>
                  ) : null}

                  {/* ✅ PRINT button - opens print preview window */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!gridModel) {
                        toast.error("Nothing to print");
                        return;
                      }

                      printTimesheet(gridModel, {
                        foremanName: foremanDisplay,
                        contractManagerName: contractManagerDisplay,
                        startDate: (detail as any)?.startISO,
                        endDate: (detail as any)?.endISO,
                        sites: sites,
                        status: detailStatus,
                      });
                    }}
                    disabled={!gridModel}
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Print
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

        {/* ADD DEDUCTION DIALOG (ADMIN) */}
        <Dialog
          open={deductionDialogOpen}
          onOpenChange={(open) => {
            setDeductionDialogOpen(open);
            if (!open) {
              setDeductionSubmitting(false);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Deduction</DialogTitle>
              <DialogDescription>
                Create a cash or product deduction for a worker under this
                foreman.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Employee</label>
                <Select
                  value={deductionEmployeeId}
                  onValueChange={setDeductionEmployeeId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeOptions.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={deductionType}
                    onValueChange={(v) =>
                      setDeductionType(v as "CASH" | "PRODUCT")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="PRODUCT">Product</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Apply To</label>
                  <Select
                    value={deductionApplyTo}
                    onValueChange={(v) =>
                      setDeductionApplyTo(v as "CURRENT" | "NEXT")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CURRENT">Current fortnight</SelectItem>
                      <SelectItem value="NEXT">Next fortnight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {deductionType === "CASH" ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Amount</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={deductionAmount}
                    onChange={(e) => setDeductionAmount(e.target.value)}
                    placeholder="e.g. 100.00"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Product</label>
                    <Select
                      value={deductionProductId}
                      onValueChange={(v) => setDeductionProductId(v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            productOptionsLoading
                              ? "Loading products…"
                              : "Select a product"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {productOptions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({formatCurrency(Number(p.price))})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Quantity</label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={deductionQuantity}
                      onChange={(e) => setDeductionQuantity(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">Note</label>
                <Textarea
                  value={deductionNote}
                  onChange={(e) => setDeductionNote(e.target.value)}
                  placeholder="Optional note about this deduction"
                  className="min-h-20"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeductionDialogOpen(false)}
                disabled={deductionSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!foremanId) {
                    toast.error("Missing foreman id for deduction");
                    return;
                  }
                  if (!deductionEmployeeId) {
                    toast.error("Please select an employee");
                    return;
                  }

                  setDeductionSubmitting(true);
                  try {
                    const payload: any = {
                      employeeId: deductionEmployeeId,
                      foremanId,
                      type: deductionType,
                      applyTo: deductionApplyTo,
                      note: deductionNote.trim() || undefined,
                    };

                    if (deductionType === "CASH") {
                      if (!deductionAmount.trim()) {
                        toast.error("Please enter an amount");
                        setDeductionSubmitting(false);
                        return;
                      }
                      payload.amount = deductionAmount.trim();
                    } else {
                      if (!deductionProductId.trim()) {
                        toast.error(
                          "Product ID is required for product deductions",
                        );
                        setDeductionSubmitting(false);
                        return;
                      }
                      const qty = parseInt(deductionQuantity || "0", 10);
                      if (!Number.isFinite(qty) || qty <= 0) {
                        toast.error("Quantity must be a positive integer");
                        setDeductionSubmitting(false);
                        return;
                      }
                      payload.productId = deductionProductId.trim();
                      payload.quantity = qty;
                    }

                    const res = await fetch("/api/app/admin/deductions", {
                      method: "POST",
                      credentials: "include",
                      headers: {
                        "content-type": "application/json",
                        accept: "application/json",
                      },
                      body: JSON.stringify(payload),
                    });

                    const json = await res.json().catch(() => null as any);
                    if (!res.ok) {
                      const msg =
                        json?.error ||
                        json?.message ||
                        `Failed to create deduction (${res.status})`;
                      throw new Error(msg);
                    }

                    toast.success("Deduction added");
                    setDeductionDialogOpen(false);
                    setDeductionAmount("");
                    setDeductionProductId("");
                    setDeductionQuantity("1");
                    setDeductionNote("");

                    await onRefreshDetail?.();
                  } catch (err) {
                    console.error(err);
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Failed to create deduction",
                    );
                  } finally {
                    setDeductionSubmitting(false);
                  }
                }}
                disabled={deductionSubmitting}
              >
                {deductionSubmitting ? "Saving…" : "Save Deduction"}
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
              {/* ✅ DO NOT add bg-white here (keeps dark mode nice) */}
              <div
                ref={gridExportRef}
                className="max-w-7xl"
                style={{
                  WebkitPrintColorAdjust: "exact",
                  printColorAdjust: "exact",
                }}
              >
                {gridComponent}
              </div>

              {/* Totals cards */}
              <div className="flex gap-4 flex-wrap justify-end items-stretch">
                <div className="text-sm border rounded px-3 py-2 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-xs text-right">
                  <div className="text-muted-foreground text-xs font-semibold">
                    FOREMAN TOTAL
                  </div>
                  <div className="font-medium mt-1">
                    Total amount to be paid to {foremanDisplay}:
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-semibold">
                    {formatCurrency(netPay)}
                  </div>
                </div>

                <div className="flex gap-4 flex-wrap justify-end">
                  <div className="text-sm border rounded px-3 py-2 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <div className="text-muted-foreground text-xs font-semibold">
                      TOTAL (GROSS)
                    </div>
                    <div className="font-medium mt-1">
                      {totalDays} days • {formatCurrency(totalPay)}
                    </div>
                  </div>

                  {totalDeductions > 0 ? (
                    <div className="text-sm border rounded px-3 py-2 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                      <div className="text-muted-foreground text-xs font-semibold">
                        DEDUCTIONS
                      </div>
                      <div className="font-medium mt-1">
                        Total deductions: {formatCurrency(totalDeductions)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Net pay: {formatCurrency(netPay)}
                      </div>
                    </div>
                  ) : null}

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
