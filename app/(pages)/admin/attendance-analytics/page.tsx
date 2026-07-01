"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Minus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addDays, currentFortnightSatFri, toISODate } from "@/lib/fortnight";

type DayRow = {
  date: string;
  total: number;
  percentChange: number | null;
};

type SiteDayRow = DayRow & {
  siteId: string;
  siteName: string;
  siteCode: string | null;
};

type SiteOption = {
  id: string;
  name: string;
  code: string | null;
};

type AnalyticsResponse = {
  period: {
    startISO: string;
    endISO: string;
    label: string;
  };
  summary: {
    totalAttendance: number;
    averagePerDay: number;
    bestDay: DayRow | null;
    activeSiteCount: number;
  };
  days: DayRow[];
  perSite: SiteDayRow[];
  sites: SiteOption[];
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function shiftISODate(iso: string, days: number) {
  return toISODate(addDays(new Date(`${iso}T00:00:00`), days));
}

function siteRowLabel(site: Pick<SiteDayRow, "siteCode" | "siteName">) {
  return site.siteCode ? `${site.siteCode} - ${site.siteName}` : site.siteName;
}

function PercentBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        New
      </Badge>
    );
  }

  if (value === 0) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        0.0%
      </Badge>
    );
  }

  const isIncrease = value > 0;
  const Icon = isIncrease ? TrendingUp : TrendingDown;

  return (
    <Badge
      variant="outline"
      className={
        isIncrease
          ? "gap-1 border-red-200 bg-red-50 text-red-700"
          : "gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"
      }
    >
      <Icon className="h-3 w-3" />
      {isIncrease ? "+" : ""}
      {value.toFixed(1)}%
    </Badge>
  );
}

export default function AdminAttendanceAnalyticsPage() {
  const current = currentFortnightSatFri();
  const [startISO, setStartISO] = useState(current.startISO);
  const [siteId, setSiteId] = useState("ALL");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: startISO });
      if (siteId !== "ALL") params.set("siteId", siteId);

      const res = await fetch(`/api/admin/attendance-analytics?${params}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to load attendance analytics");
      }

      setData(await res.json());
    } catch (error: any) {
      toast.error(error?.message || "Failed to load attendance analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, siteId]);

  const siteRows = useMemo(() => {
    if (!data) return [];

    const grouped = new Map<
      string,
      {
        siteId: string;
        siteName: string;
        siteCode: string | null;
        total: number;
        days: SiteDayRow[];
      }
    >();

    for (const row of data.perSite) {
      if (!grouped.has(row.siteId)) {
        grouped.set(row.siteId, {
          siteId: row.siteId,
          siteName: row.siteName,
          siteCode: row.siteCode,
          total: 0,
          days: [],
        });
      }
      const group = grouped.get(row.siteId)!;
      group.total += row.total;
      group.days.push(row);
    }

    return Array.from(grouped.values()).sort((a, b) => b.total - a.total);
  }, [data]);

  const pageCount = Math.max(1, Math.ceil(siteRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pagedSiteRows = siteRows.slice(
    safePageIndex * pageSize,
    safePageIndex * pageSize + pageSize,
  );
  const canPreviousPage = safePageIndex > 0;
  const canNextPage = safePageIndex < pageCount - 1;
  const showingFrom =
    siteRows.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const showingTo = Math.min(
    safePageIndex * pageSize + pageSize,
    siteRows.length,
  );

  useEffect(() => {
    setPageIndex(0);
  }, [siteRows.length, pageSize]);

  const bestDayLabel = data?.summary.bestDay
    ? formatDate(data.summary.bestDay.date)
    : "-";

  return (
    <div className="space-y-4 px-4 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Fortnight Attendance Analytics
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Daily attendance movement and per-site totals for the selected
            fortnight.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Previous fortnight"
            onClick={() => setStartISO((value) => shiftISODate(value, -14))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={startISO}
              onChange={(event) => setStartISO(event.target.value)}
              className="w-[164px] pl-9"
              aria-label="Fortnight start date"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Next fortnight"
            onClick={() => setStartISO((value) => shiftISODate(value, 14))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStartISO(current.startISO)}
          >
            Current
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Refresh"
            onClick={loadAnalytics}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={siteId} onValueChange={setSiteId}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="All sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sites</SelectItem>
            {(data?.sites ?? []).map((site) => (
              <SelectItem key={site.id} value={site.id}>
                {site.code ? `${site.code} - ${site.name}` : site.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data ? (
          <Badge variant="outline" className="h-9 px-3">
            {data.period.label}
          </Badge>
        ) : null}
      </div>

      {loading && !data ? (
        <div className="flex min-h-[280px] items-center justify-center rounded border bg-card">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading attendance analytics
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm text-muted-foreground">
                  Total attendance days
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-2xl font-semibold">
                {data.summary.totalAttendance}
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm text-muted-foreground">
                  Average per day
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-2xl font-semibold">
                {data.summary.averagePerDay.toFixed(1)}
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm text-muted-foreground">
                  Best day
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-2xl font-semibold">
                {bestDayLabel}
              </CardContent>
            </Card>
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm text-muted-foreground">
                  Sites with attendance
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-2xl font-semibold">
                {data.summary.activeSiteCount}
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto rounded border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px] bg-primary text-primary-foreground">
                    Site
                  </TableHead>
                  {data.days.map((day) => (
                    <TableHead
                      key={day.date}
                      className="min-w-[118px] bg-primary text-primary-foreground"
                    >
                      <div className="space-y-1">
                        <div>{formatDate(day.date)}</div>
                        <div className="text-xs font-semibold text-primary-foreground/80">
                          Total: {day.total}
                        </div>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="bg-primary text-right text-primary-foreground">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedSiteRows.length ? (
                  pagedSiteRows.map((site) => (
                    <TableRow key={site.siteId}>
                      <TableCell className="font-medium">
                        {siteRowLabel(site)}
                      </TableCell>
                      {site.days.map((day) => (
                        <TableCell key={`${site.siteId}-${day.date}`}>
                          <div className="flex min-w-[96px] items-center justify-between gap-2">
                            <span className="tabular-nums">{day.total}</span>
                            <PercentBadge value={day.percentChange} />
                          </div>
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold tabular-nums">
                        {site.total}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={data.days.length + 2}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No attendance scans found for this fortnight.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t bg-muted/60 px-4 py-3">
              <div className="hidden text-sm text-muted-foreground lg:flex">
                Showing {showingFrom} to {showingTo} of {siteRows.length} sites
              </div>
              <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
                <div className="hidden items-center gap-2 lg:flex">
                  <span className="text-sm font-medium">Rows per page</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => setPageSize(Number(value))}
                  >
                    <SelectTrigger className="h-8 w-20">
                      <SelectValue placeholder={pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[5, 10, 25, 50, 100].map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-fit items-center justify-center text-sm font-medium">
                  Page {safePageIndex + 1} of {pageCount}
                </div>
                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="hidden h-8 w-8 lg:flex"
                    onClick={() => setPageIndex(0)}
                    disabled={!canPreviousPage}
                  >
                    <span className="sr-only">Go to first page</span>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setPageIndex((value) => Math.max(0, value - 1))
                    }
                    disabled={!canPreviousPage}
                  >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setPageIndex((value) =>
                        Math.min(pageCount - 1, value + 1),
                      )
                    }
                    disabled={!canNextPage}
                  >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="hidden h-8 w-8 lg:flex"
                    onClick={() => setPageIndex(pageCount - 1)}
                    disabled={!canNextPage}
                  >
                    <span className="sr-only">Go to last page</span>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
