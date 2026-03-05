"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  RotateCw,
  CalendarCheck,
  Trash2,
  Eye,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// Using native <table> for richer styling (vertical borders, compact rows)
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MeetingSummary = {
  id: string;
  startDate: string;
  endDate: string;
  meetingOn: string;
  createdAt: string;
  totals: {
    totalMaterialCost: number;
    totalWagesCost: number;
    totalProjectCost: number;
  } | null;
  createdBy: { id: string; name: string } | null;
  siteCount: number;
};

type MeetingDetail = {
  id: string;
  startDate: string;
  endDate: string;
  meetingOn: string;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  totals: {
    totalMaterialCost: number;
    totalWagesCost: number;
    totalProjectCost: number;
    totalRevenueClaimed: number;
    totalRevenueReceived: number;
    totalProfitOrLoss: number;
  } | null;
  rows: MeetingRow[];
};

type MeetingRow = {
  id: string;
  site: { id: string; name: string; code: string | null };
  materialCost: number;
  wagesCost: number;
  projectCost: number;
  revenueClaimed: number;
  revenueReceived: number;
  profitOrLoss: number;
  materialPct: number | null;
  wagesPct: number | null;
  profitPct: number | null;
  prevMaterialCost: number | null;
  prevWagesCost: number | null;
  prevProjectCost: number | null;
  materialCostDeltaPct: number | null;
  wagesCostDeltaPct: number | null;
  projectCostDeltaPct: number | null;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtPct(n: number | null) {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const isUp = value > 0;
  const isDown = value < 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isUp
          ? "text-red-500"
          : isDown
            ? "text-green-500"
            : "text-muted-foreground"
      }`}
    >
      {isUp ? (
        <TrendingUp className="h-3 w-3" />
      ) : isDown ? (
        <TrendingDown className="h-3 w-3" />
      ) : null}
      {fmtPct(value)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FortnightMeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail view
  const [detail, setDetail] = useState<MeetingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Generate dialog
  const [generateOpen, setGenerateOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [generating, setGenerating] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<MeetingSummary | null>(null);

  // Pagination
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(meetings.length / PAGE_SIZE));
  const paginatedMeetings = meetings.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/admin/fortnight-meetings", {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setMeetings(json.data);
      setPage(1);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // Open generate dialog
  function openGenerate() {
    setRangeEnd(new Date().toISOString().slice(0, 10));
    setMeetingDate(new Date().toISOString().slice(0, 10));
    setGenerateOpen(true);
  }

  async function handleGenerate() {
    if (!rangeStart || !rangeEnd) {
      toast.error("Please select both start and end dates");
      return;
    }
    if (rangeStart >= rangeEnd) {
      toast.error("Start date must be before end date");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/app/admin/fortnight-meetings", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startDate: rangeStart,
          endDate: rangeEnd,
          meetingOn: meetingDate || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to generate");
      toast.success("Meeting report generated");
      setGenerateOpen(false);
      setRangeStart("");
      loadMeetings();
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate meeting");
    } finally {
      setGenerating(false);
    }
  }

  async function viewDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/app/admin/fortnight-meetings/${id}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setDetail(json.data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load meeting detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/app/admin/fortnight-meetings/${deleteTarget.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      toast.success("Meeting deleted");
      setDeleteTarget(null);
      if (detail?.id === deleteTarget.id) setDetail(null);
      loadMeetings();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete meeting");
    }
  }

  // ── Detail view ──────────────────────────────────────────────────
  if (detail) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setDetail(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              Fortnight Meeting —{" "}
              {`${fmtDate(detail.startDate)} – ${fmtDate(detail.endDate)}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              Meeting date: {fmtDate(detail.meetingOn)}
              {detail.createdBy && ` · Generated by ${detail.createdBy.name}`}
            </p>
          </div>
        </div>

        {/* Summary cards */}
        {detail.totals && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Material Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {fmtCurrency(detail.totals.totalMaterialCost)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Wages Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {fmtCurrency(detail.totals.totalWagesCost)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Project Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {fmtCurrency(detail.totals.totalProjectCost)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Revenue Claimed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {fmtCurrency(detail.totals.totalRevenueClaimed)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Revenue Received
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {fmtCurrency(detail.totals.totalRevenueReceived)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Profit / Loss
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-lg font-bold ${
                    detail.totals.totalProfitOrLoss >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {fmtCurrency(detail.totals.totalProfitOrLoss)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Site rows table */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60 divide-x divide-slate-200 dark:divide-slate-700/60">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Site
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Material
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Wages
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Project Cost
                </th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Mat %
                </th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Wages %
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Prev Material
                </th>
                <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Prev Wages
                </th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Mat Δ
                </th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Wages Δ
                </th>
                <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Cost Δ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {detail.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="text-center py-8 text-slate-400 dark:text-slate-500"
                  >
                    No site data for this period
                  </td>
                </tr>
              ) : (
                detail.rows.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors divide-x divide-slate-200 dark:divide-slate-700/60"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white text-[13px]">
                        {r.site.name}
                      </div>
                      {r.site.code && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {r.site.code}
                        </div>
                      )}
                    </td>
                    <td className="text-right px-3 py-3 text-[13px] text-slate-700 dark:text-slate-300 tabular-nums">
                      {fmtCurrency(r.materialCost)}
                    </td>
                    <td className="text-right px-3 py-3 text-[13px] text-slate-700 dark:text-slate-300 tabular-nums">
                      {fmtCurrency(r.wagesCost)}
                    </td>
                    <td className="text-right px-3 py-3 text-[13px] font-semibold text-slate-900 dark:text-white tabular-nums">
                      {fmtCurrency(r.projectCost)}
                    </td>
                    <td className="text-center px-3 py-3 text-[12px] text-slate-500 dark:text-slate-400">
                      {r.materialPct != null
                        ? `${r.materialPct.toFixed(0)}%`
                        : "—"}
                    </td>
                    <td className="text-center px-3 py-3 text-[12px] text-slate-500 dark:text-slate-400">
                      {r.wagesPct != null ? `${r.wagesPct.toFixed(0)}%` : "—"}
                    </td>
                    <td className="text-right px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {r.prevMaterialCost != null
                        ? fmtCurrency(r.prevMaterialCost)
                        : "—"}
                    </td>
                    <td className="text-right px-3 py-3 text-[12px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {r.prevWagesCost != null
                        ? fmtCurrency(r.prevWagesCost)
                        : "—"}
                    </td>
                    <td className="text-center px-3 py-3">
                      <DeltaBadge value={r.materialCostDeltaPct} />
                    </td>
                    <td className="text-center px-3 py-3">
                      <DeltaBadge value={r.wagesCostDeltaPct} />
                    </td>
                    <td className="text-center px-3 py-3">
                      <DeltaBadge value={r.projectCostDeltaPct} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {detail.rows.length > 0 && detail.totals && (
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 divide-x divide-slate-200 dark:divide-slate-700/60">
                  <td className="px-4 py-3 text-[12px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    Total
                  </td>
                  <td className="text-right px-3 py-3 text-[13px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {fmtCurrency(detail.totals.totalMaterialCost)}
                  </td>
                  <td className="text-right px-3 py-3 text-[13px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {fmtCurrency(detail.totals.totalWagesCost)}
                  </td>
                  <td className="text-right px-3 py-3 text-[13px] font-bold text-slate-900 dark:text-white tabular-nums">
                    {fmtCurrency(detail.totals.totalProjectCost)}
                  </td>
                  <td colSpan={7} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Fortnight Meetings</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={loadMeetings}>
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button onClick={openGenerate} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Generate Report
          </Button>
        </div>
      </div>

      {/* Meetings list */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/60 divide-x divide-slate-200 dark:divide-slate-700/60">
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Date Range
              </th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Meeting Date
              </th>
              <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Material Cost
              </th>
              <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Wages Cost
              </th>
              <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Total Cost
              </th>
              <th className="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Sites
              </th>
              <th className="text-right px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-8 text-slate-400 dark:text-slate-500"
                >
                  <RotateCw className="mx-auto h-5 w-5 mb-2 animate-spin opacity-40" />
                  Loading...
                </td>
              </tr>
            ) : meetings.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-8 text-slate-400 dark:text-slate-500"
                >
                  <CalendarCheck className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  No meetings generated yet. Click &quot;Generate Report&quot;
                  to create one.
                </td>
              </tr>
            ) : (
              paginatedMeetings.map((m) => (
                <tr
                  key={m.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors divide-x divide-slate-200 dark:divide-slate-700/60"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white text-[13px]">
                      {fmtDate(m.startDate)} – {fmtDate(m.endDate)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[13px] text-slate-600 dark:text-slate-300">
                    {fmtDate(m.meetingOn)}
                  </td>
                  <td className="text-right px-3 py-3 text-[13px] text-slate-700 dark:text-slate-300 tabular-nums">
                    {m.totals ? fmtCurrency(m.totals.totalMaterialCost) : "—"}
                  </td>
                  <td className="text-right px-3 py-3 text-[13px] text-slate-700 dark:text-slate-300 tabular-nums">
                    {m.totals ? fmtCurrency(m.totals.totalWagesCost) : "—"}
                  </td>
                  <td className="text-right px-3 py-3 text-[13px] font-semibold text-slate-900 dark:text-white tabular-nums">
                    {m.totals ? fmtCurrency(m.totals.totalProjectCost) : "—"}
                  </td>
                  <td className="text-center px-3 py-3">
                    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {m.siteCount}
                    </span>
                  </td>
                  <td className="text-right px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => viewDetail(m.id)}
                        disabled={detailLoading}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setDeleteTarget(m)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && meetings.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-[12px] text-slate-400 dark:text-slate-500 tabular-nums">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, meetings.length)} of {meetings.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-[12px] text-slate-500 dark:text-slate-400 tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Fortnight Meeting Report</DialogTitle>
            <DialogDescription>
              Select a date range to calculate material costs, wages, and
              compare with the previous report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">From Date *</label>
              <Input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">To Date *</label>
              <Input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Meeting Date</label>
              <Input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Meeting"
        description="Are you sure you want to delete this fortnight meeting report? This cannot be undone."
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
