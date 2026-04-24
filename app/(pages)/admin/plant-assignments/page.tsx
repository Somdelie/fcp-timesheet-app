"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import {
  RotateCw,
  Wrench,
  MapPin,
  Search,
  X,
  Pencil,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type Assignment = {
  id: string;
  quantity: number;
  status: string;
  deployedOn: string;
  note: string | null;
  product: { id: string; name: string; thumbnailUrl: string | null };
  site: { id: string; name: string; code: string | null };
  assignedByUser: { id: string; name: string | null } | null;
  transfersIn: {
    fromSite: { id: string; name: string; code: string | null };
    transferredByUser: { id: string; name: string | null } | null;
    transferredOn: string;
  }[];
};

type Supervisor = {
  id: string;
  name: string | null;
  sites: { id: string; name: string; code: string | null }[];
};

type Site = { id: string; name: string; code: string | null };

const STATUS_OPTIONS = ["ALL", "DEPLOYED", "RETURNED", "DAMAGED", "LOST"];
const EDIT_STATUSES = ["DEPLOYED", "RETURNED", "DAMAGED", "LOST"];

function statusClass(status: string) {
  switch (status) {
    case "DEPLOYED":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300";
    case "RETURNED":
      return "bg-muted text-muted-foreground";
    case "DAMAGED":
      return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300";
    case "LOST":
      return "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PlantAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterSupervisor, setFilterSupervisor] = useState("ALL");

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Assignment | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editQty, setEditQty] = useState(1);
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Transfer state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Assignment | null>(null);
  const [transferSiteId, setTransferSiteId] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [transferNote, setTransferNote] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      const res = await fetch(`/api/app/admin/plant-assignments?${params}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load");
      setAssignments(json.data ?? []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/app/admin/supervisors", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setSupervisors(j.supervisors ?? []));
    fetch("/api/app/admin/sites", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setSites(j.sites ?? []));
  }, []);

  const supervisorSiteIds =
    filterSupervisor !== "ALL"
      ? new Set(
          supervisors
            .find((s) => s.id === filterSupervisor)
            ?.sites.map((s) => s.id) ?? [],
        )
      : null;

  const filtered = assignments.filter((a) => {
    if (supervisorSiteIds && !supervisorSiteIds.has(a.site.id)) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      a.product.name.toLowerCase().includes(term) ||
      a.site.name.toLowerCase().includes(term) ||
      (a.site.code ?? "").toLowerCase().includes(term)
    );
  });

  function openEdit(a: Assignment) {
    setEditTarget(a);
    setEditStatus(a.status);
    setEditQty(a.quantity);
    setEditNote(a.note ?? "");
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const res = await fetch(
        `/api/app/admin/plant-assignments/${editTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            status: editStatus,
            quantity: Number(editQty),
            note: editNote,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to update");
      toast.success("Assignment updated");
      setEditOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    } finally {
      setEditSaving(false);
    }
  }

  function openTransfer(a: Assignment) {
    setTransferTarget(a);
    setTransferSiteId("");
    setTransferQty(1);
    setTransferNote("");
    setTransferOpen(true);
  }

  async function handleTransfer() {
    if (!transferTarget || !transferSiteId) return;
    setTransferSaving(true);
    try {
      const res = await fetch(
        `/api/app/admin/plant-assignments/${transferTarget.id}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            toSiteId: transferSiteId,
            quantity: Number(transferQty),
            note: transferNote || undefined,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to transfer");
      toast.success("Plant transferred successfully");
      setTransferOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to transfer");
    } finally {
      setTransferSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Plant Assignments</h1>
        <Button variant="ghost" size="icon" onClick={load}>
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search item or site…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={filterSupervisor} onValueChange={setFilterSupervisor}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All supervisors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All supervisors</SelectItem>
            {supervisors.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name ?? s.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL" ? "All statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">Item</TableHead>
              <TableHead className="w-40">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Site
                </span>
              </TableHead>
              <TableHead className="w-16 text-center">Qty</TableHead>
              <TableHead className="w-28 text-center">Status</TableHead>
              <TableHead className="w-32">Deployed On</TableHead>
              <TableHead className="w-36">Transferred From</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  <Wrench className="mx-auto h-6 w-6 mb-1 opacity-30" />
                  {search
                    ? "No assignments match your search"
                    : "No assignments yet"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.product.name}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{a.site.name}</div>
                    {a.site.code && (
                      <div className="text-xs text-muted-foreground">
                        {a.site.code}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{a.quantity}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusClass(a.status)}`}
                    >
                      {a.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(a.deployedOn)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.transfersIn.length > 0
                      ? a.transfersIn[0].fromSite.name
                      : "Office"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Edit"
                        onClick={() => openEdit(a)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {a.status === "DEPLOYED" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Transfer to another site"
                          onClick={() => openTransfer(a)}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium">{editTarget?.product.name}</p>
              <p className="text-xs text-muted-foreground">
                {editTarget?.site.name}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDIT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={editQty}
                onChange={(e) => setEditQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Note{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={2}
                placeholder="Add a note…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Plant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium">
                {transferTarget?.product.name}
              </p>
              <p className="text-xs text-muted-foreground">
                From: {transferTarget?.site.name} — {transferTarget?.quantity}{" "}
                unit(s) available
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>To Site</Label>
              <Select value={transferSiteId} onValueChange={setTransferSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination site…" />
                </SelectTrigger>
                <SelectContent>
                  {sites
                    .filter((s) => s.id !== transferTarget?.site.id)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.code ? ` (${s.code})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity (max {transferTarget?.quantity})</Label>
              <Input
                type="number"
                min={1}
                max={transferTarget?.quantity ?? 1}
                value={transferQty}
                onChange={(e) => setTransferQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Note{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                rows={2}
                placeholder="Reason for transfer…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferSaving || !transferSiteId}
            >
              {transferSaving ? "Transferring…" : "Transfer →"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
