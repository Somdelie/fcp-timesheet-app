import { listOngoingSites } from "@/actions/sites";
import JobProgressBoard from "@/components/sites/JobProgressBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Job Progress",
};

export default async function SupervisorJobProgressPage() {
  const { sites } = await listOngoingSites();

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="shrink-0 border-b border-border pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded border border-primary/30 bg-primary/10">
              <span className="text-sm font-black tabular-nums text-primary">
                {sites.length}
              </span>
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                Job Progress
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Your ongoing sites
              </p>
            </div>
          </div>

          <a
            href="/supervisor/job-progress"
            className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border/80 hover:text-foreground"
          >
            <svg
              className="size-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </a>
        </div>
      </div>

      {/* Board */}
      <div className="min-h-0 flex-1">
        <JobProgressBoard initialSites={sites} />
      </div>
    </div>
  );
}
