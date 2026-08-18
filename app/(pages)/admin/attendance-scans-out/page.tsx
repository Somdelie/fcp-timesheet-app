"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Loader2,
  MapPin,
  MoreVertical,
  RefreshCw,
  ScanFace,
  Search,
  ShieldAlert,
  Smartphone,
  UserPlus,
  Users,
} from "lucide-react";
import { joburgTodayISO } from "@/lib/dateUtc";

type MethodBucket = "FACE" | "PHOTO_BULK" | "MANUAL";
type VerificationStatus = "VERIFIED" | "PENDING_REVIEW" | "REJECTED" | null;
type MethodTab = "ALL" | MethodBucket | "FAILED";

interface ScanOut {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  employeePhotoUrl: string | null;
  siteId: string;
  siteName: string;
  siteCode: string | null;
  team: string | null;
  foremanName: string;
  scannedAtISO: string;
  scannedOutAtISO: string;
  methodBucket: MethodBucket;
  verificationStatus: VerificationStatus;
  confidence: number | null;
  device: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

interface FilterOption {
  id: string;
  name: string;
  code: string | null;
}

interface Stats {
  total: number;
  face: number;
  photoBulk: number;
  manual: number;
  failedRejected: number;
}

const EMPTY_STATS: Stats = { total: 0, face: 0, photoBulk: 0, manual: 0, failedRejected: 0 };

function MethodBadge({ bucket }: { bucket: MethodBucket }) {
  if (bucket === "FACE") {
    return (
      <Badge variant="outline" className="gap-1">
        <ScanFace className="h-3 w-3" />
        Face
      </Badge>
    );
  }
  if (bucket === "PHOTO_BULK") {
    return (
      <Badge variant="outline" className="gap-1">
        <Camera className="h-3 w-3" />
        Photo / Bulk
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <UserPlus className="h-3 w-3" />
      Manual
    </Badge>
  );
}

function VerificationBadge({
  status,
  confidence,
}: {
  status: VerificationStatus;
  confidence: number | null;
}) {
  const pct = confidence != null ? `${Math.round(confidence * 100)}%` : null;

  if (status === "VERIFIED") {
    return (
      <Badge className="gap-1 border-transparent bg-green-100 text-green-800 hover:bg-green-100">
        Verified{pct ? ` · ${pct}` : ""}
      </Badge>
    );
  }
  if (status === "PENDING_REVIEW") {
    return (
      <Badge className="gap-1 border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100">
        Pending Review{pct ? ` · ${pct}` : ""}
      </Badge>
    );
  }
  if (status === "REJECTED") {
    return (
      <Badge className="gap-1 border-transparent bg-red-100 text-red-800 hover:bg-red-100">
        Failed{pct ? ` · ${pct}` : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      Not Verified
    </Badge>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  percent,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  percent: string | null;
  tone: "default" | "danger";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
            tone === "danger" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {label}
            {percent ? ` · ${percent}` : ""}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
}

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function exportScansOutExcel(scans: ScanOut[], from: string, to: string) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FirstClass Projects";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Scans Out");
  sheet.columns = [
    { header: "Employee", key: "employee", width: 24 },
    { header: "Employee ID", key: "employeeCode", width: 14 },
    { header: "Site", key: "site", width: 22 },
    { header: "Team", key: "team", width: 16 },
    { header: "Scan Method", key: "method", width: 14 },
    { header: "Scan Out Time", key: "scanOutTime", width: 20 },
    { header: "Verification", key: "verification", width: 16 },
    { header: "Confidence", key: "confidence", width: 12 },
    { header: "Device", key: "device", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const scan of scans) {
    sheet.addRow({
      employee: scan.employeeName,
      employeeCode: scan.employeeCode,
      site: scan.siteName,
      team: scan.team ?? "",
      method:
        scan.methodBucket === "FACE" ? "Face" : scan.methodBucket === "PHOTO_BULK" ? "Photo / Bulk" : "Manual",
      scanOutTime: new Date(scan.scannedOutAtISO).toLocaleString("en-GB"),
      verification: scan.verificationStatus ?? "Not Verified",
      confidence: scan.confidence != null ? `${Math.round(scan.confidence * 100)}%` : "",
      device: scan.device ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    buffer,
    `scans-out-${safeFilePart(from)}-to-${safeFilePart(to)}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

export default function AdminAttendanceScansOutPage() {
  const today = joburgTodayISO();
  const [scans, setScans] = useState<ScanOut[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [sites, setSites] = useState<FilterOption[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [siteId, setSiteId] = useState<string>("");
  const [team, setTeam] = useState<string>("");
  const [status, setStatus] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [methodTab, setMethodTab] = useState<MethodTab>("ALL");
  const [pageIndexMap, setPageIndexMap] = useState<Record<string, number>>({});
  const [pageSize, setPageSize] = useState(10);
  const [viewPhoto, setViewPhoto] = useState<{ url: string; name: string } | null>(null);
  const [detailScan, setDetailScan] = useState<ScanOut | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const loadScans = async (
    siteIdArg?: string,
    teamArg?: string,
    searchArg?: string,
    fromArg?: string,
    toArg?: string,
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (siteIdArg) params.set("siteId", siteIdArg);
      if (teamArg) params.set("team", teamArg);
      const q = searchArg?.trim();
      if (q) params.set("q", q);
      if (fromArg) params.set("from", fromArg);
      if (toArg) params.set("to", toArg);
      const url = `/api/admin/attendance-scans-out${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error("Failed to load scan-out records");
      const data = await res.json();
      setScans(data.scans || []);
      setStats(data.stats || EMPTY_STATS);
      setSites(data.sites || []);
      setTeams(data.teams || []);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      toast.error(err.message || "Failed to load scan-out records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScans(siteId, team, search, dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      loadScans(siteId, team, search, dateFrom, dateTo);
    }, 350);
    return () => window.clearTimeout(t);
  }, [siteId, team, search, dateFrom, dateTo]);

  const filteredScans = useMemo(() => {
    let list = scans;
    if (methodTab === "FAILED") {
      list = list.filter((s) => s.verificationStatus === "REJECTED");
    } else if (methodTab !== "ALL") {
      list = list.filter((s) => s.methodBucket === methodTab);
    }
    if (status !== "ALL") {
      list = status === "NOT_VERIFIED" ? list.filter((s) => s.verificationStatus === null) : list.filter((s) => s.verificationStatus === status);
    }
    return list;
  }, [scans, methodTab, status]);

  const pageIndex = pageIndexMap[methodTab] ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredScans.length / pageSize));
  const pageScans = filteredScans.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const setPageIndex = (tab: MethodTab, index: number) => {
    setPageIndexMap((prev) => ({ ...prev, [tab]: index }));
  };

  const handleTabChange = (value: string) => {
    setMethodTab(value as MethodTab);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportScansOutExcel(filteredScans, dateFrom, dateTo);
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const pct = (n: number) => (stats.total > 0 ? `${((n / stats.total) * 100).toFixed(1)}%` : null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Scans Out</h2>
          <p className="text-sm text-muted-foreground">View and manage all employee scan out records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || filteredScans.length === 0}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
          <Button
            size="sm"
            onClick={() => loadScans(siteId, team, search, dateFrom, dateTo)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Site</label>
            <Select value={siteId || "ALL"} onValueChange={(v) => setSiteId(v === "ALL" ? "" : v)}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All Sites" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sites</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.code ? `${site.code} - ${site.name}` : site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Team</label>
            <Select value={team || "ALL"} onValueChange={(v) => setTeam(v === "ALL" ? "" : v)}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All Teams" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Verification Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
                <SelectItem value="REJECTED">Failed / Rejected</SelectItem>
                <SelectItem value="NOT_VERIFIED">Not Verified</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative min-w-[220px] flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or ID"
                className="h-9 pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Users} label="Total Scans Out" value={stats.total} percent={null} tone="default" />
        <StatCard icon={ScanFace} label="Face Scans" value={stats.face} percent={pct(stats.face)} tone="default" />
        <StatCard icon={Camera} label="Photo / Bulk Scans" value={stats.photoBulk} percent={pct(stats.photoBulk)} tone="default" />
        <StatCard icon={UserPlus} label="Manual Scans" value={stats.manual} percent={pct(stats.manual)} tone="default" />
        <StatCard icon={ShieldAlert} label="Failed / Rejected" value={stats.failedRejected} percent={pct(stats.failedRejected)} tone="danger" />
      </div>

      <Card>
        <CardContent className="p-4">
          <Tabs value={methodTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="ALL">All Scans Out ({stats.total})</TabsTrigger>
              <TabsTrigger value="FACE">Face Scans ({stats.face})</TabsTrigger>
              <TabsTrigger value="PHOTO_BULK">Photo / Bulk ({stats.photoBulk})</TabsTrigger>
              <TabsTrigger value="MANUAL">Manual ({stats.manual})</TabsTrigger>
              <TabsTrigger value="FAILED">Failed / Rejected ({stats.failedRejected})</TabsTrigger>
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading scan-out records…
            </div>
          ) : filteredScans.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No scan-out records for this filter.
            </div>
          ) : (
            <>
              <div className="mt-3 rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="border-x">Employee</TableHead>
                      <TableHead className="border-x">Site / Team</TableHead>
                      <TableHead className="border-x">Scan Method</TableHead>
                      <TableHead className="border-x">Scan Out Time</TableHead>
                      <TableHead className="border-x">Verification</TableHead>
                      <TableHead className="border-x">Device</TableHead>
                      <TableHead className="border-x">Photo</TableHead>
                      <TableHead className="border-x w-12 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageScans.map((scan) => (
                      <TableRow key={scan.id}>
                        <TableCell className="border-x">
                          <div className="font-medium">{scan.employeeName}</div>
                          <div className="text-sm text-muted-foreground">{scan.employeeCode}</div>
                        </TableCell>
                        <TableCell className="border-x">
                          <div>{scan.siteName}</div>
                          {scan.team && <div className="text-sm text-muted-foreground">{scan.team}</div>}
                        </TableCell>
                        <TableCell className="border-x">
                          <MethodBadge bucket={scan.methodBucket} />
                        </TableCell>
                        <TableCell className="border-x">
                          {new Date(scan.scannedOutAtISO).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="border-x">
                          <VerificationBadge status={scan.verificationStatus} confidence={scan.confidence} />
                        </TableCell>
                        <TableCell className="border-x">
                          {scan.device ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Smartphone className="h-3 w-3 text-muted-foreground" />
                              <span className="max-w-[160px] truncate">{scan.device}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="border-x">
                          {scan.employeePhotoUrl ? (
                            <button
                              type="button"
                              className="shrink-0 focus:outline-none"
                              onClick={() => setViewPhoto({ url: scan.employeePhotoUrl!, name: scan.employeeName })}
                            >
                              <img
                                src={scan.employeePhotoUrl}
                                alt={scan.employeeName}
                                className="h-9 w-9 rounded object-cover transition-opacity hover:opacity-80"
                              />
                            </button>
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded bg-orange-500">
                              <span className="text-xs font-semibold text-white">
                                {scan.employeeName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="border-x text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <span className="sr-only">Row actions</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailScan(scan)}>View Details</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="mt-2 flex items-center justify-between rounded-b-md border-t bg-muted/60 px-4 py-3">
                <div className="hidden text-sm text-muted-foreground lg:block">
                  Showing {pageIndex * pageSize + 1} to {Math.min((pageIndex + 1) * pageSize, filteredScans.length)} of{" "}
                  {filteredScans.length} results
                </div>
                <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
                  <div className="hidden items-center gap-2 lg:flex">
                    <span className="text-sm font-medium">Rows per page</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        setPageSize(Number(v));
                        setPageIndexMap({});
                      }}
                    >
                      <SelectTrigger className="h-8 w-20"><SelectValue placeholder={pageSize} /></SelectTrigger>
                      <SelectContent side="top">
                        {[10, 20, 50, 100].map((size) => (
                          <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex w-fit items-center justify-center text-sm font-medium">
                    Page {pageIndex + 1} of {totalPages}
                  </div>
                  <div className="ml-auto flex items-center gap-2 lg:ml-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="hidden h-8 w-8 lg:flex"
                      onClick={() => setPageIndex(methodTab, 0)}
                      disabled={pageIndex === 0}
                    >
                      <span className="sr-only">Go to first page</span>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPageIndex(methodTab, Math.max(0, pageIndex - 1))}
                      disabled={pageIndex === 0}
                    >
                      <span className="sr-only">Previous page</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPageIndex(methodTab, Math.min(totalPages - 1, pageIndex + 1))}
                      disabled={pageIndex >= totalPages - 1}
                    >
                      <span className="sr-only">Next page</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="hidden h-8 w-8 lg:flex"
                      onClick={() => setPageIndex(methodTab, totalPages - 1)}
                      disabled={pageIndex >= totalPages - 1}
                    >
                      <span className="sr-only">Go to last page</span>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Photo lightbox */}
      {viewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setViewPhoto(null)}
        >
          <div className="relative mx-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <img src={viewPhoto.url} alt={viewPhoto.name} className="max-h-[80vh] w-full rounded object-contain" />
            <p className="mt-2 text-center text-sm font-medium text-white">{viewPhoto.name}</p>
            <button
              type="button"
              className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold text-black shadow hover:bg-gray-100"
              onClick={() => setViewPhoto(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailScan} onOpenChange={(open) => !open && setDetailScan(null)}>
        <DialogContent>
          {detailScan && (
            <>
              <DialogHeader>
                <DialogTitle>{detailScan.employeeName}</DialogTitle>
                <DialogDescription>{detailScan.employeeCode}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Site</span><span>{detailScan.siteName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Team</span><span>{detailScan.team ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Foreman</span><span>{detailScan.foremanName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Scanned In</span><span>{new Date(detailScan.scannedAtISO).toLocaleString("en-GB")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Scanned Out</span><span>{new Date(detailScan.scannedOutAtISO).toLocaleString("en-GB")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Method</span><MethodBadge bucket={detailScan.methodBucket} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Verification</span><VerificationBadge status={detailScan.verificationStatus} confidence={detailScan.confidence} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Device</span><span>{detailScan.device ?? "—"}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  {detailScan.latitude && detailScan.longitude ? (
                    <a
                      href={`https://www.google.com/maps?q=${detailScan.latitude},${detailScan.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <MapPin className="h-3 w-3" /> View map
                    </a>
                  ) : (
                    <span>{detailScan.address ?? "—"}</span>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
