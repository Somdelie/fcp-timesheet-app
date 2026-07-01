import Link from "next/link";
import { redirect } from "next/navigation";

import AdminAttendanceAnalyticsPage from "@/app/(pages)/admin/attendance-analytics/page";
import AdminAttendanceScansPage from "@/app/(pages)/admin/attendance-scans/page";
import AdminManualScanPage from "@/app/(pages)/admin/manual-scan/page";
import AdminSitePhotosPage from "@/app/(pages)/admin/site-photos/page";
import EmployeePayrollSummaryReport from "@/components/timesheets/EmployeePayrollSummaryReport";

const TABS = [
  { value: "analytics", label: "Fortnight Analytics" },
  { value: "payroll", label: "Payroll Summary" },
  { value: "scans", label: "Attendance Scans" },
  { value: "manual", label: "Manual Scan" },
  { value: "photos", label: "Photo Verification" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function isTabValue(value: string | undefined): value is TabValue {
  return TABS.some((tab) => tab.value === value);
}

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  if (sp?.tab === "payroll-summary") {
    redirect("/admin/attendance?tab=analytics");
  }

  const activeTab = isTabValue(sp?.tab) ? sp.tab : "analytics";

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="rounded border border-muted/50 bg-card">
        <div className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/admin/attendance?tab=${tab.value}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === "analytics" ? <AdminAttendanceAnalyticsPage /> : null}
          {activeTab === "payroll" ? <EmployeePayrollSummaryReport /> : null}
          {activeTab === "scans" ? <AdminAttendanceScansPage /> : null}
          {activeTab === "manual" ? <AdminManualScanPage /> : null}
          {activeTab === "photos" ? <AdminSitePhotosPage /> : null}
        </div>
      </div>
    </div>
  );
}
