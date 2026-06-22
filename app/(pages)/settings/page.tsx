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
  Plus,
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
  deleteTeamRate,
  updateCompanySettings,
  updateTeamDefaultRates,
  verifyTeamRateConfirmationCode,
} from "@/actions/company-settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getFortnightForDateUTC } from "@/lib/timesheetPeriods";

type TeamRateFormRow = {
  code: string;
  name: string;
  dayRate: string;
  isSystem: boolean;
  sortOrder: number;
  isNew?: boolean;
};

type TeamRateConfirmState =
  | { action: "save"; team?: never }
  | { action: "delete"; team: TeamRateFormRow };

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

function normalizeTeamCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
  const [teamRates, setTeamRates] = useState<TeamRateFormRow[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDayRate, setNewTeamDayRate] = useState("250");
  const [isSavingTeamRates, setIsSavingTeamRates] = useState(false);
  const [teamRateConfirm, setTeamRateConfirm] =
    useState<TeamRateConfirmState | null>(null);
  const [teamRateConfirmCode, setTeamRateConfirmCode] = useState("");
  const [isConfirmingTeamRate, setIsConfirmingTeamRate] = useState(false);
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
          setTeamRates(
            res.settings.teamRates?.length
              ? res.settings.teamRates.map((team) => ({
                  code: team.code,
                  name: team.name,
                  dayRate: String(team.dayRate),
                  isSystem: team.isSystem,
                  sortOrder: team.sortOrder,
                  isNew: false,
                }))
              : [
                  {
                    code: "PAINTERS",
                    name: "Painters",
                    dayRate: "250",
                    isSystem: true,
                    sortOrder: 10,
                    isNew: false,
                  },
                ],
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

  const validateTeamRateForm = () => {
    const invalidRate = teamRates.some((team) => {
      const rate = Number(team.dayRate.trim());
      return !Number.isFinite(rate) || rate < 0;
    });

    if (invalidRate || teamRates.some((team) => !team.name.trim())) {
      toast.error("Please enter valid team rates (0 or above).");
      return false;
    }

    return true;
  };

  const saveTeamRates = async (confirmationCode: string) => {
    setIsSavingTeamRates(true);
    try {
      const res = await updateTeamDefaultRates({
        teamRates: teamRates.map((team) => ({
          code: team.code,
          name: team.name.trim(),
          dayRate: team.dayRate.trim(),
          isSystem: team.isSystem,
          sortOrder: team.sortOrder,
        })),
        confirmationCode,
      });
      if (res.ok) {
        setTeamRates(
          res.settings.teamRates.map((team) => ({
            code: team.code,
            name: team.name,
            dayRate: String(team.dayRate),
            isSystem: team.isSystem,
            sortOrder: team.sortOrder,
            isNew: false,
          })),
        );
        toast.success("Team default rates updated!");
        return true;
      } else toast.error(res.error || "Failed to save team rates.");
    } catch (err) {
      console.error("Error saving team rates:", err);
      toast.error("Failed to save team rates.");
    } finally {
      setIsSavingTeamRates(false);
    }

    return false;
  };

  const handleSaveTeamRates = () => {
    if (!validateTeamRateForm()) return;
    setTeamRateConfirm({ action: "save" });
    setTeamRateConfirmCode("");
  };

  const handleAddTeamRate = () => {
    const name = newTeamName.trim();
    const code = normalizeTeamCode(name);
    const rate = Number(newTeamDayRate.trim());

    if (!name || !code) {
      toast.error("Enter a team name.");
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error("Enter a valid team rate.");
      return;
    }
    if (teamRates.some((team) => team.code === code)) {
      toast.error("That team already exists.");
      return;
    }

    setTeamRates((prev) => [
      ...prev,
      {
        code,
        name,
        dayRate: newTeamDayRate.trim() || "250",
        isSystem: false,
        sortOrder: (prev.length + 1) * 10,
        isNew: true,
      },
    ]);
    setNewTeamName("");
    setNewTeamDayRate("250");
  };

  const handleOpenDeleteTeamRate = (team: TeamRateFormRow) => {
    setTeamRateConfirm({ action: "delete", team });
    setTeamRateConfirmCode("");
  };

  const handleConfirmTeamRateAction = async () => {
    if (!teamRateConfirm) return;

    setIsConfirmingTeamRate(true);
    try {
      if (teamRateConfirm.action === "save") {
        const saved = await saveTeamRates(teamRateConfirmCode);
        if (!saved) return;
        setTeamRateConfirm(null);
        setTeamRateConfirmCode("");
        return;
      }

      if (teamRateConfirm.team.isNew) {
        const res = await verifyTeamRateConfirmationCode({
          confirmationCode: teamRateConfirmCode,
        });
        if (!res.ok) {
          toast.error(res.error || "Invalid confirmation code.");
          return;
        }
        setTeamRates((prev) =>
          prev.filter((team) => team.code !== teamRateConfirm.team.code),
        );
        toast.success("Team removed.");
      } else {
        const res = await deleteTeamRate({
          code: teamRateConfirm.team.code,
          confirmationCode: teamRateConfirmCode,
        });
        if (!res.ok) {
          toast.error(res.error || "Failed to delete team.");
          return;
        }
        setTeamRates((prev) =>
          prev.filter((team) => team.code !== teamRateConfirm.team.code),
        );
        toast.success("Team deleted.");
      }

      setTeamRateConfirm(null);
      setTeamRateConfirmCode("");
    } catch (err) {
      console.error("Error confirming team rate action:", err);
      toast.error("Failed to confirm action.");
    } finally {
      setIsConfirmingTeamRate(false);
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

  // Photo upload logs (server-side file logs)
  const [uploadLogs, setUploadLogs] = useState<any[]>([]);
  const [uploadLogsLoading, setUploadLogsLoading] = useState(false);
  const [uploadFilter, setUploadFilter] = useState<"all" | "success" | "fail">(
    "all",
  );
  const [importingLogs, setImportingLogs] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

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

  const fetchUploadLogs = async () => {
    setUploadLogsLoading(true);
    try {
      const data = await getJson<{ logs: any[] }>(
        `/api/app/admin/site-day-photos/upload-logs`,
      );
      setUploadLogs(data.logs ?? []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load upload logs");
    } finally {
      setUploadLogsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
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
          <div className="bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded">
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
                if (uploadLogs.length === 0) fetchUploadLogs();
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

            {/* Photo Upload Logs (server) */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5" />
                  <div>
                    <CardTitle>Photo Upload Logs</CardTitle>
                    <CardDescription>
                      Recent server-side logs for site-day photo uploads.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Button
                    size="sm"
                    onClick={() => fetchUploadLogs()}
                    disabled={uploadLogsLoading}
                  >
                    Refresh Logs
                  </Button>

                  <select
                    value={uploadFilter}
                    onChange={(e) => setUploadFilter(e.target.value as any)}
                    className="text-sm px-2 py-1 border rounded bg-white"
                  >
                    <option value="all">All</option>
                    <option value="success">Success</option>
                    <option value="fail">Fail</option>
                  </select>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      // export filtered logs as CSV
                      try {
                        const rows = (uploadLogs || []).filter((l) => {
                          if (uploadFilter === "all") return true;
                          if (uploadFilter === "success") return l.success;
                          return !l.success;
                        });
                        const header = [
                          "ts",
                          "success",
                          "userId",
                          "actingForemanId",
                          "siteDayId",
                          "durationMs",
                          "cloudinaryPublicId",
                          "imageUrl",
                          "errorText",
                        ];
                        const csv = [header.join(",")]
                          .concat(
                            rows.map((r: any) =>
                              [
                                r.ts,
                                r.success,
                                r.userId ?? "",
                                r.actingForemanId ?? "",
                                r.siteDayId ?? "",
                                r.durationMs ?? "",
                                r.cloudinaryPublicId ?? "",
                                r.imageUrl ?? "",
                                r.error ?? r.errorText ?? "",
                              ]
                                .map((c) => String(c).replace(/"/g, '""'))
                                .map((c) => `"${c}"`)
                                .join(","),
                            ),
                          )
                          .join("\n");

                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `photo-upload-logs-${new Date()
                          .toISOString()
                          .slice(0, 19)}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        toast.error("Failed to export CSV");
                      }
                    }}
                  >
                    Export CSV
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (
                        !confirm("Rotate current log and import archived logs?")
                      )
                        return;
                      setImportingLogs(true);
                      setImportResult(null);
                      try {
                        const res = await postJson<any>(
                          `/api/app/admin/site-day-photos/import-logs?includeCurrent=true`,
                        );
                        setImportResult(`Imported ${res.imported} rows`);
                        toast.success(`Imported ${res.imported} rows`);
                        await fetchUploadLogs();
                      } catch (e: any) {
                        console.error(e);
                        toast.error(e?.message || "Import failed");
                        setImportResult(`Error: ${e?.message ?? String(e)}`);
                      } finally {
                        setImportingLogs(false);
                      }
                    }}
                    disabled={importingLogs}
                  >
                    {importingLogs ? "Importing…" : "Import & Archive"}
                  </Button>

                  <span className="text-sm text-muted-foreground">
                    Showing {uploadLogs.length} recent entries
                  </span>
                </div>

                {uploadLogsLoading ? (
                  <div className="py-8 text-center">Loading…</div>
                ) : uploadLogs.length === 0 ? (
                  <div className="py-6 text-sm text-muted-foreground">
                    No upload logs found.
                  </div>
                ) : (
                  <div className="border rounded divide-y">
                    {(uploadLogs || [])
                      .filter((l) => {
                        if (uploadFilter === "all") return true;
                        if (uploadFilter === "success") return l.success;
                        return !l.success;
                      })
                      .map((l, idx) => (
                        <div
                          key={idx}
                          className="px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-muted-foreground">
                                {l.ts}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-xs font-mono"
                              >
                                {l.success ? "SUCCESS" : "FAIL"}
                              </Badge>
                              <span className="text-sm truncate ml-2">
                                SiteDay: {l.siteDayId ?? "—"} • user:{" "}
                                {l.userId ?? "—"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate max-w-lg">
                              {l.error
                                ? `Error: ${l.error}`
                                : `Duration: ${l.durationMs}ms • Cloudinary: ${l.cloudinaryPublicId ?? "—"}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-end">
                            {l.imageUrl ? (
                              <a
                                href={l.imageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm underline"
                              >
                                View
                              </a>
                            ) : null}
                            <span className="text-xs text-muted-foreground mt-1">
                              {new Date(l.ts).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
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

            <Card>
              <CardHeader>
                <CardTitle>Team Default Day Rates</CardTitle>
                <CardDescription>
                  Set default day rates per team type. These rates apply when an
                  employee has no individual override and the foreman has no
                  custom rate.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {teamRates.map((team, index) => (
                    <div
                      key={team.code}
                      className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end"
                    >
                      <div className="space-y-2">
                        <Label htmlFor={`team-${team.code}`}>
                          {team.name} Rate (R)
                        </Label>
                        <Input
                          id={`team-${team.code}`}
                          value={team.name}
                          onChange={(e) =>
                            setTeamRates((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, name: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          disabled={isLoadingSettings}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`team-rate-${team.code}`}>
                          Day Rate
                        </Label>
                        <Input
                          id={`team-rate-${team.code}`}
                          type="number"
                          step="0.01"
                          placeholder="e.g., 250.00"
                          value={team.dayRate}
                          onChange={(e) =>
                            setTeamRates((prev) =>
                              prev.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, dayRate: e.target.value }
                                  : row,
                              ),
                            )
                          }
                          disabled={isLoadingSettings}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Delete ${team.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleOpenDeleteTeamRate(team)}
                        disabled={isLoadingSettings || isSavingTeamRates}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="rounded border border-dashed p-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
                      <div className="space-y-2">
                        <Label htmlFor="newTeamName">New Team</Label>
                        <Input
                          id="newTeamName"
                          placeholder="e.g., Waterproofing"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          disabled={isLoadingSettings}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newTeamRate">Default Rate</Label>
                        <Input
                          id="newTeamRate"
                          type="number"
                          step="0.01"
                          placeholder="250"
                          value={newTeamDayRate}
                          onChange={(e) => setNewTeamDayRate(e.target.value)}
                          disabled={isLoadingSettings}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={handleAddTeamRate}
                        disabled={isLoadingSettings}
                      >
                        <Plus className="h-4 w-4" />
                        Add Team
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveTeamRates}
                      disabled={isSavingTeamRates || isLoadingSettings}
                    >
                      {isSavingTeamRates ? "Saving..." : "Save Team Rates"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <Dialog
            open={teamRateConfirm !== null}
            onOpenChange={(open) => {
              if (isConfirmingTeamRate) return;
              if (!open) {
                setTeamRateConfirm(null);
                setTeamRateConfirmCode("");
              }
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {teamRateConfirm?.action === "delete"
                    ? "Delete Team"
                    : "Confirm Team Changes"}
                </DialogTitle>
                <DialogDescription>
                  {teamRateConfirm?.action === "delete"
                    ? `Enter the confirmation code to delete ${teamRateConfirm.team.name}.`
                    : "Enter the confirmation code to save team edits."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="teamRateConfirmationCode">
                  Confirmation Code
                </Label>
                <Input
                  id="teamRateConfirmationCode"
                  type="password"
                  autoComplete="off"
                  value={teamRateConfirmCode}
                  onChange={(e) => setTeamRateConfirmCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmTeamRateAction();
                  }}
                  disabled={isConfirmingTeamRate}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTeamRateConfirm(null);
                    setTeamRateConfirmCode("");
                  }}
                  disabled={isConfirmingTeamRate}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={
                    teamRateConfirm?.action === "delete"
                      ? "destructive"
                      : "default"
                  }
                  onClick={handleConfirmTeamRateAction}
                  disabled={isConfirmingTeamRate || !teamRateConfirmCode.trim()}
                >
                  {isConfirmingTeamRate
                    ? "Checking..."
                    : teamRateConfirm?.action === "delete"
                      ? "Delete Team"
                      : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
                  <div className="space-y-4 bg-slate-50 dark:bg-slate-900 p-4 rounded border border-slate-200 dark:border-slate-700">
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
                  <div className="bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 px-4 py-3 rounded text-sm">
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
                <div className="bg-yellow-500/10 border border-yellow-500/25 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded">
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
                  <div className="border rounded p-4 space-y-2">
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
                  <div className="border rounded p-4 space-y-2">
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
                  <div className="border rounded p-4 space-y-2">
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
                  <div className="border rounded divide-y">
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
                    <SelectTrigger className="w-full sm:w-50">
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
                  <div className="border rounded divide-y">
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
                {/* Photo Upload Logs (also available here for quick correlation) */}
                <Card className="mt-4">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <ScrollText className="h-5 w-5" />
                      <div>
                        <CardTitle>Photo Upload Logs</CardTitle>
                        <CardDescription>
                          Recent server-side logs for site-day photo uploads
                          (errors and durations).
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-3">
                      <Button
                        size="sm"
                        onClick={() => fetchUploadLogs()}
                        disabled={uploadLogsLoading}
                      >
                        Refresh Logs
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Showing {uploadLogs.length} recent entries
                      </span>
                    </div>

                    {uploadLogsLoading ? (
                      <div className="py-8 text-center">Loading…</div>
                    ) : uploadLogs.length === 0 ? (
                      <div className="py-6 text-sm text-muted-foreground">
                        No upload logs found.
                      </div>
                    ) : (
                      <div className="border rounded divide-y">
                        {uploadLogs.map((l, idx) => (
                          <div
                            key={idx}
                            className="px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono text-muted-foreground">
                                  {l.ts}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-xs font-mono"
                                >
                                  {l.success ? "SUCCESS" : "FAIL"}
                                </Badge>
                                <span className="text-sm truncate ml-2">
                                  SiteDay: {l.siteDayId ?? "—"} • user:{" "}
                                  {l.userId ?? "—"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate max-w-lg">
                                {l.error
                                  ? `Error: ${l.error}`
                                  : `Duration: ${l.durationMs}ms • Cloudinary: ${l.cloudinaryPublicId ?? "—"}`}
                              </p>
                            </div>
                            <div className="flex flex-col items-end">
                              {l.imageUrl ? (
                                <a
                                  href={l.imageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm underline"
                                >
                                  View
                                </a>
                              ) : null}
                              <span className="text-xs text-muted-foreground mt-1">
                                {new Date(l.ts).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
