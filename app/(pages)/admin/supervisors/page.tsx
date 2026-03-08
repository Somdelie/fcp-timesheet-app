"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Loader2, Mail, Building2, Users, Shield } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type SupervisorRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  supervisorId: string | null;
  sites: { id: string; name: string; code: string | null }[];
  foremen: { id: string; name: string }[];
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminSupervisorsPage() {
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const loadSupervisors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/admin/supervisors", {
        credentials: "include",
        headers: { accept: "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setSupervisors(json?.supervisors ?? []);
    } catch (e) {
      console.error("Failed to load supervisors:", e);
      setSupervisors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSupervisors();
  }, [loadSupervisors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return supervisors;
    return supervisors.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.sites.some(
          (site) =>
            site.name.toLowerCase().includes(q) ||
            (site.code ?? "").toLowerCase().includes(q),
        ) ||
        s.foremen.some((f) => f.name.toLowerCase().includes(q)),
    );
  }, [supervisors, query]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Supervisors</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, site..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} supervisor{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="border bg-card rounded overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Name
                </TableHead>
                <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Email
                </TableHead>
                <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Assigned Sites
                </TableHead>
                <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Foremen
                </TableHead>
                <TableHead className="border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide dark:border-zinc-700">
                  Joined
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    <Loader2 className="mx-auto h-5 w-5 animate-spin mb-1" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    <Shield className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    {query
                      ? "No supervisors match your search."
                      : "No supervisors found."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow
                    key={s.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700">
                      <div className="font-medium text-[13px]">
                        {s.name ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-[13px]">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {s.email}
                      </div>
                    </TableCell>
                    <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-center">
                      <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                        {s.sites.length}
                      </span>
                    </TableCell>
                    <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700">
                      {s.foremen.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          None
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.foremen.map((f) => (
                            <Badge
                              key={f.id}
                              variant="outline"
                              className="text-[11px]"
                            >
                              <Users className="h-3 w-3 mr-0.5" />
                              {f.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-[13px] text-muted-foreground">
                      {fmtDate(s.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
