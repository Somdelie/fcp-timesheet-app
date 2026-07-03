import {
  UploadCloud,
  FolderPlus,
  Download,
  Share2,
  Search,
  FileText,
} from "lucide-react";

const actions = [
  { label: "Upload", icon: UploadCloud },
  { label: "New folder", icon: FolderPlus },
  { label: "Export", icon: Download },
  { label: "Share", icon: Share2 },
];

export function WorkspaceToolbar() {
  return (
    <div className="flex flex-col gap-4 rounded-[2rem] border-b border-white/10 bg-slate-950/75 px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20">
            <FileText className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300">
              FCP Workspace
            </p>
            <h1 className="text-2xl font-semibold text-slate-100">
              Project documents hub
            </h1>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex items-center rounded-3xl border border-white/10 bg-slate-900/80 px-4 py-3 text-slate-300 shadow-inner shadow-black/10">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              className="ml-3 w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              placeholder="Search files, sites, orders"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  className="inline-flex items-center gap-2 rounded-3xl bg-slate-900/90 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
                >
                  <Icon className="h-4 w-4 text-cyan-300" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
