"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import {
  RotateCw,
  Wrench,
  MapPin,
  Search,
  X,
  Pencil,
  ArrowRightLeft,
  Undo2,
  Check,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import PlantDeployPOS, {
  type PlantSupervisorDto,
  type PlantItemDto,
} from "@/components/orders/PlantDeployPOS";
import { Truck } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

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

const STATUS_OPTIONS = ["ALL", "DEPLOYED", "RETURNED", "REPAIR", "DAMAGED", "LOST"];
const EDIT_STATUSES = ["DEPLOYED", "RETURNED", "REPAIR", "DAMAGED", "LOST"];

function siteLabel(s: Site) {
  return s.code ? `${s.code} - ${s.name}` : s.name;
}

function statusClass(status: string) {
  switch (status) {
    case "DEPLOYED":
      return "bg-blue-100 text-blue-700";
    case "RETURNED":
      return "bg-muted text-muted-foreground";
    case "REPAIR":
      return "bg-yellow-100 text-yellow-800";
    case "DAMAGED":
      return "bg-red-100 text-red-700";
    case "LOST":
      return "bg-orange-100 text-orange-700";
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PlantPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Plant Assignments</h1>
      </div>
      <PlantAssignmentsTab />
    </div>
  );
}

// ─── Plant Assignments ────────────────────────────────────────────────────────

