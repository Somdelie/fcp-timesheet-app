"use client";

import * as React from "react";
import { useMemo } from "react";
import { Printer, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { formatCurrency } from "@/lib/formatCurrency";
import { printTimesheet } from "@/lib/generateTimesheetPdf";

import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
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

  // Product source: "ORDER" = from a pending order, "MANUAL" = manual product/qty
  const [productSource, setProductSource] = React.useState<"ORDER" | "MANUAL">(
    "ORDER",
  );
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>("");
  const [splitFortnights, setSplitFortnights] = React.useState<1 | 2>(1);
  const [pendingOrders, setPendingOrders] = React.useState<
    {
      id: string;
      foremanName: string;
      createdAt: string;
      items: {
        productName: string;
        quantity: number;
        unitPrice: string;
      }[];
    }[]
  >([]);
  const [pendingOrdersLoading, setPendingOrdersLoading] = React.useState(false);

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

  // Fetch pending orders for this foreman when product + order mode
  React.useEffect(() => {
    if (
      !deductionDialogOpen ||
      deductionType !== "PRODUCT" ||
      productSource !== "ORDER" ||
      !foremanId
    )
      return;

    setPendingOrdersLoading(true);
    (async () => {
      try {
        const url = new URL("/api/app/admin/orders", window.location.origin);
        url.searchParams.set("foremanId", foremanId);
        url.searchParams.set("status", "PENDING");

        const res = await fetch(url.toString(), {
          credentials: "include",
          headers: { accept: "application/json" },
        });
        const json = await res.json().catch(() => null as any);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load orders");

        if (json?.ok && Array.isArray(json.orders)) {
          setPendingOrders(json.orders);
        } else {
          setPendingOrders([]);
        }
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "Failed to load pending orders",
        );
      } finally {
        setPendingOrdersLoading(false);
      }
    })();
  }, [deductionDialogOpen, deductionType, productSource, foremanId]);

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

  // Individual deduction items from detail payload
  const deductionItemsList = useMemo(() => {
    const items = (detail as any)?.deductions as
      | {
          id: string;
          type: string;
          applyTo: string;
          amount: number;
          quantity: number | null;
          productName: string | null;
          employeeName: string;
          note: string | null;
          createdAt: string;
        }[]
      | undefined;
    return Array.isArray(items) ? items : [];
  }, [detail]);

  const isPaid = detailStatus === "PAID";

  const [deletingDeductionId, setDeletingDeductionId] = React.useState<
    string | null
  >(null);
  const [deleteDialogDeductionId, setDeleteDialogDeductionId] = React.useState<
    string | null
  >(null);

  async function handleDeleteDeduction(deductionId: string) {
    setDeletingDeductionId(deductionId);
    try {
      const res = await fetch(`/api/app/admin/deductions/${deductionId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const json = await res.json().catch(() => null as any);
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete deduction");
      toast.success("Deduction removed");
      await onRefreshDetail?.();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete deduction",
      );
    } finally {
      setDeletingDeductionId(null);
    }
  }

  return (
    <>
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
                    foremanId &&
                    !isPaid ? (
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

                        const totals = (detail as any)?.totals ?? {};
                        const overtimeTotal = Number(totals.overtimeTotal ?? 0);
                        const cashDeductionsTotal = Number(totals.cashDeductions ?? totals.totalDeductions ?? 0);
                        const productDeductionsTotal = Number(totals.productDeductions ?? 0);
                        const wagesCost =
                          typeof totals.wagesCost === "number"
                            ? Number(totals.wagesCost)
                            : Number(totals.totalPay ?? 0) + overtimeTotal - cashDeductionsTotal;
                        const netTotal =
                          typeof totals.netPay === "number"
                            ? Number(totals.netPay)
                            : wagesCost - productDeductionsTotal;

                        printTimesheet(gridModel, {
                          foremanName: foremanDisplay,
                          contractManagerName: contractManagerDisplay,
                          startDate: (detail as any)?.startISO,
                          endDate: (detail as any)?.endISO,
                          sites: sites,
                          status: detailStatus,
                          overtimeTotal,
                          cashDeductionsTotal,
                          productDeductionsTotal,
                          wagesCost,
                          netTotal,
                        });
                      }}
                      disabled={!gridModel}
                    >
                      <Printer className="h-4 w-4 mr-1" />
                      Print
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
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
            <DialogContent className="max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Add Deduction</DialogTitle>
                <DialogDescription>
                  Create a cash or product deduction for a worker under this
                  foreman.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
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
                        <SelectItem value="CURRENT">
                          Current fortnight
                        </SelectItem>
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
                  <>
                    {/* Sub-choice: From Order or Manual Product */}
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Source</label>
                      <Select
                        value={productSource}
                        onValueChange={(v) => {
                          setProductSource(v as "ORDER" | "MANUAL");
                          setSelectedOrderId("");
                          setDeductionProductId("");
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ORDER">From Order</SelectItem>
                          <SelectItem value="MANUAL">Manual Product</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {productSource === "ORDER" ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Pending Order
                        </label>
                        {pendingOrdersLoading ? (
                          <p className="text-sm text-muted-foreground">
                            Loading pending orders…
                          </p>
                        ) : pendingOrders.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No pending orders for this foreman.
                          </p>
                        ) : (
                          <>
                            <Select
                              value={selectedOrderId}
                              onValueChange={setSelectedOrderId}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select an order" />
                              </SelectTrigger>
                              <SelectContent>
                                {pendingOrders.map((o) => {
                                  const total = o.items.reduce(
                                    (s, i) =>
                                      s + Number(i.unitPrice) * i.quantity,
                                    0,
                                  );
                                  const productSummary = o.items
                                    .map(
                                      (i) => `${i.productName} ×${i.quantity}`,
                                    )
                                    .join(", ");
                                  return (
                                    <SelectItem key={o.id} value={o.id}>
                                      #{o.id.slice(-6)} — {productSummary} •{" "}
                                      {formatCurrency(total)} •{" "}
                                      {new Date(
                                        o.createdAt,
                                      ).toLocaleDateString()}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>

                            {/* Preview the selected order */}
                            {selectedOrderId &&
                              (() => {
                                const order = pendingOrders.find(
                                  (o) => o.id === selectedOrderId,
                                );
                                if (!order) return null;
                                const total = order.items.reduce(
                                  (s, i) =>
                                    s + Number(i.unitPrice) * i.quantity,
                                  0,
                                );
                                return (
                                  <div className="rounded border p-3 text-sm space-y-1 bg-muted/30">
                                    <div className="font-medium text-xs text-muted-foreground uppercase">
                                      Order Items
                                    </div>
                                    {order.items.map((item, idx) => (
                                      <div
                                        key={idx}
                                        className="flex justify-between"
                                      >
                                        <span>
                                          {item.productName} × {item.quantity}
                                        </span>
                                        <span className="font-medium">
                                          {formatCurrency(
                                            Number(item.unitPrice) *
                                              item.quantity,
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                    <div className="border-t pt-1 flex justify-between font-semibold">
                                      <span>Total</span>
                                      <span>{formatCurrency(total)}</span>
                                    </div>
                                    {splitFortnights === 2 && (
                                      <div className="border-t pt-1 mt-1 space-y-0.5 text-muted-foreground">
                                        <div className="flex justify-between">
                                          <span>Current fortnight (1/2)</span>
                                          <span>
                                            {formatCurrency(
                                              Math.floor(total * 100) / 200,
                                            )}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Next fortnight (2/2)</span>
                                          <span>
                                            {formatCurrency(
                                              total -
                                                Math.floor(total * 100) / 200,
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                            {/* Split across fortnights */}
                            {selectedOrderId && (
                              <div className="space-y-1">
                                <label className="text-sm font-medium">
                                  Deduction Split
                                </label>
                                <Select
                                  value={String(splitFortnights)}
                                  onValueChange={(v) =>
                                    setSplitFortnights(v === "2" ? 2 : 1)
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">
                                      Full amount this fortnight
                                    </SelectItem>
                                    <SelectItem value="2">
                                      Split half / half (2 fortnights)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </>
                        )}
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
                          <label className="text-sm font-medium">
                            Quantity
                          </label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={deductionQuantity}
                            onChange={(e) =>
                              setDeductionQuantity(e.target.value)
                            }
                          />
                        </div>
                      </div>
                    )}
                  </>
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
                      } else if (productSource === "ORDER") {
                        // Order-based product deduction
                        if (!selectedOrderId) {
                          toast.error("Please select a pending order");
                          setDeductionSubmitting(false);
                          return;
                        }
                        payload.orderId = selectedOrderId;
                        if (splitFortnights === 2) {
                          payload.splitFortnights = 2;
                        }
                      } else {
                        // Manual product deduction
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
                      setSelectedOrderId("");
                      setSplitFortnights(1);

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
                      <div className="text-sm border rounded px-3 py-2 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 min-w-[280px]">
                        <div className="text-muted-foreground text-xs font-semibold">
                          DEDUCTIONS
                        </div>
                        <div className="font-medium mt-1">
                          Total deductions: {formatCurrency(totalDeductions)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Net pay: {formatCurrency(netPay)}
                        </div>

                        {/* Individual deduction items */}
                        {deductionItemsList.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-amber-200 dark:border-amber-700 pt-2">
                            {deductionItemsList.map((d) => (
                              <div
                                key={d.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">
                                    {d.type === "PRODUCT"
                                      ? d.productName
                                        ? `${d.productName}${d.quantity ? " ×" + d.quantity : ""}`
                                        : "Product"
                                      : "Cash"}
                                  </span>
                                  <span className="text-muted-foreground ml-1">
                                    ({d.applyTo})
                                  </span>
                                  {d.note && (
                                    <span className="text-muted-foreground ml-1 truncate">
                                      — {d.note}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="font-semibold">
                                    {formatCurrency(d.amount)}
                                  </span>
                                  {mode === "ADMIN" && !isPaid && (
                                    <button
                                      type="button"
                                      className="p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-500 disabled:opacity-40"
                                      title="Remove deduction"
                                      disabled={deletingDeductionId === d.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteDialogDeductionId(d.id);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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

      <ConfirmationDialog
        open={deleteDialogDeductionId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogDeductionId(null);
        }}
        title="Remove Deduction?"
        description="This will permanently remove this deduction. If it was linked to an order, the order status will be reverted."
        onConfirm={() => {
          if (deleteDialogDeductionId) {
            handleDeleteDeduction(deleteDialogDeductionId);
            setDeleteDialogDeductionId(null);
          }
        }}
        isLoading={deletingDeductionId !== null}
        confirmText="Remove"
        variant="destructive"
      />
    </>
  );
}
