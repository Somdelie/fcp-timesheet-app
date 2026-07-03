import Link from "next/link";

import SchedulerPage from "@/app/(pages)/scheduler/page";
import NotesPage from "@/app/(pages)/notes/page";
import WorkspacePage from "@/app/(pages)/workspace/page";
import WeatherPage from "@/app/(pages)/weather/page";
import MergePdfsPage from "@/app/(pages)/merge-pdfs/page";

const TABS = [
  { value: "scheduler", label: "Scheduler" },
  { value: "notes", label: "Notes" },
  { value: "workspace", label: "Workspace" },
  { value: "weather", label: "Weather" },
  { value: "merge-pdfs", label: "Merge PDFs" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function isTabValue(value: string | undefined): value is TabValue {
  return TABS.some((tab) => tab.value === value);
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const activeTab = isTabValue(sp?.tab) ? sp.tab : "scheduler";

  return (
    <div className="mx-auto flex h-full w-full flex-col">
      <div className="flex h-full min-h-0 flex-col rounded border border-muted/50 bg-card">
        <div className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/overview?tab=${tab.value}`}
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

        <div className="mt-4 min-h-0 flex-1">
          {activeTab === "scheduler" ? <SchedulerPage /> : null}
          {activeTab === "notes" ? <NotesPage /> : null}
          {activeTab === "workspace" ? <WorkspacePage /> : null}
          {activeTab === "weather" ? <WeatherPage /> : null}
          {activeTab === "merge-pdfs" ? <MergePdfsPage /> : null}
        </div>
      </div>
    </div>
  );
}
