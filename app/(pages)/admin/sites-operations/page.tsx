import Link from "next/link";

import JobProgressPage from "@/app/(pages)/admin/job-progress/page";
import FinishingSchedulesPage from "@/app/(pages)/admin/finishing-schedules/page";
import PaintPlanningPage from "@/app/(pages)/admin/paint-planning/page";
import PrintCardsPage from "@/app/(pages)/admin/print-cards/page";
import SiteProgramPage from "../site-program/page";

const TABS = [
  { value: "finishing-schedules", label: "Finishing Schedules" },
  { value: "job-program", label: "Job Program" },
  { value: "job-progress", label: "Job Progress" },
  { value: "paint-planning", label: "Paint Planning" },
  { value: "print-cards", label: "Print Cards" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function isTabValue(value: string | undefined): value is TabValue {
  return TABS.some((tab) => tab.value === value);
}

export default async function SitesOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const activeTab = isTabValue(sp?.tab) ? sp.tab : "finishing-schedules";

  return (
    <div className="">
      <div className="">
        <div className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/admin/sites-operations?tab=${tab.value}`}
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

        <div className="mt-3">
          {activeTab === "finishing-schedules" ? (
            <FinishingSchedulesPage />
          ) : null}
          {activeTab === "job-program" ? <SiteProgramPage /> : null}
          {activeTab === "job-progress" ? <JobProgressPage /> : null}
          {activeTab === "paint-planning" ? <PaintPlanningPage /> : null}
          {activeTab === "print-cards" ? <PrintCardsPage /> : null}
        </div>
      </div>
    </div>
  );
}