function PlantAssignmentsTab() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [plantItems, setPlantItems] = useState<PlantItemDto[]>([]);
  const [deploySupervisors, setDeploySupervisors] = useState<PlantSupervisorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterSupervisor, setFilterSupervisor] = useState("ALL");
  const [returningId, setReturningId] = useState<string | null>(null);
  const [deployOpen, setDeployOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Assignment | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editQty, setEditQty] = useState(1);
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Assignment | null>(null);
  const [transferSiteId, setTransferSiteId] = useState("");
  const [transferSiteOpen, setTransferSiteOpen] = useState(false);
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
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/app/admin/supervisors", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        setSupervisors(j.supervisors ?? []);
        setDeploySupervisors(
          (j.supervisors ?? []).map((s: any) => ({
            id: s.id,
            name: s.name ?? null,
            email: s.email,
            sites: (s.sites ?? []).map((site: any) => ({ id: site.id, name: site.name, code: site.code ?? null })),
          }))
        );
      });
    fetch("/api/app/admin/sites", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setSites(j.sites ?? []));
    fetch("/api/app/admin/procurement-products?productType=PLANT&limit=500", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        const products = j.data ?? j.products ?? [];
        setPlantItems(products.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku ?? null, thumbnailUrl: p.thumbnailUrl ?? null, sizes: p.sizes ?? [] })));
      });
  }, []);

  const supervisorSiteIds =
    filterSupervisor !== "ALL"
      ? new Set(supervisors.find((s) => s.id === filterSupervisor)?.sites.map((s) => s.id) ?? [])
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
      const res = await fetch(`/api/app/admin/plant-assignments/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: editStatus, quantity: Number(editQty), note: editNote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to update");
      toast.success("Assignment updated");
      setEditOpen(false);
      load();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to update");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleReturnToOffice(a: Assignment) {
    setReturningId(a.id);
    try {
      const res = await fetch(`/api/app/admin/plant-assignments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "RETURNED" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to return");
      toast.success(`${a.product.name} returned to office`);
      load();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to return");
    } finally {
      setReturningId(null);
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
      const res = await fetch(`/api/app/admin/plant-assignments/${transferTarget.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toSiteId: transferSiteId, quantity: Number(transferQty), note: transferNote || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to transfer");
      toast.success("Plant transferred successfully");
      setTransferOpen(false);
      load();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to transfer");
    } finally {
      setTransferSaving(false);
    }
  }

  const selectedTransferSite = sites.find((s) => s.id === transferSiteId);
  const transferableSites = sites.filter((s) => s.id !== transferTarget?.site.id);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => { setPage(0); }, [search, filterStatus, filterSupervisor]);

  return (
    <div className="space-y-4">
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
              <SelectItem key={s.id} value={s.id}>{s.name ?? s.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="default" size="sm" onClick={() => setDeployOpen(true)} className="gap-1.5">
          <Truck className="h-4 w-4" />
          Deploy Plant
        </Button>
        <Button variant="ghost" size="icon" onClick={load}>
          <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Table */}
      <div className="rounded border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold uppercase tracking-wide border-r">Item</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide border-r">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />Site</span>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-center border-r w-16">Qty</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-center border-r w-28">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide border-r w-32">Deployed On</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide border-r w-36">From</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    <Wrench className="mx-auto h-6 w-6 mb-1 opacity-30" />
                    {search ? "No assignments match your search" : "No assignments yet"}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((a) => (
                  <TableRow key={a.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium border-r">{a.product.name}</TableCell>
                    <TableCell className="text-sm border-r whitespace-nowrap">
                      {a.site.code ? `${a.site.code} — ${a.site.name}` : a.site.name}
                    </TableCell>
                    <TableCell className="text-center border-r">
                      <Badge variant="secondary">{a.quantity}</Badge>
                    </TableCell>
                    <TableCell className="text-center border-r">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusClass(a.status)}`}>
                        {a.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground border-r">{formatDate(a.deployedOn)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground border-r">
                      {a.transfersIn.length > 0 ? a.transfersIn[0].fromSite.name : "Office"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {a.status === "DEPLOYED" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Transfer to another site" onClick={() => openTransfer(a)}>
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Return to office" disabled={returningId === a.id} onClick={() => handleReturnToOffice(a)}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 10, 25, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 text-xs">
              {filtered.length === 0 ? "0 of 0" : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)} of ${filtered.length}`}
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(0)} disabled={page === 0}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Assignment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium">{editTarget?.product.name}</p>
              <p className="text-xs text-muted-foreground">{editTarget?.site.name}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EDIT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={editQty} onChange={(e) => setEditQty(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} placeholder="Add a note…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editSaving}>{editSaving ? "Saving…" : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Transfer Plant</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium">{transferTarget?.product.name}</p>
              <p className="text-xs text-muted-foreground">
                From:{" "}
                {transferTarget?.site.code
                  ? `${transferTarget.site.code} - ${transferTarget.site.name}`
                  : transferTarget?.site.name}{" "}
                — {transferTarget?.quantity} unit(s) available
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>To Site</Label>
              <Popover open={transferSiteOpen} onOpenChange={setTransferSiteOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={transferSiteOpen} className="w-full justify-between h-10 text-sm font-normal">
                    <span className="truncate">{selectedTransferSite ? siteLabel(selectedTransferSite) : "Select destination site…"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search site…" className="text-sm" />
                    <CommandList>
                      <CommandEmpty>No site found.</CommandEmpty>
                      <CommandGroup>
                        {transferableSites.map((s) => (
                          <CommandItem key={s.id} value={siteLabel(s)} onSelect={() => { setTransferSiteId(s.id); setTransferSiteOpen(false); }} className="text-sm">
                            <Check className={cn("mr-2 h-4 w-4", transferSiteId === s.id ? "opacity-100" : "opacity-0")} />
                            {siteLabel(s)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity (max {transferTarget?.quantity})</Label>
              <Input type="number" min={1} max={transferTarget?.quantity ?? 1} value={transferQty} onChange={(e) => setTransferQty(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={transferNote} onChange={(e) => setTransferNote(e.target.value)} rows={2} placeholder="Reason for transfer…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={transferSaving || !transferSiteId}>
              {transferSaving ? "Transferring…" : "Transfer →"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deploy Sheet */}
      <Sheet open={deployOpen} onOpenChange={setDeployOpen}>
        <SheetContent side="right" className="w-full sm:max-w-full lg:max-w-[85vw] p-0 overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Deploy Plant to Site</SheetTitle>
          </SheetHeader>
          <PlantDeployPOS
            supervisors={deploySupervisors}
            items={plantItems}
            onDeployed={() => { setDeployOpen(false); load(); }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
