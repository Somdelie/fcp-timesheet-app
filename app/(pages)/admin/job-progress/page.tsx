import { listOngoingSites } from "@/actions/sites";
import JobProgressBoard from "@/components/sites/JobProgressBoard";
import { RotateCw } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Job Progress",
};

export default async function JobProgressPage() {
  const { sites } = await listOngoingSites();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Page header */}
      <div className="border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600/20 border border-blue-600/30">
              <span className="text-blue-400 text-base font-bold">{sites.length}</span>
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base tracking-tight text-white leading-none">
                Job Progress
              </h1>
              <p className="text-zinc-500 text-[10px] font-medium tracking-wider uppercase leading-none mt-0.5">
                Active ongoing sites
              </p>
            </div>
          </div>

          <a
            href="/admin/job-progress"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg px-3 py-1.5 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Refresh
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <JobProgressBoard initialSites={sites} />
      </div>
    </div>
  );
}
