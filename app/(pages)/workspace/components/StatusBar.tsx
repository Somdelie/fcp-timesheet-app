export function StatusBar() {
  return (
    <div className="flex flex-col gap-3 border-t border-white/10 bg-slate-950/80 px-4 py-4 text-sm text-slate-400 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-3xl bg-slate-900/80 px-3 py-2 text-slate-100">
          Workspace online
        </span>
        <span className="rounded-3xl border border-white/10 bg-slate-900/80 px-3 py-2">
          Documents: 42
        </span>
        <span className="rounded-3xl border border-white/10 bg-slate-900/80 px-3 py-2">
          Sites: 8
        </span>
        <span className="rounded-3xl border border-white/10 bg-slate-900/80 px-3 py-2">
          Orders due: 3
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-slate-300">
        <span className="text-xs uppercase tracking-[0.24em] text-slate-500">
          Updated 5 min ago
        </span>
        <span className="rounded-3xl bg-cyan-500/10 px-3 py-2 text-cyan-200">
          Next milestone: Safety audit
        </span>
      </div>
    </div>
  );
}
