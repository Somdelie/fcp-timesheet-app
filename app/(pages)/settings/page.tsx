"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Settings as SettingsIcon,
  Copy,
  Check,
  Trash2,
  Users,
  MapPin,
  FileCheck,
  ScrollText,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader,
  LogIn,
  Globe,
} from "lucide-react";
import { toast } from "react-toastify";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  getCompanySettings,
  updateCompanySettings,
} from "@/actions/company-settings";

import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";

type FortnightResult = {
  startISO: string;
  endISO: string;
  id: string;
};

function utcDateFromISO(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

function toISODateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isSaturdayISO(iso: string) {
  const d = utcDateFromISO(iso);
  return d.getUTCDay() === 6;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      payload?.error || payload?.message || `Request failed (${res.status})`,
    );
  }
  return payload as T;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      payload?.error || payload?.message || `Request failed (${res.status})`,
    );
  }
  return payload as T;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    appName: "Office API",
    appVersion: "2.0.0",
    companyName: "Company Name",
    supportEmail: "support@company.com",
    timezone: "UTC",
    dateFormat: "YYYY-MM-DD",
  });

  const nowYearUTC = useMemo(() => new Date().getUTCFullYear(), []);
  const [year, setYear] = useState<number>(nowYearUTC);

  const [defaultEmployeeDayRate, setDefaultEmployeeDayRate] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  // Timesheet anchor (source of truth from DB) + admin input
  const [anchorISO, setAnchorISO] = useState<string>("");
  const [anchorInputISO, setAnchorInputISO] = useState<string>("");

  // Fortnight preview
  const [fortnight, setFortnight] = useState<FortnightResult | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [isSavingRate, setIsSavingRate] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const [isLoadingAnchor, setIsLoadingAnchor] = useState(false);
  const [isSavingAnchor, setIsSavingAnchor] = useState(false);

  // Load company settings
  useEffect(() => {
    let alive = true;

    async function loadSettings() {
      try {
        const res = await getCompanySettings();
        if (!alive) return;
        if (res.ok) {
          setDefaultEmployeeDayRate(
            String(res.settings.defaultEmployeeDayRate),
          );
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        if (!alive) return;
        setIsLoadingSettings(false);
      }
    }

    loadSettings();
    return () => {
      alive = false;
    };
  }, []);

  // Load anchor for selected year
  useEffect(() => {
    let alive = true;

    async function loadAnchor() {
      setIsLoadingAnchor(true);
      try {
        const data = await getJson<{
          ok: boolean;
          year: number;
          anchorISO: string | null;
        }>(`/api/app/admin/timesheets/year-anchor?year=${year}`);

        if (!alive) return;

        const iso = data.anchorISO ?? "";
        setAnchorISO(iso);
        setAnchorInputISO(iso);
        setFortnight(null);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setAnchorISO("");
        setAnchorInputISO("");
        setFortnight(null);
      } finally {
        if (!alive) return;
        setIsLoadingAnchor(false);
      }
    }

    loadAnchor();
    return () => {
      alive = false;
    };
  }, [year]);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setSaveMessage("Settings saved successfully!");
    setTimeout(() => setSaveMessage(""), 3000);
  };

  const handleSaveDefaultDayRate = async () => {
    const trimmed = defaultEmployeeDayRate.trim();
    const num = Number(trimmed);

    if (!trimmed || !Number.isFinite(num) || num < 0) {
      toast.error("Please enter a valid day rate.");
      return;
    }

    setIsSavingRate(true);
    try {
      const res = await updateCompanySettings({
        defaultEmployeeDayRate: trimmed,
      });
      if (res.ok) toast.success("Default employee day rate updated!");
      else toast.error(res.error || "Failed to save settings.");
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error("Failed to save settings.");
    } finally {
      setIsSavingRate(false);
    }
  };

  // Generate fortnight using DB anchor (UTC)
  const generateFortnightForDate = (dateISO: string) => {
    if (!anchorISO) {
      toast.error(
        "No anchor set for this year. Set the anchor Saturday first.",
      );
      return;
    }

    try {
      const anchor = utcDateFromISO(anchorISO);
      const date = utcDateFromISO(dateISO);

      const result = getFortnightForDateUTC(date, anchor);
      setFortnight({
        startISO: result.startISO,
        endISO: result.endISO,
        id: result.id,
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate fortnight.");
    }
  };

  const handleGenerateFortnightToday = () => {
    const todayISO = toISODateUTC(new Date());
    generateFortnightForDate(todayISO);
  };

  const handleGenerateFortnightDate = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const iso = e.target.value;
    if (!iso) return;
    generateFortnightForDate(iso);
  };

  // Persist anchor + generate the year's periods
  const handleSaveYearAnchor = async () => {
    const iso = anchorInputISO.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      toast.error("Anchor must be a valid date (YYYY-MM-DD).");
      return;
    }

    if (!isSaturdayISO(iso)) {
      toast.error("Anchor must be a Saturday.");
      return;
    }

    const d = utcDateFromISO(iso);
    if (d.getUTCFullYear() !== year) {
      toast.error(`Anchor must be inside year ${year}.`);
      return;
    }

    setIsSavingAnchor(true);
    try {
      await postJson<{ ok: boolean; year: number; count: number }>(
        `/api/app/admin/timesheets/generate-year`,
        { year, anchorISO: iso },
      );

      toast.success(`Anchor saved + periods generated for ${year}.`);
      setAnchorISO(iso);
      setFortnight(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save anchor.");
    } finally {
      setIsSavingAnchor(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy.");
    }
  };

  const anchorStatus = useMemo(() => {
    if (isLoadingAnchor) return "loading" as const;
    if (!anchorISO) return "missing" as const;
    if (anchorISO !== anchorInputISO.trim()) return "dirty" as const;
    return "saved" as const;
  }, [anchorISO, anchorInputISO, isLoadingAnchor]);

  // ── Activity Logs state ──
  type AuditLogEntry = {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    entityName: string | null;
    metadata: any;
    createdAt: string;
    actor: {
      id: string;
      name: string | null;
      email: string;
      role: string;
    } | null;
  };
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditActions, setAuditActions] = useState<string[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);

  type RecentLogin = {
    id: string;
    action: string;
    createdAt: string;
    actor: {
      id: string;
      name: string | null;
      email: string;
      role: string;
    } | null;
  };
  const [recentLogins, setRecentLogins] = useState<RecentLogin[]>([]);

  const fetchAuditLogs = async (page = 1, search = "", action = "") => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (action) params.set("action", action);
      const data = await getJson<{
        logs: AuditLogEntry[];
        total: number;
        page: number;
        totalPages: number;
        actions: string[];
        recentLogins: RecentLogin[];
      }>(`/api/admin/audit-logs?${params}`);
      setAuditLogs(data.logs);
      setAuditTotal(data.total);
      setAuditPage(data.page);
      setAuditTotalPages(data.totalPages);
      setAuditActions(data.actions);
      setRecentLogins(data.recentLogins ?? []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load audit logs");
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-8 h-8" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage application and system settings
            </p>
          </div>
        </div>

        {saveMessage && (
          <div className="bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-lg">
            {saveMessage}
          </div>
        )}

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="fortnight">Fortnight Generator</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger
              value="logs"
              onClick={() => {
                if (auditLogs.length === 0) fetchAuditLogs();
              }}
            >
              Activity Logs
            </TabsTrigger>
          </TabsList>

          {/* General */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure basic application settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appName">Application Name</Label>
                    <Input
                      id="appName"
                      value={settings.appName}
                      onChange={(e) => handleChange("appName", e.target.value)}
                      placeholder="Enter app name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appVersion">Version</Label>
                    <Input
                      id="appVersion"
                      value={settings.appVersion}
                      onChange={(e) =>
                        handleChange("appVersion", e.target.value)
                      }
                      placeholder="Enter version"
                      disabled
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={settings.companyName}
                    onChange={(e) =>
                      handleChange("companyName", e.target.value)
                    }
                    placeholder="Enter company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supportEmail">Support Email</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={settings.supportEmail}
                    onChange={(e) =>
                      handleChange("supportEmail", e.target.value)
                    }
                    placeholder="Enter support email"
                  />
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button onClick={handleSave}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payroll */}
          <TabsContent value="payroll" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payroll Settings</CardTitle>
                <CardDescription>
                  Configure default rates for employees
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultDayRate">
                      Default Employee Day Rate (R)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      This rate will be used for all employees unless they have
                      an individual override. Foremen can have custom rates.
                    </p>
                    <Input
                      id="defaultDayRate"
                      type="number"
                      step="0.01"
                      placeholder="e.g., 300.00"
                      value={defaultEmployeeDayRate}
                      onChange={(e) =>
                        setDefaultEmployeeDayRate(e.target.value)
                      }
                      disabled={isLoadingSettings}
                    />
                  </div>

                  <Separator />

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveDefaultDayRate}
                      disabled={isSavingRate || isLoadingSettings}
                    >
                      {isSavingRate ? "Saving..." : "Save Day Rate"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System */}
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>
                  Configure system-wide preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={settings.timezone}
                      onChange={(e) => handleChange("timezone", e.target.value)}
                      placeholder="Enter timezone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <Input
                      id="dateFormat"
                      value={settings.dateFormat}
                      onChange={(e) =>
                        handleChange("dateFormat", e.target.value)
                      }
                      placeholder="Enter date format"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button onClick={handleSave}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fortnight Generator */}
          <TabsContent value="fortnight" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Fortnight Generator</CardTitle>
                <CardDescription>
                  Uses the ADMIN anchor Saturday for the selected year (Sat→Fri,
                  14 days, UTC).
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Year + Anchor */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      min={2000}
                      max={2100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Anchor Saturday</Label>
                    <Input
                      type="date"
                      value={anchorInputISO}
                      onChange={(e) => setAnchorInputISO(e.target.value)}
                      disabled={isLoadingAnchor}
                    />

                    {anchorStatus === "loading" && (
                      <div className="text-xs text-muted-foreground">
                        Loading anchor…
                      </div>
                    )}

                    {anchorStatus === "missing" && (
                      <div className="text-xs text-rose-500">
                        No anchor saved for {year}. Set it first.
                      </div>
                    )}

                    {anchorStatus === "saved" && anchorISO && (
                      <div className="text-xs text-muted-foreground">
                        Saved anchor:{" "}
                        <span className="font-mono">{anchorISO}</span>{" "}
                        <Badge variant="outline" className="ml-2">
                          Saturday
                        </Badge>
                      </div>
                    )}

                    {anchorStatus === "dirty" && anchorISO && (
                      <div className="text-xs text-amber-500">
                        You changed the anchor input. Click “Save Anchor”.
                      </div>
                    )}
                  </div>

                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      onClick={handleSaveYearAnchor}
                      disabled={isSavingAnchor || isLoadingAnchor}
                    >
                      {isSavingAnchor
                        ? "Saving…"
                        : "Save Anchor + Generate Year"}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Fortnight compute */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fortnightDate">Select Date</Label>
                    <Input
                      id="fortnightDate"
                      type="date"
                      onChange={handleGenerateFortnightDate}
                      disabled={!anchorISO}
                    />
                  </div>

                  <Button
                    onClick={handleGenerateFortnightToday}
                    className="w-full"
                    disabled={!anchorISO}
                  >
                    Generate for Today
                  </Button>
                </div>

                {/* Preview */}
                {fortnight ? (
                  <div className="space-y-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">
                          Fortnight ID
                        </Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 bg-background border border-slate-300 dark:border-slate-600 rounded text-xs font-mono break-all">
                            {fortnight.id}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(fortnight.id, "id")}
                          >
                            {copiedField === "id" ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">
                            Start Date
                          </Label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-background border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">
                              {fortnight.startISO}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(fortnight.startISO, "start")
                              }
                            >
                              {copiedField === "start" ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          <Badge variant="outline" className="w-fit">
                            Saturday
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">
                            End Date
                          </Label>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-background border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">
                              {fortnight.endISO}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(fortnight.endISO, "end")
                              }
                            >
                              {copiedField === "end" ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          <Badge variant="outline" className="w-fit">
                            Friday
                          </Badge>
                        </div>
                      </div>

                      <Separator />

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>
                          <strong>Duration:</strong> 14 days (2 weeks)
                        </p>
                        <p>
                          <strong>Anchor Date:</strong>{" "}
                          <span className="font-mono">{anchorISO || "—"}</span>
                        </p>
                        <p>
                          Fortnights run Saturday→Friday (UTC) based on the
                          saved anchor.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-lg text-sm">
                    {anchorISO
                      ? "Select a date or click “Generate for Today” to compute the fortnight using the saved anchor."
                      : `Set the anchor Saturday for ${year} first.`}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced */}
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>
                  Configure advanced application options (use with caution)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-yellow-500/10 border border-yellow-500/25 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-lg">
                  <p className="text-sm font-medium">
                    These settings should only be modified by experienced
                    administrators
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>API Configuration</Label>
                    <p className="text-sm text-muted-foreground">
                      Configure API endpoints and keys
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Database Settings</Label>
                    <p className="text-sm text-muted-foreground">
                      Configure database connection and optimization
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Security Settings</Label>
                    <p className="text-sm text-muted-foreground">
                      Configure authentication and security policies
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button onClick={handleSave}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance */}
          <TabsContent value="maintenance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Database Cleanup</CardTitle>
                <CardDescription>
                  Remove inactive records and prune old data to keep the
                  database lean and performant.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-sm">
                        Inactive Employees
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Employees with no attendance scans for 2+ months are
                      permanently removed. They can re-register if needed.
                    </p>
                  </div>
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm">
                        Inactive Sites
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sites with no scans for 6+ months are deleted along with
                      all related assignments and records.
                    </p>
                  </div>
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-sm">
                        Prune Paid Timesheets
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Remove raw scan data for timesheets already marked as
                      PAID. Save the PDF locally first.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Preview counts and run cleanup tasks from the dedicated
                    cleanup page.
                  </p>
                  <Link href="/admin/cleanup">
                    <Button variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Open Cleanup
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Logs */}
          <TabsContent value="logs" className="space-y-4">
            {/* Recent Logins / App Opens */}
            {recentLogins.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <LogIn className="h-5 w-5" />
                    <div>
                      <CardTitle className="text-base">
                        Recent Logins &amp; App Opens
                      </CardTitle>
                      <CardDescription>
                        Last 10 admin sessions on the web app.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg divide-y">
                    {recentLogins.map((l) => (
                      <div
                        key={l.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {l.action === "LOGIN" ? (
                            <LogIn className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Globe className="h-4 w-4 text-blue-500 shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate">
                            {l.actor?.name || l.actor?.email || "Unknown"}
                          </span>
                          {l.actor?.role && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1 py-0"
                            >
                              {l.actor.role}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 font-mono"
                          >
                            {l.action === "LOGIN" ? "Login" : "Opened App"}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(l.createdAt).toLocaleString("en-ZA", {
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5" />
                  <div>
                    <CardTitle>Activity Logs</CardTitle>
                    <CardDescription>
                      Track who did what and when across the admin system.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by user, action, or entity…"
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setAuditPage(1);
                          fetchAuditLogs(1, auditSearch, auditActionFilter);
                        }
                      }}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={auditActionFilter}
                    onValueChange={(v) => {
                      const val = v === "__all__" ? "" : v;
                      setAuditActionFilter(val);
                      setAuditPage(1);
                      fetchAuditLogs(1, auditSearch, val);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All actions</SelectItem>
                      {auditActions.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      fetchAuditLogs(auditPage, auditSearch, auditActionFilter)
                    }
                  >
                    <Search className="h-4 w-4 mr-1" />
                    Search
                  </Button>
                </div>

                {/* Results */}
                {auditLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    No audit logs found.
                  </p>
                ) : (
                  <div className="border rounded-lg divide-y">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {log.action}
                            </Badge>
                            <span className="text-sm font-medium truncate">
                              {log.entity}
                              {log.entityName
                                ? ` — ${log.entityName}`
                                : log.entityId
                                  ? ` #${log.entityId.slice(0, 8)}`
                                  : ""}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            by{" "}
                            <span className="font-medium text-foreground">
                              {log.actor?.name || log.actor?.email || "System"}
                            </span>
                            {log.actor?.role && (
                              <Badge
                                variant="secondary"
                                className="ml-1 text-[10px] px-1 py-0"
                              >
                                {log.actor.role}
                              </Badge>
                            )}
                          </p>
                          {log.metadata &&
                            typeof log.metadata === "object" &&
                            Object.keys(log.metadata).length > 0 && (
                              <p className="text-xs text-muted-foreground truncate max-w-lg">
                                {(() => {
                                  const m = log.metadata;
                                  const parts: string[] = [];
                                  if (m.siteName)
                                    parts.push(`Site: ${m.siteName}`);
                                  if (m.employeeName)
                                    parts.push(`Employee: ${m.employeeName}`);
                                  if (m.foremanName)
                                    parts.push(`Foreman: ${m.foremanName}`);
                                  if (m.dayRate)
                                    parts.push(`Rate: R${m.dayRate}`);
                                  if (m.path) parts.push(m.path);
                                  if (m.reason)
                                    parts.push(`Reason: ${m.reason}`);
                                  if (parts.length > 0)
                                    return parts.join(" · ");
                                  // Fallback: show JSON but exclude resolved name keys
                                  const {
                                    siteName,
                                    employeeName,
                                    foremanName,
                                    ...rest
                                  } = m;
                                  return Object.keys(rest).length > 0
                                    ? JSON.stringify(rest)
                                    : null;
                                })()}
                              </p>
                            )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("en-ZA", {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {auditTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      {auditTotal} total log{auditTotal !== 1 ? "s" : ""} · Page{" "}
                      {auditPage} of {auditTotalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditPage <= 1}
                        onClick={() => {
                          const p = auditPage - 1;
                          setAuditPage(p);
                          fetchAuditLogs(p, auditSearch, auditActionFilter);
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditPage >= auditTotalPages}
                        onClick={() => {
                          const p = auditPage + 1;
                          setAuditPage(p);
                          fetchAuditLogs(p, auditSearch, auditActionFilter);
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
