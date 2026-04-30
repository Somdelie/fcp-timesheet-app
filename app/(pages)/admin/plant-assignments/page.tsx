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
  Package,
  User2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Printer,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

// ─── Plant Assignments types ────────────────────────────────────────────────

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

// ─── Equipment Inventory types ───────────────────────────────────────────────

type EquipmentHolder = { id: string; name: string };
type EquipmentItem = {
  id: string;
  holderId: string | null;
  holder: EquipmentHolder | null;
  category: string;
  item: string;
  quantity: number;
  condition: string;
  notes: string | null;
  location: string | null;
};

const CONDITION_COLORS: Record<string, string> = {
  Good: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Needs Service": "bg-amber-100 text-amber-700 border-amber-200",
  "Beyond Repair": "bg-red-100 text-red-700 border-red-200",
  Stolen: "bg-slate-100 text-slate-600 border-slate-200",
};

const CONDITIONS = ["Good", "Needs Service", "Beyond Repair", "Stolen"] as const;

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlantPage() {
  const [activeTab, setActiveTab] = useState("assignments");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Plant &amp; Equipment</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="assignments" className="flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Plant Assignments
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Equipment Inventory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-4">
          <PlantAssignmentsTab />
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <EquipmentInventoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab: Plant Assignments ───────────────────────────────────────────────────

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

  // Reset page when filters change
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

        {/* Pagination footer */}
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

// ─── Tab: Equipment Inventory ─────────────────────────────────────────────────

const PAGE_SIZES = [5, 10, 25, 50] as const;

type EditForm = {
  category: string;
  item: string;
  quantity: number;
  condition: string;
  holderId: string;
  location: string;
  notes: string;
};

function EquipmentInventoryTab() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [holders, setHolders] = useState<EquipmentHolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeHolder, setActiveHolder] = useState<string>("__totals__");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(5);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EquipmentItem | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ category: "", item: "", quantity: 1, condition: "Good", holderId: "", location: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Add state
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<EditForm>({ category: "", item: "", quantity: 1, condition: "Good", holderId: "__none__", location: "", notes: "" });
  const [addSaving, setAddSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/admin/equipment-inventory");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setItems(data.items);
      setHolders(data.holders);
    } catch {
      toast.error("Failed to load equipment inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page when tab or search changes
  useEffect(() => { setPage(0); }, [activeHolder, search]);

  function openEdit(item: EquipmentItem) {
    setEditTarget(item);
    setEditForm({
      category: item.category,
      item: item.item,
      quantity: item.quantity,
      condition: item.condition,
      holderId: item.holderId ?? "__none__",
      location: item.location ?? "",
      notes: item.notes ?? "",
    });
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/app/admin/equipment-inventory/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...editForm,
          holderId: editForm.holderId === "__none__" ? null : editForm.holderId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");
      toast.success("Item updated");
      setEditOpen(false);
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to save");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAddSave() {
    setAddSaving(true);
    try {
      const res = await fetch("/api/app/admin/equipment-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...addForm,
          holderId: addForm.holderId === "__none__" ? null : addForm.holderId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");
      toast.success("Item added");
      setAddOpen(false);
      setAddForm({ category: "", item: "", quantity: 1, condition: "Good", holderId: "__none__", location: "", notes: "" });
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to save");
    } finally {
      setAddSaving(false);
    }
  }

  function printSummary() {
    const date = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
    const groups = sortedHolders.map((h) => ({
      name: h.name,
      items: items
        .filter((i) => i.holderId === h.id)
        .sort((a, b) => a.category.localeCompare(b.category) || a.item.localeCompare(b.item)),
    })).filter((g) => g.items.length > 0);

    const condBadge = (cond: string) => {
      const colors: Record<string, string> = {
        Good: "#d1fae5;color:#065f46",
        "Needs Service": "#fef3c7;color:#92400e",
        "Beyond Repair": "#fee2e2;color:#991b1b",
        Stolen: "#f1f5f9;color:#475569",
      };
      const style = colors[cond] ?? "#f1f5f9;color:#475569";
      return `<span style="background:${style.split(";color:")[0]};color:${style.split(";color:")[1]};padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid rgba(0,0,0,.1)">${cond}</span>`;
    };

    const holderSection = (name: string, rows: EquipmentItem[]) => {
      const total = rows.reduce((s, i) => s + i.quantity, 0);
      const rowsHtml = rows.map((i) => `
        <tr>
          <td>${i.category}</td>
          <td>${i.item}</td>
          <td style="text-align:center;font-weight:700">${i.quantity}</td>
          <td>${condBadge(i.condition)}</td>
          <td>${i.location ?? "—"}</td>
          <td>${i.notes ?? "—"}</td>
        </tr>`).join("");
      return `
        <div class="section">
          <div class="holder-header">${name}</div>
          <table>
            <thead><tr><th>Category</th><th>Item</th><th>Qty</th><th>Condition</th><th>Location</th><th>Notes</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot><tr><td colspan="2"><strong>Subtotal</strong></td><td style="text-align:center;font-weight:700">${total}</td><td colspan="3"></td></tr></tfoot>
          </table>
        </div>`;
    };

    const grandTotal = items.reduce((s, i) => s + i.quantity, 0);
    const html = `<!DOCTYPE html><html><head><title>Equipment Inventory Summary</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 0; padding: 20px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .meta { color: #64748b; font-size: 11px; margin-bottom: 20px; }
      .section { margin-bottom: 24px; page-break-inside: avoid; }
      .holder-header { background: #1e293b; color: white; padding: 6px 12px; font-weight: 700; font-size: 13px; border-radius: 4px 4px 0 0; }
      table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; }
      th { background: #f8fafc; text-align: left; padding: 6px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
      td { padding: 5px 10px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #e2e8f0; vertical-align: middle; }
      tr:last-child td { border-bottom: none; }
      tfoot td { background: #f8fafc; font-weight: 600; border-top: 2px solid #e2e8f0; }
      .grand { margin-top: 8px; text-align: right; font-size: 13px; font-weight: 700; }
      @media print { body { padding: 0; } .section { page-break-inside: avoid; } }
    </style></head><body>
    <h1>Equipment Inventory Summary</h1>
    <div class="meta">Printed on ${date} &nbsp;·&nbsp; ${groups.length} supervisors &nbsp;·&nbsp; ${grandTotal} total items</div>
    ${groups.map((g) => holderSection(g.name, g.items)).join("")}
    <div class="grand">Grand Total: ${grandTotal} items</div>
    </body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { toast.error("Pop-up blocked — allow pop-ups and try again"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.item.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.holder?.name.toLowerCase().includes(q) ||
        i.condition.toLowerCase().includes(q) ||
        (i.location ?? "").toLowerCase().includes(q) ||
        (i.notes ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  // Sorted holder list: Office first, then alpha
  const sortedHolders = useMemo(
    () =>
      [...holders].sort((a, b) => {
        if (a.name === "Office") return -1;
        if (b.name === "Office") return 1;
        return a.name.localeCompare(b.name);
      }),
    [holders],
  );

  // Company totals grouped by category
  const companyTotals = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const i of filteredItems) {
      if (!map.has(i.category)) map.set(i.category, new Map());
      const c = map.get(i.category)!;
      c.set(i.condition, (c.get(i.condition) ?? 0) + i.quantity);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, condMap]) => ({
        category,
        total: Array.from(condMap.values()).reduce((s, v) => s + v, 0),
        byCondition: condMap,
      }));
  }, [filteredItems]);

  // Items for the active holder tab
  const activeItems = useMemo(() => {
    if (activeHolder === "__totals__") return [];
    return filteredItems
      .filter((i) => (i.holderId ?? "__unassigned__") === activeHolder)
      .sort((a, b) => a.category.localeCompare(b.category) || a.item.localeCompare(b.item));
  }, [filteredItems, activeHolder]);

  const activeList = activeHolder === "__totals__" ? companyTotals : activeItems;
  const totalPages = Math.max(1, Math.ceil(activeList.length / pageSize));
  const pagedTotals = companyTotals.slice(page * pageSize, (page + 1) * pageSize);
  const pagedItems = activeItems.slice(page * pageSize, (page + 1) * pageSize);

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const filteredQty = filteredItems.reduce((s, i) => s + i.quantity, 0);

  // Badge count per tab
  const holderQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of filteredItems) {
      const k = i.holderId ?? "__unassigned__";
      m.set(k, (m.get(k) ?? 0) + i.quantity);
    }
    return m;
  }, [filteredItems]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search item, category, supervisor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {loading ? "Loading…" : search ? `${filteredQty} of ${totalQty} items` : `${totalQty} total items · ${holders.length} supervisors`}
        </span>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
        <Button variant="outline" size="sm" onClick={printSummary} disabled={loading || items.length === 0} className="gap-1.5">
          <Printer className="h-4 w-4" />
          Print Summary
        </Button>
        <Button variant="ghost" size="icon" onClick={fetchData}>
          <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Inline tab bar — scrollable */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1 min-w-max">
          {/* Company Totals tab */}
          <button
            onClick={() => setActiveHolder("__totals__")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap border",
              activeHolder === "__totals__"
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
            )}
          >
            <Package className="h-3.5 w-3.5" />
            Company Totals
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full", activeHolder === "__totals__" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>
              {companyTotals.length}
            </span>
          </button>

          {sortedHolders.map((h) => {
            const qty = holderQty.get(h.id) ?? 0;
            const isActive = activeHolder === h.id;
            return (
              <button
                key={h.id}
                onClick={() => setActiveHolder(h.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap border",
                  isActive
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                )}
              >
                <User2 className="h-3.5 w-3.5" />
                {h.name}
                <span className={cn("text-xs px-1.5 py-0.5 rounded-full", isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>
                  {qty}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RotateCw className="h-5 w-5 animate-spin mr-2" /> Loading inventory…
        </div>
      ) : activeHolder === "__totals__" ? (
        /* ── Company Totals table ── */
        <div className="rounded border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide border-r">Category</TableHead>
                  {CONDITIONS.map((c) => (
                    <TableHead key={c} className="text-center text-xs font-semibold uppercase tracking-wide border-r">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs border font-medium", CONDITION_COLORS[c])}>{c}</span>
                    </TableHead>
                  ))}
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyTotals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No items found</TableCell>
                  </TableRow>
                ) : (
                  pagedTotals.map((row) => (
                    <TableRow key={row.category} className="hover:bg-muted/30">
                      <TableCell className="font-medium border-r">{row.category}</TableCell>
                      {CONDITIONS.map((c) => {
                        const qty = row.byCondition.get(c) ?? 0;
                        return (
                          <TableCell key={c} className="text-center border-r">
                            {qty > 0 ? (
                              <span className={cn("inline-block px-2 py-0.5 rounded-md text-xs font-medium border", CONDITION_COLORS[c])}>{qty}</span>
                            ) : <span className="text-muted-foreground/40">—</span>}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-bold">{row.total}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {companyTotals.length > 0 && (
                <tfoot>
                  <TableRow className="bg-muted/60 border-t-2 font-bold hover:bg-muted/60">
                    <TableCell className="font-bold text-xs uppercase tracking-wide border-r">TOTAL</TableCell>
                    {CONDITIONS.map((c) => {
                      const total = filteredItems.filter((i) => i.condition === c).reduce((s, i) => s + i.quantity, 0);
                      return (
                        <TableCell key={c} className="text-center border-r font-bold">
                          {total > 0 ? total : <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-bold text-base">{filteredQty}</TableCell>
                  </TableRow>
                </tfoot>
              )}
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
            <div className="text-muted-foreground hidden text-sm lg:flex">
              Showing {companyTotals.length === 0 ? 0 : page * pageSize + 1} to{" "}
              {Math.min((page + 1) * pageSize, companyTotals.length)} of {companyTotals.length} categories
            </div>
            <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-sm font-medium">Rows per page</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                  <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                  <SelectContent side="top">
                    {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-fit items-center justify-center text-sm font-medium">
                Page {page + 1} of {totalPages}
              </div>
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => setPage(0)} disabled={page === 0}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Per-supervisor table with pagination ── */
        <div className="rounded border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide border-r w-[20%]">Category</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide border-r">Item</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide border-r text-center w-16">Qty</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide border-r w-36">Condition</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide border-r w-28">Location</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide border-r w-36">Notes</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide w-16 text-center">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      {search ? "No items match your search" : "No items for this supervisor"}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="border-r">
                        <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded">{item.category}</span>
                      </TableCell>
                      <TableCell className="font-medium border-r">{item.item}</TableCell>
                      <TableCell className="text-center border-r">
                        <Badge variant="secondary" className="font-bold">{item.quantity}</Badge>
                      </TableCell>
                      <TableCell className="border-r">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", CONDITION_COLORS[item.condition] ?? "bg-muted text-muted-foreground border-border")}>
                          {item.condition}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground border-r">{item.location ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground border-r">{item.notes ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/60">
            <div className="text-muted-foreground hidden text-sm lg:flex">
              Showing {activeItems.length === 0 ? 0 : page * pageSize + 1} to{" "}
              {Math.min((page + 1) * pageSize, activeItems.length)} of {activeItems.length} items
            </div>
            <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-sm font-medium">Rows per page</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                  <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                  <SelectContent side="top">
                    {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-fit items-center justify-center text-sm font-medium">
                Page {page + 1} of {totalPages}
              </div>
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => setPage(0)} disabled={page === 0}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Equipment Item</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 col-span-2">
              <Label>Item Name</Label>
              <Input value={editForm.item} onChange={(e) => setEditForm((f) => ({ ...f, item: e.target.value }))} placeholder="e.g. 6ft Step Ladder" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Ladders" />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={0} value={editForm.quantity} onChange={(e) => setEditForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={editForm.condition} onValueChange={(v) => setEditForm((f) => ({ ...f, condition: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", CONDITION_COLORS[c])}>{c}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Holder / Supervisor</Label>
              <Select value={editForm.holderId} onValueChange={(v) => setEditForm((f) => ({ ...f, holderId: v }))}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {sortedHolders.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Cape Town" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving || !editForm.item.trim() || !editForm.category.trim()}>
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Equipment Item</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 col-span-2">
              <Label>Item Name</Label>
              <Input value={addForm.item} onChange={(e) => setAddForm((f) => ({ ...f, item: e.target.value }))} placeholder="e.g. 6ft Step Ladder" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Ladders" />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={addForm.quantity} onChange={(e) => setAddForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={addForm.condition} onValueChange={(v) => setAddForm((f) => ({ ...f, condition: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", CONDITION_COLORS[c])}>{c}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Holder / Supervisor</Label>
              <Select value={addForm.holderId} onValueChange={(v) => setAddForm((f) => ({ ...f, holderId: v }))}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {sortedHolders.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={addForm.location} onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Cape Town" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSave} disabled={addSaving || !addForm.item.trim() || !addForm.category.trim()}>
              {addSaving ? "Saving…" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
