"use client";

import { useEffect, useState } from "react";
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
import {
  getDashboardMetrics,
  getWeeklyAttendanceData,
  getTimesheetStatusData,
  getSiteActivityData,
  getPhotoVerificationData,
} from "@/actions/dashboard";

const lineChartConfig = {
  scans: { label: "Attendance Scans", color: "#1e5a8a" },
  sites: { label: "Active Sites", color: "#2ba3c1" },
} satisfies ChartConfig;

const barChartConfig = {
  count: { label: "Timesheets", color: "#1e5a8a" },
} satisfies ChartConfig;

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
  const [timesheetData, setTimesheetData] = useState<any>(null);
  const [siteData, setSiteData] = useState<any>(null);
  const [photoData, setPhotoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [metrics, weekly, timesheet, site, photo] = await Promise.all([
          getDashboardMetrics(),
          getWeeklyAttendanceData(),
          getTimesheetStatusData(),
          getSiteActivityData(),
          getPhotoVerificationData(),
        ]);

        setMetrics(metrics);
        setWeeklyData(weekly);
        setTimesheetData(timesheet);
        setSiteData(site);
        setPhotoData(photo);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const weeklyAttendanceData = weeklyData || [];
  const timesheetStatusData = timesheetData || [];
  const siteActivityData = siteData || [];
  const photoVerificationData = photoData || [];
  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of workforce management system
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
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">
                    Active Employees
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {metrics?.totalEmployees ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total active staff
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">
                    Active Sites
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {metrics?.activeSites ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Across all regions
                  </p>
                </div>
                <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">
                    Foremen
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {metrics?.totalForemen ?? 0}
                  </p>
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Team leads
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground font-medium">
                    Supervisors
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {metrics?.totalSupervisors ?? 0}
                  </p>
                  <p className="text-xs text-orange-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Active managers
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Camera className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly Attendance Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Attendance Trend</CardTitle>
              <CardDescription>
                Attendance scans and active sites over the past week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={lineChartConfig} className="h-75 w-full">
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

          {/* Timesheet Status */}
          <Card>
            <CardHeader>
              <CardTitle>Timesheet Status</CardTitle>
              <CardDescription>
                Current status of timesheet submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={barChartConfig} className="h-75 w-full">
                <BarChart data={timesheetStatusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Site Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Top Sites by Activity</CardTitle>
              <CardDescription>
                Worker count and photo submissions by site
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={siteChartConfig} className="h-75 w-full">
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
          <Card>
            <CardHeader>
              <CardTitle>Photo Verification Status</CardTitle>
              <CardDescription>
                Monthly verification and flagged photos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={photoChartConfig} className="h-75 w-full">
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
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    icon: CheckCircle,
                    color: "text-emerald-600",
                    bg: "bg-emerald-100",
                    title: "Timesheet approved",
                    description: "Site B - Week ending June 14, 2024",
                    time: "2 hours ago",
                  },
                  {
                    icon: Camera,
                    color: "text-blue-600",
                    bg: "bg-blue-100",
                    title: "Photo verification completed",
                    description: "Site A - 32 workers verified",
                    time: "4 hours ago",
                  },
                  {
                    icon: Users,
                    color: "text-cyan-600",
                    bg: "bg-cyan-100",
                    title: "New employee added",
                    description: "John Smith - QR code generated",
                    time: "5 hours ago",
                  },
                  {
                    icon: AlertCircle,
                    color: "text-orange-600",
                    bg: "bg-orange-100",
                    title: "Photo flagged for review",
                    description: "Site D - Attendance mismatch detected",
                    time: "6 hours ago",
                  },
                ].map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-4 pb-4 border-b last:border-b-0"
                    >
                      <div
                        className={`w-10 h-10 ${activity.bg} rounded-lg flex items-center justify-center shrink-0`}
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
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "Add New Employee", icon: Users },
                  { label: "Create Site", icon: Building2 },
                  { label: "Review Timesheets", icon: ClipboardCheck },
                  { label: "Request Photos", icon: Camera },
                ].map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={index}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground text-sm">
                        {action.label}
                      </span>
                    </button>
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
