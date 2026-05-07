"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type SupervisorOption = { id: string; name: string | null; email: string };
type PeriodOption = {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
};

type ListRow = {
  id: string;
  foreman: { id: string; name: string };
  supervisor?: { id: string; name: string } | null;
  sites: Array<{ id: string; code: string | null; name: string }>;
  foremanDays: number;
  teamDays: number;
  totalWorkerDays: number;
};

type DetailColumn = { iso: string; day: string; date: string };
type DetailRow = {
  employeeId: string;
  fullName: string;
  present: boolean[];
  daysWorked: number;
};

type ForemanSiteRow = {
  foremanName: string;
  jobNo: string;
  siteName: string;
  dailyCounts: number[];
  foremanPresence: boolean[];
  foremanDays: number;
  manDays: number;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function foremanInitial(name: string): string {
  return name.trim().split(/\s+/)[0]?.slice(0, 1).toUpperCase() ?? "?";
}

function periodHeaderLabel(p: PeriodOption): string {
  const start = new Date(p.startDate + "T00:00:00Z");
  const end = new Date(p.endDate + "T00:00:00Z");
  const startMonth = start.toLocaleDateString("en-ZA", {
    month: "long",
    timeZone: "UTC",
  });
  const endMonth = end.toLocaleDateString("en-ZA", {
    month: "long",
    timeZone: "UTC",
  });
  const year = end.toLocaleDateString("en-ZA", {
    year: "numeric",
    timeZone: "UTC",
  });
  if (startMonth === endMonth) return `${startMonth} ${year}`;
  return `${startMonth} & ${endMonth} ${year}`;
}

function periodSelectLabel(p: PeriodOption): string {
  if (p.label) return p.label;
  const start = new Date(p.startDate + "T00:00:00Z");
  const end = new Date(p.endDate + "T00:00:00Z");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    });
  const year = end.toLocaleDateString("en-ZA", {
    year: "numeric",
    timeZone: "UTC",
  });
  return `${fmt(start)} – ${fmt(end)} ${year}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function TimesheetQuickViewClient() {
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([]);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption | null>(
    null,
  );
  const [supervisorName, setSupervisorName] = useState("");

  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<DetailColumn[]>([]);
  const [rows, setRows] = useState<ForemanSiteRow[]>([]);

  /* Load supervisors + periods once */
  useEffect(() => {
    Promise.all([
      fetch("/api/app/admin/supervisors", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          const list: SupervisorOption[] = d.supervisors ?? [];
          setSupervisors(
            list.sort((a, b) =>
              (a.name ?? a.email).localeCompare(b.name ?? b.email),
            ),
          );
        }),
      fetch("/api/app/admin/timesheet-periods?limit=50", {
        credentials: "include",
      })
        .then((r) => r.json())
        .then((d) => {
          const list: PeriodOption[] = d.data ?? [];
          list.sort((a, b) => b.startDate.localeCompare(a.startDate));
          setPeriods(list);
          if (list.length > 0) {
            setSelectedPeriodId(list[0].id);
            setSelectedPeriod(list[0]);
          }
        }),
    ])
      .catch(() => toast.error("Failed to load options"))
      .finally(() => setOptionsLoading(false));
  }, []);

  /* Sync selectedPeriod object when id changes */
  useEffect(() => {
    setSelectedPeriod(periods.find((p) => p.id === selectedPeriodId) ?? null);
  }, [selectedPeriodId, periods]);

  /* Load all foremen under the selected supervisor for the period */
  const load = useCallback(async () => {
    if (!selectedSupervisorId || !selectedPeriodId) {
      setRows([]);
      setColumns([]);
      return;
    }

    setLoading(true);
    setRows([]);
    setColumns([]);

    try {
      const listRes = await fetch(
        `/api/app/admin/timesheets?period=${selectedPeriodId}`,
        { credentials: "include" },
      );
      const listData = await listRes.json();
      if (!listRes.ok)
        throw new Error(listData.error ?? "Failed to load timesheets");

      const allRows: ListRow[] = listData.timesheets ?? [];

      const sup = supervisors.find((s) => s.id === selectedSupervisorId);
      setSupervisorName(sup?.name ?? sup?.email ?? "");

      const supervisorRows = allRows.filter(
        (r) => r.supervisor?.id === selectedSupervisorId,
      );

      if (supervisorRows.length === 0) {
        toast.info("No timesheets found for this supervisor in this period");
        setLoading(false);
        return;
      }

      /* Fetch per-timesheet detail in parallel */
      const details = await Promise.all(
        supervisorRows.map(async (row) => {
          const res = await fetch(`/api/app/admin/timesheets/${row.id}`, {
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok) return null;
          const ts = data.timesheet ?? data;
          return {
            listRow: row,
            columns: (ts.columns ?? []) as DetailColumn[],
            workerRows: (ts.rows ?? []) as DetailRow[],
            foremanEmployeeId: (ts.foreman?.employeeId ?? null) as string | null,
          };
        }),
      );

      const valid = details.filter(Boolean) as NonNullable<
        (typeof details)[0]
      >[];

      if (valid.length === 0) {
        toast.error("Could not load timesheet details");
        setLoading(false);
        return;
      }

      const cols = valid[0].columns;
      setColumns(cols);

      const displayRows: ForemanSiteRow[] = [];

      for (const d of valid) {
        const { listRow, workerRows, foremanEmployeeId } = d;
        const site = listRow.sites[0] ?? { code: null, name: "Unknown" };
        const foremanRow = foremanEmployeeId
          ? workerRows.find((r) => r.employeeId === foremanEmployeeId)
          : null;
        const teamRows = workerRows.filter(
          (r) => r.employeeId !== foremanEmployeeId,
        );
        const dailyCounts = cols.map(
          (_, dayIdx) => teamRows.filter((r) => r.present[dayIdx]).length,
        );
        const foremanPresence: boolean[] = foremanRow
          ? foremanRow.present
          : Array(cols.length).fill(false);
        displayRows.push({
          foremanName: listRow.foreman.name,
          jobNo: site.code ?? "",
          siteName: site.name,
          dailyCounts,
          foremanPresence,
          foremanDays: listRow.foremanDays ?? 0,
          manDays: teamRows.reduce((s, r) => s + r.daysWorked, 0),
        });
      }

      displayRows.sort((a, b) => {
        const n = a.foremanName.localeCompare(b.foremanName);
        return n !== 0 ? n : a.siteName.localeCompare(b.siteName);
      });

      setRows(displayRows);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load timesheet");
    } finally {
      setLoading(false);
    }
  }, [selectedSupervisorId, selectedPeriodId, supervisors]);

  useEffect(() => {
    load();
  }, [load]);

  const totalForemanDays = rows.reduce((s, r) => s + r.foremanDays, 0);
  const totalManDays = rows.reduce((s, r) => s + r.manDays, 0);
  const headerDate = selectedPeriod ? periodHeaderLabel(selectedPeriod) : "";
  const todayISO = new Date().toISOString().slice(0, 10);

  const handlePrint = useCallback(() => {
    const printRoot = document.getElementById("ts-print-root");
    if (!printRoot) return;
    const win = window.open("", "_blank");
    if (!win) { window.print(); return; }
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Time Sheet</title><style>
@page { size: A4 landscape; margin: 8mm 12mm; }
body { margin: 0; }
.ts-no-print { display: none !important; }
.ts-sheet-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; font-size: 12px; font-family: Arial, sans-serif; }
.ts-title { font-size: 15px; font-weight: bold; text-decoration: underline; letter-spacing: 1.5px; }
.ts-table { width: 100%; border-collapse: collapse; font-size: 10px; font-family: Arial, sans-serif; }
.ts-table th { border: 1.5px solid #222; padding: 6px 5px; background: #f2f2f2; font-weight: 700; text-align: center; white-space: nowrap; }
.ts-table td { border: 1px solid #bbb; padding: 6px 4px; text-align: center; vertical-align: middle; }
.ts-th-name { text-align: left !important; min-width: 100px; }
.ts-th-jobno { text-align: left !important; min-width: 60px; }
.ts-th-site { text-align: left !important; min-width: 140px; }
.ts-th-day { width: 42px; min-width: 42px; max-width: 42px; padding: 2px !important; }
.ts-th-total { min-width: 52px; }
.ts-td-name { text-align: left !important; min-width: 100px; white-space: nowrap; font-weight: 500; }
.ts-td-jobno { text-align: left !important; min-width: 60px; font-size: 9px; color: #555; }
.ts-td-site { text-align: left !important; min-width: 140px; font-size: 9px; white-space: nowrap; }
.ts-td-count { font-weight: 700; font-size: 9px; color: #111; }
.ts-td-absent { padding: 2px; }
.ts-td-total { font-weight: 600; }
.ts-tfoot-row td { background: #f0f0f0; font-weight: 700; border-top: 2px solid #333; }
.ts-tfoot-label { text-align: right !important; padding-right: 8px !important; letter-spacing: 0.5px; }
.ts-dayhead-short { font-size: 8px; line-height: 1.2; font-weight: 400; }
.ts-dayhead-num { font-size: 10px; font-weight: 700; line-height: 1.3; }
</style></head><body>${printRoot.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 200);
  }, []);

  return (
    <>
      {/* ── Print stylesheet injected once per mount ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .ts-sheet-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 10px;
            font-size: 12px;
            font-family: Arial, sans-serif;
          }
          .ts-title {
            font-size: 15px;
            font-weight: bold;
            text-decoration: underline;
            letter-spacing: 1.5px;
          }
          .ts-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            font-family: Arial, sans-serif;
          }
          .ts-table th {
            border: 1.5px solid #222;
            padding: 6px 5px;
            background: #f2f2f2;
            font-weight: 700;
            text-align: center;
            white-space: nowrap;
          }
          .ts-table td {
            border: 1px solid #bbb;
            padding: 6px 4px;
            text-align: center;
            vertical-align: middle;
          }
          .ts-th-name  { text-align: left !important; min-width: 100px; }
          .ts-th-jobno { text-align: left !important; min-width: 60px; }
          .ts-th-site  { text-align: left !important; min-width: 140px; }
          .ts-th-day   {
  width: 42px;
  min-width: 42px;
  max-width: 42px;
  padding: 2px !important;
}
          .ts-th-total { min-width: 52px; }
          .ts-td-name  { text-align: left !important; min-width: 100px; white-space: nowrap; font-weight: 500; }
          .ts-td-jobno { text-align: left !important; min-width: 60px; font-size: 9px; color: #555; }
          .ts-td-site  { text-align: left !important; min-width: 140px; font-size: 9px; white-space: nowrap; }
          .ts-td-count { font-weight: 700; font-size: 9px; color: #111; }
          .ts-td-absent { padding: 2px; }
          .ts-td-total { font-weight: 600; }
          .ts-tfoot-row td {
            background: #f0f0f0;
            font-weight: 700;
            border-top: 2px solid #333;
          }
          .ts-tfoot-label { text-align: right !important; padding-right: 8px !important; letter-spacing: 0.5px; }
          .ts-dayhead-short { font-size: 8px; line-height: 1.2; font-weight: 400; }
          .ts-dayhead-num   { font-size: 10px; font-weight: 700; line-height: 1.3; }
        `,
        }}
      />

      <div className="space-y-6">
        {/* ── Controls ── */}
        <div className="ts-no-print flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <Label>Supervisor</Label>
            <Select
              value={selectedSupervisorId}
              onValueChange={setSelectedSupervisorId}
              disabled={optionsLoading}
            >
              <SelectTrigger className="w-60">
                <SelectValue
                  placeholder={
                    optionsLoading ? "Loading…" : "— select supervisor —"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {supervisors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name || s.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Fortnight Period</Label>
            <Select
              value={selectedPeriodId}
              onValueChange={setSelectedPeriodId}
              disabled={optionsLoading}
            >
              <SelectTrigger className="w-68">
                <SelectValue placeholder="— select period —" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {periodSelectLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rows.length > 0 && (
            <Button
              variant="outline"
              onClick={handlePrint}
              className="gap-2 self-end"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </Button>
          )}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-16">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading timesheet data…</span>
          </div>
        )}

        {/* ── Empty prompt ── */}
        {!loading && !selectedSupervisorId && (
          <div className="ts-no-print flex flex-col items-center gap-3 py-16 border rounded-lg bg-muted/20 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              Select a supervisor and period to generate the timesheet view.
            </p>
          </div>
        )}

        {/* ── Sheet ── */}
        {!loading && rows.length > 0 && (
          <div id="ts-print-root" className="overflow-x-auto">
            {/* Header row — matches the handwritten sheet layout */}
            <div className="ts-sheet-header">
              <div>
                <span style={{ fontSize: 11 }}>Date:&nbsp;</span>
                <span style={{ fontWeight: 600 }}>{headerDate}</span>
              </div>
              <div className="ts-title">TIME SHEET</div>
              <div>
                <span style={{ fontSize: 11 }}>Contract Manager:&nbsp;</span>
                <span style={{ fontWeight: 600 }}>{supervisorName}</span>
              </div>
            </div>

            <table className="ts-table">
              <thead>
                <tr>
                  <th className="ts-th-name" style={{ textAlign: "left" }}>
                    Name
                  </th>
                  <th className="ts-th-jobno" style={{ textAlign: "left" }}>
                    Job No
                  </th>
                  <th className="ts-th-site" style={{ textAlign: "left" }}>
                    Site
                  </th>
                  {columns.map((col) => (
                    <th key={col.iso} className="ts-th-day">
                      <div className="ts-dayhead-short">{col.day}</div>
                      <div className="ts-dayhead-num">{col.date}</div>
                    </th>
                  ))}
                  <th className="ts-th-total">
                    F/man
                    <br />
                    Days
                  </th>
                  <th className="ts-th-total">
                    Man
                    <br />
                    Days
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const initial = foremanInitial(row.foremanName);
                  return (
                    <tr key={idx}>
                      <td className="ts-td-name" style={{ textAlign: "left" }}>
                        {row.foremanName}
                      </td>
                      <td className="ts-td-jobno" style={{ textAlign: "left" }}>
                        {row.jobNo}
                      </td>
                      <td className="ts-td-site" style={{ textAlign: "left" }}>
                        {row.siteName}
                      </td>
                      {row.dailyCounts.map((count, dayIdx) => {
                        const isFuture =
                          (columns[dayIdx]?.iso ?? "") > todayISO;
                        const foremanIn = row.foremanPresence[dayIdx] ?? false;
                        const hasActivity = count > 0 || foremanIn;
                        return (
                          <td
                            key={dayIdx}
                            className={
                              hasActivity ? "ts-td-count" : "ts-td-absent"
                            }
                          >
                            {isFuture ? null : hasActivity ? (
                              foremanIn ? `${initial}+${count}` : `${count}`
                            ) : (
                              <svg
                                width="18"
                                height="12"
                                viewBox="0 0 18 12"
                                style={{ display: "block", margin: "auto" }}
                              >
                                <line
                                  x1="16.5"
                                  y1="1"
                                  x2="1.5"
                                  y2="11"
                                  stroke="#000"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            )}
                          </td>
                        );
                      })}
                      <td className="ts-td-total">{row.foremanDays || ""}</td>
                      <td className="ts-td-total">{row.manDays}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="ts-tfoot-row">
                  <td
                    colSpan={3 + columns.length}
                    className="ts-tfoot-label"
                    style={{ textAlign: "right" }}
                  >
                    TOTALS
                  </td>
                  <td className="ts-td-total">{totalForemanDays}</td>
                  <td className="ts-td-total">{totalManDays}</td>
                </tr>
              </tfoot>
            </table>

            {/* Summary below table */}
            <div
              className="ts-no-print"
              style={{
                display: "flex",
                gap: 24,
                marginTop: 12,
                fontSize: 13,
                color: "#555",
              }}
            >
              <span>
                Foremen: <strong>{rows.length}</strong>
              </span>
              <span>
                Foreman Days: <strong>{totalForemanDays}</strong>
              </span>
              <span>
                Total Man Days: <strong>{totalManDays}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
