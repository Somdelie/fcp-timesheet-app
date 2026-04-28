"use client";

import { useEffect, useState } from "react";
import { Users, MapPin, Building2, Search, X } from "lucide-react";

type Foreman = {
  id: string;
  name: string;
  phoneNumber: string | null;
  sites: { id: string; name: string; code: string | null; location: string | null }[];
};

export default function SupervisorForemenPage() {
  const [foremen, setForemen] = useState<Foreman[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/app/supervisor/foremen")
      .then((r) => r.json())
      .then((data) => {
        setForemen(data.foremen ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load foremen");
        setLoading(false);
      });
  }, []);

  const filtered = foremen.filter((f) => {
    const q = search.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
(f.phoneNumber ?? "").toLowerCase().includes(q) ||
      f.sites.some((s) => s.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded border border-primary/30 bg-primary/10">
            <Users className="size-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
              My Foremen
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Assigned to your sites
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 py-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search foremen or sites…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded border border-border bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-secondary/60">
              <Users className="size-5 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? "No foremen match your search" : "No foremen assigned to your sites"}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((foreman) => (
              <div
                key={foreman.id}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80 hover:bg-secondary/30"
              >
                {/* Foreman header */}
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {foreman.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {foreman.name}
                    </p>
                    {foreman.phoneNumber && (
                      <p className="text-xs text-muted-foreground">{foreman.phoneNumber}</p>
                    )}
                  </div>
                </div>

                {/* Sites */}
                {foreman.sites.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      Active Sites
                    </p>
                    {foreman.sites.map((site) => (
                      <div
                        key={site.id}
                        className="flex items-center gap-2 rounded border border-border/60 bg-secondary/30 px-2.5 py-1.5"
                      >
                        <Building2 className="size-3 shrink-0 text-muted-foreground/50" />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                          {site.name}
                        </span>
                        {site.code && (
                          <span className="shrink-0 rounded border border-border bg-muted px-1 py-px text-[9px] font-bold tabular-nums text-muted-foreground">
                            {site.code}
                          </span>
                        )}
                        {site.location && (
                          <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground/50">
                            <MapPin className="size-2.5" />
                            {site.location}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/40">No active site assignments</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
