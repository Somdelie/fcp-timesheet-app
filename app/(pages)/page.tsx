"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Building2,
  ClipboardCheck,
  Camera,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader,
} from "lucide-react";
import { useUserRole } from "@/lib/user-role-context";
import type { UserRole } from "@/lib/roles";

type RecentActivityItem = {
  id: string;
  kind: string;
  title: string;
  description: string;
  at: string; // ISO
  href?: string | null;
};

function formatRelativeTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const now = Date.now();
  const diffMs = Math.max(0, now - d.getTime());
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / (60 * 60000));
  const days = Math.floor(diffMs / (24 * 60 * 60000));

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function activityVisual(kind: string) {
  switch (kind) {
    case "TIMESHEET_APPROVED":
      return {
        Icon: CheckCircle,
        color: "text-emerald-600",
        bg: "bg-emerald-100",
      };
    case "TIMESHEET_SUBMITTED":
      return {
        Icon: ClipboardCheck,
        color: "text-blue-600",
        bg: "bg-blue-100",
      };
    case "TIMESHEET_REJECTED":
      return { Icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" };
    case "TIMESHEET_PAID":
      return { Icon: Clock, color: "text-indigo-600", bg: "bg-indigo-100" };
    case "EMPLOYEE_CREATED":
      return { Icon: Users, color: "text-cyan-600", bg: "bg-cyan-100" };
    case "SITE_CREATED":
      return { Icon: Building2, color: "text-violet-600", bg: "bg-violet-100" };
    case "PHOTO_VERIFIED":
      return { Icon: Camera, color: "text-green-600", bg: "bg-green-100" };
    case "PHOTO_FLAGGED":
      return {
        Icon: AlertCircle,
        color: "text-orange-600",
        bg: "bg-orange-100",
      };
    default:
      return { Icon: TrendingUp, color: "text-slate-600", bg: "bg-slate-100" };
  }
}

const lineChartConfig = {
  scans: { label: "Attendance Scans", color: "#1e5a8a" },
  sites: { label: "Active Sites", color: "#2ba3c1" },
} satisfies ChartConfig;

const wagesChartConfig = {
  wages: { label: "Wages (R)", color: "#e11d48" },
} satisfies ChartConfig;

const WAGE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

function formatWageCurrency(val: number): string {
  if (val >= 1000) return `R${(val / 1000).toFixed(1)}k`;
  return `R${val.toFixed(0)}`;
}

function TopSiteWagesChart({
  data,
}: {
  data: { site: string; wages: number }[];
}) {
  const max = Math.max(1, ...data.map((s) => s.wages));
  return (
    <div className="flex flex-col gap-3 py-1">
      {data.map((item, idx) => {
        const pct = (item.wages / max) * 100;
        const color = WAGE_COLORS[idx % WAGE_COLORS.length];
        return (
          <div key={idx} className="flex items-center gap-3">
            {/* Label */}
            <div className="flex items-center gap-2 w-27.5 min-w-27.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-semibold truncate text-foreground">
                {item.site}
              </span>
            </div>
            {/* Bar */}
            <div className="flex-1 h-6 rounded bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 4)}%`,
                  backgroundColor: color,
                  opacity: 0.85,
                }}
              />
            </div>
            {/* Amount */}
            <span className="text-sm font-bold text-muted-foreground w-15 text-right tabular-nums">
              {formatWageCurrency(item.wages)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const siteChartConfig = {
  workers: { label: "Workers", color: "#1e5a8a" },
  photos: { label: "Photos", color: "#10b981" },
} satisfies ChartConfig;

const photoChartConfig = {
  verified: { label: "Verified", color: "#10b981" },
  flagged: { label: "Flagged", color: "#f97316" },
} satisfies ChartConfig;

export default function HomePage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [topWagesData, setTopWagesData] = useState<any>(null);
  const [siteData, setSiteData] = useState<any>(null);
  const [photoData, setPhotoData] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const role = useUserRole();

  const ADMIN_CACHE_KEY = "dashboard-admin-v2";
  const SUP_CACHE_KEY = "dashboard-supervisor-v2";

  useEffect(() => {
    const loadData = async () => {
      try {
        if (role === "ADMIN") {
          const now = Date.now();

          try {
            const cachedRaw =
              typeof window !== "undefined"
                ? window.localStorage.getItem(ADMIN_CACHE_KEY)
                : null;
            if (cachedRaw) {
              const cached = JSON.parse(cachedRaw) as {
                ts: number;
                payload: any;
              } | null;
              if (cached && now - cached.ts < 1 * 60_000) {
                const json = cached.payload ?? {};
                setMetrics(json.metrics ?? null);
                setWeeklyData(json.weeklyAttendance ?? null);
                setTopWagesData(json.topSiteWages ?? null);
                setSiteData(json.siteActivity ?? null);
                setPhotoData(json.photoVerification ?? null);
                setRecentActivity(
                  Array.isArray(json.recentActivity) ? json.recentActivity : [],
                );
                return;
              }
            }
          } catch {
            // ignore localStorage errors
          }

          const res = await fetch("/api/app/admin/dashboard", {
            cache: "no-store",
            credentials: "include",
            headers: { accept: "application/json" },
          });

          if (!res.ok) {
            throw new Error(`Dashboard aggregate failed (${res.status})`);
          }

          const json = (await res.json().catch(() => null)) as {
            metrics?: any;
            weeklyAttendance?: any;
            topSiteWages?: any;
            siteActivity?: any;
            photoVerification?: any;
            recentActivity?: RecentActivityItem[];
          } | null;

          setMetrics(json?.metrics ?? null);
          setWeeklyData(json?.weeklyAttendance ?? null);
          setTopWagesData(json?.topSiteWages ?? null);
          setSiteData(json?.siteActivity ?? null);
          setPhotoData(json?.photoVerification ?? null);
          setRecentActivity(
            Array.isArray(json?.recentActivity) ? json!.recentActivity! : [],
          );

          try {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(
                ADMIN_CACHE_KEY,
                JSON.stringify({ ts: now, payload: json ?? {} }),
              );
            }
          } catch {
            // ignore localStorage errors
          }
        } else if (role === "SUPERVISOR") {
          const now = Date.now();

          try {
            const cachedRaw =
              typeof window !== "undefined"
                ? window.localStorage.getItem(SUP_CACHE_KEY)
                : null;
            if (cachedRaw) {
              const cached = JSON.parse(cachedRaw) as {
                ts: number;
                payload: any;
              } | null;
              if (cached && now - cached.ts < 1 * 60_000) {
                const json = cached.payload ?? {};
                setWeeklyData(json.weeklyAttendance ?? null);
                setTopWagesData(json.topSiteWages ?? null);
                setSiteData(json.siteActivity ?? null);
                setPhotoData(json.photoVerification ?? null);
                setRecentActivity([]);
                return;
              }
            }
          } catch {
            // ignore localStorage errors
          }

          const res = await fetch("/api/dashboard?type=all", {
            cache: "no-store",
            credentials: "include",
            headers: { accept: "application/json" },
          });

          if (!res.ok) {
            throw new Error(`Dashboard data failed (${res.status})`);
          }

          const json = (await res.json().catch(() => null)) as {
            metrics?: any;
            weeklyAttendance?: any;
            topSiteWages?: any;
            siteActivity?: any;
            photoVerification?: any;
          } | null;

          setWeeklyData(json?.weeklyAttendance ?? null);
          setTopWagesData(json?.topSiteWages ?? null);
          setSiteData(json?.siteActivity ?? null);
          setPhotoData(json?.photoVerification ?? null);
          setRecentActivity([]);

          try {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(
                SUP_CACHE_KEY,
                JSON.stringify({ ts: now, payload: json ?? {} }),
              );
            }
          } catch {
            // ignore localStorage errors
          }
        } else {
          // FOREMAN or other roles: no heavy dashboard data needed
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const weeklyAttendanceData = weeklyData || [];
  const topSiteWagesData = topWagesData || [];
  const siteActivityData = siteData || [];
  const photoVerificationData = photoData || [];

  if (role === "SUPERVISOR") {
    return (
      <div className="flex flex-col h-full bg-muted/30">
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Supervisor Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Overview of your sites, attendance and timesheets.
              </p>
            </div>
          </div>

          {/* Charts Row: attendance + timesheets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Attendance (My Sites)</CardTitle>
                <CardDescription>
                  Attendance scans and active sites over the week.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {weeklyAttendanceData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No attendance data yet for your sites.
                  </p>
                ) : (
                  <ChartContainer
                    config={lineChartConfig}
                    className="h-full w-full"
                  >
                    <LineChart data={weeklyAttendanceData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="scans"
                        stroke="var(--color-scans)"
                        strokeWidth={3}
                        dot={{ fill: "var(--color-scans)", r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sites"
                        stroke="var(--color-sites)"
                        strokeWidth={3}
                        dot={{ fill: "var(--color-sites)", r: 4 }}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top 5 Site Wages (My Sites)</CardTitle>
                <CardDescription>
                  Total wages across your sites.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topSiteWagesData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No wage data yet for your sites.
                  </p>
                ) : (
                  <TopSiteWagesChart data={topSiteWagesData} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sites + activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Sites by Activity</CardTitle>
                <CardDescription>
                  Worker scans this fortnight across your sites.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {siteActivityData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No site activity data yet for your sites.
                  </p>
                ) : (
                  <ChartContainer
                    config={siteChartConfig}
                    className="h-full w-full"
                  >
                    <BarChart data={siteActivityData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="site" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="workers"
                        fill="var(--color-workers)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="photos"
                        fill="var(--color-photos)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
                <CardDescription>
                  Jump straight to key supervisor actions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link
                    href="/supervisor/timesheets"
                    className="block w-full rounded border border-border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Review supervisor timesheets
                  </Link>
                  <Link
                    href="/sites"
                    className="block w-full rounded border border-border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    View my sites
                  </Link>
                  <Link
                    href="/employees"
                    className="block w-full rounded border border-border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    View site employees
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Activity (My Sites)</CardTitle>
                <CardDescription>
                  Latest events across the sites you supervise.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      icon: CheckCircle,
                      color: "text-emerald-600",
                      bg: "bg-emerald-100",
                      title: "Timesheet approved",
                      description: "Downtown Office - John Smith",
                      time: "2 hours ago",
                    },
                    {
                      icon: ClipboardCheck,
                      color: "text-blue-600",
                      bg: "bg-blue-100",
                      title: "Timesheet submitted",
                      description: "Harbor Complex - Jane Doe",
                      time: "4 hours ago",
                    },
                    {
                      icon: Camera,
                      color: "text-green-600",
                      bg: "bg-green-100",
                      title: "Photo verification completed",
                      description: "Riverside Project - 12 photos verified",
                      time: "Yesterday",
                    },
                  ].map((activity, index) => {
                    const Icon = activity.icon;
                    return (
                      <div
                        key={index}
                        className="flex items-start gap-4 pb-4 border-b last:border-b-0"
                      >
                        <div
                          className={`w-10 h-10 ${activity.bg} rounded flex items-center justify-center shrink-0`}
                        >
                          <Icon className={`w-5 h-5 ${activity.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">
                            {activity.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {activity.description}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {activity.time}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supervisor Shortcuts</CardTitle>
                <CardDescription>
                  Common tasks you perform frequently.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      label: "Approve pending timesheets",
                      icon: ClipboardCheck,
                      href: "/supervisor/timesheets",
                    },
                    {
                      label: "Review photo flags",
                      icon: AlertCircle,
                      href: "/sites",
                    },
                    {
                      label: "Check attendance anomalies",
                      icon: TrendingUp,
                      href: "/supervisor/timesheets",
                    },
                  ].map((action, index) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={index}
                        href={action.href}
                        className="w-full flex items-center gap-3 p-3 rounded border border-border hover:bg-muted transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium text-foreground text-sm">
                          {action.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (role === "FOREMAN") {
    return (
      <div className="flex flex-col h-full bg-muted/30">
        <div className="flex-1 p-6 space-y-6 overflow-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Foreman Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your daily site activity and attendance.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Foreman Area</CardTitle>
                <CardDescription>
                  Access your main foreman tools.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/foreman"
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  Go to foreman area
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attendance & Timesheets</CardTitle>
                <CardDescription>
                  Capture and review your crew attendance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/timesheets"
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  Go to timesheets
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Default: ADMIN dashboard with full system overview
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-2 overflow-auto pr-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Dashboard Overview
            </h1>
            <p className="text-muted-foreground mt-1">
              Overview of timesheet management system
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            Last updated:{" "}
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Employees */}
          <Card className="p-4 relative overflow-hidden bg-slate-900/90 border-blue-800">
            {/* Water Background */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14">
              <div className="absolute inset-0 bg-linear-to-r from-blue-500/25 to-blue-500/5 opacity-60" />
              <svg
                viewBox="0 0 2880 90"
                preserveAspectRatio="none"
                className="absolute bottom-0 left-0 h-full w-[200%] animate-wave"
              >
                <path
                  fill="currentColor"
                  className="text-white/10"
                  d="M0,40 C120,55 240,20 360,30 480,40 600,70 720,65 840,60 960,35 1080,30 1200,25 1320,40 1440,50 L1440,90 L0,90 Z"
                />
                <path
                  fill="currentColor"
                  className="text-white/10"
                  transform="translate(1440 0)"
                  d="M0,40 C120,55 240,20 360,30 480,40 600,70 720,65 840,60 960,35 1080,30 1200,25 1320,40 1440,50 L1440,90 L0,90 Z"
                />
              </svg>
            </div>

            <CardContent className="p-0 relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-blue-400 font-medium">
                    Active Employees
                  </p>
                  <p className="text-3xl font-bold text-slate-100">
                    {metrics?.totalEmployees ?? 0}
                  </p>
                  <p className="text-xs text-slate-400">Total active staff</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Sites */}
          <Card className="p-4 relative overflow-hidden bg-slate-900/90 border-cyan-800">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14">
              <div className="absolute inset-0 bg-linear-to-r from-cyan-500/25 to-cyan-500/5 opacity-60" />
              <svg
                viewBox="0 0 2880 90"
                preserveAspectRatio="none"
                className="absolute bottom-0 left-0 h-full w-[200%] animate-wave"
              >
                <path
                  fill="currentColor"
                  className="text-white/10"
                  d="M0,40 C120,55 240,20 360,30 480,40 600,70 720,65 840,60 960,35 1080,30 1200,25 1320,40 1440,50 L1440,90 L0,90 Z"
                />
                <path
                  fill="currentColor"
                  className="text-white/10"
                  transform="translate(1440 0)"
                  d="M0,40 C120,55 240,20 360,30 480,40 600,70 720,65 840,60 960,35 1080,30 1200,25 1320,40 1440,50 L1440,90 L0,90 Z"
                />
              </svg>
            </div>

            <CardContent className="p-0 relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-cyan-400 font-medium">
                    Active Sites
                  </p>
                  <p className="text-3xl font-bold text-slate-100">
                    {metrics?.activeSites ?? 0}
                  </p>
                  <p className="text-xs text-slate-400">Across all regions</p>
                </div>
                <div className="w-12 h-12 bg-cyan-500/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-cyan-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Foremen */}
          <Card className="p-4 relative overflow-hidden bg-slate-900/90 border-emerald-800">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14">
              <div className="absolute inset-0 bg-linear-to-r from-emerald-500/25 to-emerald-500/5 opacity-60" />
              <svg
                viewBox="0 0 2880 90"
                preserveAspectRatio="none"
                className="absolute bottom-0 left-0 h-full w-[200%] animate-wave"
              >
                <path
                  fill="currentColor"
                  className="text-white/10"
                  d="M0,40 C120,55 240,20 360,30 480,40 600,70 720,65 840,60 960,35 1080,30 1200,25 1320,40 1440,50 L1440,90 L0,90 Z"
                />
                <path
                  fill="currentColor"
                  className="text-white/10"
                  transform="translate(1440 0)"
                  d="M0,40 C120,55 240,20 360,30 480,40 600,70 720,65 840,60 960,35 1080,30 1200,25 1320,40 1440,50 L1440,90 L0,90 Z"
                />
              </svg>
            </div>

            <CardContent className="p-0 relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-emerald-400 font-medium">
                    Foremen
                  </p>
                  <p className="text-3xl font-bold text-slate-100">
                    {metrics?.totalForemen ?? 0}
                  </p>
                  <p className="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Team leads
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-500/10 flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Supervisors */}
          <Card className="p-4 relative overflow-hidden bg-slate-900/90 border-orange-800">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14">
              <div className="absolute inset-0 bg-linear-to-r from-orange-500/25 to-orange-500/5 opacity-60" />
              <svg
                viewBox="0 0 2880 90"
                preserveAspectRatio="none"
                className="absolute bottom-0 left-0 h-full w-[200%] animate-wave"
              >
                <path
                  fill="currentColor"
                  className="text-white/10"
                  d="M0,40 C120,55 240,20 360,30 480,40 600,70 720,65 840,60 960,35 1080,30 1200,25 1320,40 1440,50 L1440,90 L0,90 Z"
                />
                <path
                  fill="currentColor"
                  className="text-white/10"
                  transform="translate(1440 0)"
                  d="M0,40 C120,55 240,20 360,30 480,40 600,70 720,65 840,60 960,35 1080,30 1200,25 1320,40 1440,50 L1440,90 L0,90 Z"
                />
              </svg>
            </div>

            <CardContent className="p-0 relative z-10">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-orange-400 font-medium">
                    Supervisors
                  </p>
                  <p className="text-3xl font-bold text-slate-100">
                    {metrics?.totalSupervisors ?? 0}
                  </p>
                  <p className="text-xs text-orange-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Active Supervisors
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Weekly Attendance Trend */}
          <Card className="max-h-75 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle>Weekly Attendance Trend</CardTitle>
              <CardDescription>
                Attendance scans and active sites over the week
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ChartContainer
                config={lineChartConfig}
                className="h-full w-full"
              >
                <LineChart data={weeklyAttendanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="scans"
                    stroke="var(--color-scans)"
                    strokeWidth={3}
                    dot={{ fill: "var(--color-scans)", r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sites"
                    stroke="var(--color-sites)"
                    strokeWidth={3}
                    dot={{ fill: "var(--color-sites)", r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Top 5 Site Wages */}
          <Card className="max-h-75 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle>Top 5 Site Wages</CardTitle>
              <CardDescription>Total wages by site</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              {topSiteWagesData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No wage data available.
                </p>
              ) : (
                <TopSiteWagesChart data={topSiteWagesData} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Site Activity */}
          <Card className="max-h-75 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle>Top Sites by Activity</CardTitle>
              <CardDescription>
                Worker scans this fortnight by site
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ChartContainer
                config={siteChartConfig}
                className="h-full w-full"
              >
                <BarChart data={siteActivityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="site" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="workers"
                    fill="var(--color-workers)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="photos"
                    fill="var(--color-photos)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Photo Verification */}
          <Card className="max-h-75 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle>Photo Verification Status</CardTitle>
              <CardDescription>
                Monthly verification and flagged photos
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ChartContainer
                config={photoChartConfig}
                className="h-full w-full"
              >
                <AreaChart data={photoVerificationData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="verified"
                    stackId="1"
                    stroke="var(--color-verified)"
                    fill="var(--color-verified)"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="flagged"
                    stackId="1"
                    stroke="var(--color-flagged)"
                    fill="var(--color-flagged)"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity / Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest system events and updates
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[30vh] overflow-y-auto">
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No recent activity yet.
                  </div>
                ) : (
                  recentActivity.map((activity) => {
                    const { Icon, color, bg } = activityVisual(activity.kind);
                    const row = (
                      <div className="flex items-start gap-4 pb-4 border-b last:border-b-0">
                        <div
                          className={`w-10 h-10 ${bg} rounded flex items-center justify-center shrink-0`}
                        >
                          <Icon className={`w-5 h-5 ${color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">
                            {activity.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {activity.description}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatRelativeTime(activity.at)}
                        </span>
                      </div>
                    );

                    const href = activity.href ?? null;
                    return href ? (
                      <Link
                        key={activity.id}
                        href={href}
                        className="block rounded -m-2 p-2 hover:bg-muted/50 transition-colors"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div key={activity.id}>{row}</div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[30vh] overflow-y-auto">
              <div className="space-y-3">
                {[
                  {
                    label: "Add New Employee",
                    icon: Users,
                    href: "/employees?create=employee",
                  },
                  { label: "Create Site", icon: Building2, href: "/new" },
                  {
                    label: "Review Timesheets",
                    icon: ClipboardCheck,
                    href: "/timesheets",
                  },
                ].map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={index}
                      href={action.href}
                      prefetch={false}
                      className="w-full flex items-center gap-3 p-3 rounded border border-border hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground text-sm">
                        {action.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
