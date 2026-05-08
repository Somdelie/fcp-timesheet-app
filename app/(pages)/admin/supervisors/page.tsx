"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  Mail,
  Shield,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function AdminSupervisorsPage() {
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [viewTarget, setViewTarget] = useState<SupervisorRow | null>(null);
  const [editTarget, setEditTarget] = useState<SupervisorRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupervisorRow | null>(null);

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
                  Actions
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
                    <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-center">
                      <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                        {s.foremen.length}
                      </span>
                    </TableCell>
                    <TableCell className="border border-zinc-200 px-3 py-1 dark:border-zinc-700 text-[13px]">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setViewTarget(s)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setEditTarget(s)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(s)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={!!viewTarget}
        onOpenChange={(open) => !open && setViewTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View Supervisor</DialogTitle>
          </DialogHeader>
          {viewTarget ? (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Name
                </div>
                <div className="font-medium">{viewTarget.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Email
                </div>
                <div>{viewTarget.email}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">
                    Assigned Sites
                  </div>
                  <div className="text-lg font-semibold">
                    {viewTarget.sites.length}
                  </div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Foremen</div>
                  <div className="text-lg font-semibold">
                    {viewTarget.foremen.length}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Supervisor</DialogTitle>
          </DialogHeader>
          {editTarget ? (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Name
                </div>
                <Input value={editTarget.name ?? ""} readOnly />
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Email
                </div>
                <Input value={editTarget.email} readOnly />
              </div>
              <p className="text-xs text-muted-foreground">
                Editing is not wired yet. This modal is a placeholder for now.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Close
            </Button>
            <Button onClick={() => setEditTarget(null)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supervisor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete is not wired yet. No supervisor will be removed.
          </p>
          {deleteTarget ? (
            <div className="rounded border bg-muted/30 p-3 text-sm font-medium">
              {deleteTarget.name ?? deleteTarget.email}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setDeleteTarget(null)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
