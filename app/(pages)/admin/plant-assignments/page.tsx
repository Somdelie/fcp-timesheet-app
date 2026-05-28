"use client";

import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
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
  Trash2,
  Printer,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Merge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { printSupervisorPlantList } from "@/lib/generatePlantListPrint";
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
  reference: string | null;
  quantity: number;
  status: string;
  deployedOn: string;
  note: string | null;
  supervisorName: string | null;
  product: { id: string; name: string; thumbnailUrl: string | null };
  site: { id: string; name: string; code: string | null };
  assignedByUser: { id: string; name: string | null } | null;
  transfersIn: {
    fromSite: { id: string; name: string; code: string | null };
    transferredByUser: { id: string; name: string | null } | null;
    transferredOn: string;
  }[];
};

type SupervisorAssignmentRow = Assignment & {
  childAssignments?: Assignment[];
};

type Supervisor = {
  id: string;
  name: string | null;
  sites: { id: string; name: string; code: string | null }[];
};

type Site = { id: string; name: string; code: string | null };

type OfficePlantItem = {
  id: string;
  name: string;
  sku: string | null;
  thumbnailUrl: string | null;
  stockQty: number;
  deployedQty: number;
  category: { id: string; name: string } | null;
};

const STATUS_OPTIONS = [
  "ALL",
  "DEPLOYED",
  "RETURNED",
  "REPAIR",
  "DAMAGED",
  "LOST",
];
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
  const [activeTab, setActiveTab] = useState("office");
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [officeItems, setOfficeItems] = useState<OfficePlantItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, aRes, pRes] = await Promise.all([
        fetch("/api/app/admin/supervisors", { credentials: "include" }),
        fetch("/api/app/admin/plant-assignments?status=DEPLOYED", {
          credentials: "include",
        }),
        fetch(
          "/api/app/admin/procurement-products?productType=PLANT&limit=500",
          { credentials: "include" },
        ),
      ]);
      const [sJson, aJson, pJson] = await Promise.all([
        sRes.json(),
        aRes.json(),
        pRes.json(),
      ]);
      setSupervisors(sJson.supervisors ?? []);
      setAssignments(aJson.data ?? []);
      setOfficeItems(pJson.data ?? []);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const siteToSup = useMemo(() => {
    const map = new Map<string, string>();
    supervisors.forEach((s) =>
      s.sites.forEach((site) => map.set(site.id, s.id)),
    );
    return map;
  }, [supervisors]);

  const supervisorAssignments = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    assignments.forEach((a) => {
      const key = siteToSup.get(a.site.id) ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [assignments, siteToSup]);

  const activeSupervisor = supervisors.find((s) => s.id === activeTab);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="rounded border border-muted/50 bg-card">
        <div className="flex border-b border-border overflow-x-auto">
          <PlantTab
            active={activeTab === "office"}
            onClick={() => setActiveTab("office")}
          >
            Office
          </PlantTab>
          {supervisors.map((s) => (
            <PlantTab
              key={s.id}
              active={activeTab === s.id}
              onClick={() => setActiveTab(s.id)}
            >
              {s.name ?? s.id}
            </PlantTab>
          ))}
          <div className="ml-auto flex items-center pr-2">
            <Button variant="ghost" size="icon" onClick={load} className="h-8 w-8">
              <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              Loading…
            </div>
          ) : activeTab === "office" ? (
            <OfficeTab items={officeItems} onRefresh={load} />
          ) : activeSupervisor ? (
            <SupervisorTab
              supervisor={activeSupervisor}
              assignments={supervisorAssignments.get(activeTab) ?? []}
              allSupervisors={supervisors}
              onRefresh={load}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PlantTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

const PAGE_SIZE = 10;

function SortBtn({
  field,
  active,
  dir,
  onToggle,
  children,
  center,
}: {
  field: string;
  active: boolean;
  dir: "asc" | "desc";
  onToggle: () => void;
  children: ReactNode;
  center?: boolean;
}) {
  const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ArrowUpDown;
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-foreground transition-colors ${center ? "justify-center w-full" : ""}`}
    >
      {children}
      <Icon className={`h-3 w-3 ${active ? "" : "opacity-40"}`} />
    </button>
  );
}

function PaginationBar({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground bg-muted/30">
      <span className="text-xs">
        {total === 0
          ? "0 items"
          : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPage(0)} disabled={page === 0}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPage(page - 1)} disabled={page === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onPage(totalPages - 1)} disabled={page >= totalPages - 1}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function OfficeTab({ items, onRefresh }: { items: OfficePlantItem[]; onRefresh: () => void }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "atOffice">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  // merge state
  const [mergeSource, setMergeSource] = useState<OfficePlantItem | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeSaving, setMergeSaving] = useState(false);

  function toggleSort(f: "name" | "atOffice") {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir("asc"); }
    setPage(0);
  }

  function openMerge(item: OfficePlantItem) {
    setMergeSource(item);
    setMergeTargetId("");
    setMergeSearch("");
  }

  async function handleMerge() {
    if (!mergeSource || !mergeTargetId) return;
    setMergeSaving(true);
    try {
      const res = await fetch(
        `/api/app/admin/procurement-products/${mergeSource.id}/merge`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetId: mergeTargetId }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to merge");
      toast.success(`Merged "${mergeSource.name}" into target product`);
      setMergeSource(null);
      onRefresh();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to merge");
    } finally {
      setMergeSaving(false);
    }
  }

  const mergeTargetOptions = useMemo(
    () =>
      items.filter(
        (p) =>
          p.id !== mergeSource?.id &&
          (mergeSearch === "" ||
            p.name.toLowerCase().includes(mergeSearch.toLowerCase())),
      ),
    [items, mergeSource, mergeSearch],
  );

  const processed = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = term
      ? items.filter((p) => p.name.toLowerCase().includes(term) || (p.sku ?? "").toLowerCase().includes(term))
      : items;
    return [...rows].sort((a, b) => {
      const cmp =
        sortField === "name"
          ? a.name.localeCompare(b.name)
          : (a.stockQty - a.deployedQty) - (b.stockQty - b.deployedQty);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, search, sortField, sortDir]);

  useEffect(() => { setPage(0); }, [search]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const paged = processed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search item…"
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

      {paged.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Wrench className="mx-auto h-6 w-6 mb-2 opacity-30" />
          <p>No items found</p>
        </div>
      ) : (
        <div className="rounded border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="border-r py-2 px-4">
                  <SortBtn field="name" active={sortField === "name"} dir={sortDir} onToggle={() => toggleSort("name")}>Item Name</SortBtn>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-center border-r w-32">Total Owned</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-center border-r w-28">Deployed</TableHead>
                <TableHead className="border-r py-2 px-4 w-28">
                  <SortBtn field="atOffice" active={sortField === "atOffice"} dir={sortDir} onToggle={() => toggleSort("atOffice")} center>At Office</SortBtn>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide w-20 py-2 px-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((p) => {
                const atOffice = (p.stockQty ?? 0) - (p.deployedQty ?? 0);
                return (
                  <TableRow key={p.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium border-r py-2">
                      <div className="flex items-center gap-2.5">
                        {p.thumbnailUrl ? (
                          <img src={p.thumbnailUrl} alt={p.name} className="h-8 w-8 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          {p.sku && <div className="text-xs text-muted-foreground">{p.sku}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center border-r py-2">
                      <Badge variant="secondary">{p.stockQty ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center border-r py-2">
                      {(p.deployedQty ?? 0) > 0 ? (
                        <Badge variant="outline">{p.deployedQty}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      {atOffice < 0 ? (
                        <span className="text-xs font-medium text-destructive">{atOffice}</span>
                      ) : atOffice === 0 ? (
                        <span className="text-xs text-muted-foreground">0</span>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 border-0">{atOffice}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Merge into another product"
                        onClick={() => openMerge(p)}
                      >
                        <Merge className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <PaginationBar page={page} totalPages={totalPages} total={processed.length} onPage={setPage} />
        </div>
      )}

      {/* Merge Dialog */}
      <Dialog open={!!mergeSource} onOpenChange={(o) => { if (!o) setMergeSource(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded border bg-muted/30 p-3 text-sm">
              <div className="text-xs text-muted-foreground mb-0.5">Merging (will be deleted)</div>
              <div className="font-medium">{mergeSource?.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {mergeSource?.stockQty ?? 0} units owned · {mergeSource?.deployedQty ?? 0} deployed
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Merge into</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search target product…"
                  value={mergeSearch}
                  onChange={(e) => { setMergeSearch(e.target.value); setMergeTargetId(""); }}
                  className="pl-9"
                />
              </div>
              <div className="max-h-48 overflow-y-auto rounded border divide-y text-sm">
                {mergeTargetOptions.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground text-xs">No products found</div>
                ) : (
                  mergeTargetOptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setMergeTargetId(p.id)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                        mergeTargetId === p.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.stockQty} owned</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {mergeTargetId && (() => {
              const tgt = items.find((p) => p.id === mergeTargetId);
              return tgt ? (
                <div className="rounded border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="font-semibold">After merge:</div>
                  <div>
                    <span className="font-medium">{tgt.name}</span> will have{" "}
                    <span className="font-medium">{(tgt.stockQty ?? 0) + (mergeSource?.stockQty ?? 0)}</span> units owned.
                  </div>
                  <div className="mt-1 font-medium">
                    "{mergeSource?.name}" will be permanently deleted.
                  </div>
                </div>
              ) : null;
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeSource(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleMerge}
              disabled={mergeSaving || !mergeTargetId}
            >
              {mergeSaving ? "Merging…" : "Merge & Delete Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type EditMode = "edit" | "return" | "transfer";

function SupervisorTab({
  supervisor,
  assignments,
  allSupervisors,
  onRefresh,
}: {
  supervisor: Supervisor;
  assignments: Assignment[];
  allSupervisors: Supervisor[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "qty">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  // dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Assignment | null>(null);
  const [editMode, setEditMode] = useState<EditMode>("edit");

  // edit details
  const [editStatus, setEditStatus] = useState("");
  const [editQty, setEditQty] = useState(1);
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // return
  const [returnQty, setReturnQty] = useState(1);
  const [returnNote, setReturnNote] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);

  // transfer
  const [transferSupId, setTransferSupId] = useState("");
  const [transferSiteId, setTransferSiteId] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [transferNote, setTransferNote] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);

  const [reprinting, setReprinting] = useState<string | null>(null);

  const transferSupervisors = allSupervisors.filter((s) => s.id !== supervisor.id);
  const transferSites = useMemo(
    () => allSupervisors.find((s) => s.id === transferSupId)?.sites ?? [],
    [allSupervisors, transferSupId],
  );

  function toggleSort(f: "name" | "qty") {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir("asc"); }
    setPage(0);
  }

  function openEdit(a: Assignment) {
    setEditTarget(a);
    setEditMode("edit");
    setEditStatus(a.status);
    setEditQty(a.quantity);
    setEditNote(a.note ?? "");
    setReturnQty(a.quantity);
    setReturnNote("");
    setTransferSupId("");
    setTransferSiteId("");
    setTransferQty(1);
    setTransferNote("");
    setEditOpen(true);
  }

  async function handleEditDetails() {
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
      onRefresh();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to update");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleReturn() {
    if (!editTarget) return;
    setReturnSaving(true);
    try {
      const res = await fetch(`/api/app/admin/plant-assignments/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "RETURNED", quantity: Number(returnQty), note: returnNote || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to return");
      toast.success(`${editTarget.product.name} returned to office`);
      setEditOpen(false);
      onRefresh();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to return");
    } finally {
      setReturnSaving(false);
    }
  }

  async function handleTransfer() {
    if (!editTarget || !transferSiteId) return;
    setTransferSaving(true);
    try {
      const res = await fetch(`/api/app/admin/plant-assignments/${editTarget.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toSiteId: transferSiteId, quantity: Number(transferQty), note: transferNote || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to transfer");
      toast.success("Plant transferred successfully");
      setEditOpen(false);
      onRefresh();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to transfer");
    } finally {
      setTransferSaving(false);
    }
  }

  async function handleReprint(a: Assignment) {
    setReprinting(a.id);
    const childAssignments = (a as SupervisorAssignmentRow).childAssignments ?? [a];
    const pad = (n: number) => String(n).padStart(2, "0");
    const deployed = new Date(a.deployedOn);
    const orderNumber =
      a.reference ??
      `PO-${deployed.getFullYear()}${pad(deployed.getMonth() + 1)}${pad(deployed.getDate())}-${a.id.slice(-4).toUpperCase()}`;
    const issuedDate = deployed.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
    const voucherData = {
      orderNumber,
      issuedDate,
      supervisorName: a.supervisorName ?? supervisor.name ?? "",
      sites: childAssignments.map((assignment) => ({
        siteName: assignment.site.name,
        siteCode: assignment.site.code,
        items: [
          {
            productName: assignment.product.name,
            quantity: assignment.quantity,
            note: assignment.note ?? undefined,
          },
        ],
      })),
    };
    try {
      const res = await fetch("/api/app/admin/plant-voucher/pdf", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(voucherData),
      });
      if (!res.ok) throw new Error("Failed to generate voucher");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Could not generate voucher PDF");
    } finally {
      setReprinting(null);
    }
  }

  function handlePrintAll() {
    const items = groupedAssignments.map((a) => ({
      productName: a.product.name,
      quantity: a.quantity,
    }));
    printSupervisorPlantList(supervisor.name ?? "Supervisor", items);
  }

  const groupedAssignments = useMemo<SupervisorAssignmentRow[]>(() => {
    const grouped = new Map<string, Assignment[]>();
    assignments.forEach((assignment) => {
      const normalizedName = assignment.product.name.trim().toLowerCase();
      const key = normalizedName || assignment.product.id;
      const existing = grouped.get(key) ?? [];
      existing.push(assignment);
      grouped.set(key, existing);
    });

    return Array.from(grouped.values()).map((group) => {
      const sorted = [...group].sort(
        (a, b) =>
          new Date(b.deployedOn).getTime() - new Date(a.deployedOn).getTime(),
      );
      const primary = sorted[0];
      const totalQuantity = sorted.reduce(
        (sum, assignment) => sum + assignment.quantity,
        0,
      );

      return {
        ...primary,
        id: sorted.map((assignment) => assignment.id).join("__"),
        quantity: totalQuantity,
        childAssignments: sorted,
      };
    });
  }, [assignments]);

  const processed = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = term
      ? groupedAssignments.filter((a) => a.product.name.toLowerCase().includes(term))
      : groupedAssignments;
    return [...rows].sort((a, b) => {
      const cmp = sortField === "name"
        ? a.product.name.localeCompare(b.product.name)
        : a.quantity - b.quantity;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [groupedAssignments, search, sortField, sortDir]);

  useEffect(() => { setPage(0); }, [search]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const paged = processed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (assignments.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Wrench className="mx-auto h-6 w-6 mb-2 opacity-30" />
        <p>No plant currently deployed to {supervisor.name ?? "this supervisor"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search item…"
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
        <Button variant="outline" size="sm" onClick={handlePrintAll} className="ml-auto gap-1.5 shrink-0">
          <Printer className="h-4 w-4" />
          Print List
        </Button>
      </div>

      {paged.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">No items match your search</div>
      ) : (
        <div className="rounded border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="border-r py-2 px-4">
                  <SortBtn field="name" active={sortField === "name"} dir={sortDir} onToggle={() => toggleSort("name")}>Item Name</SortBtn>
                </TableHead>
                <TableHead className="border-r py-2 px-4 w-32">
                  <SortBtn field="qty" active={sortField === "qty"} dir={sortDir} onToggle={() => toggleSort("qty")} center>Quantity</SortBtn>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide w-24 py-2 px-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((a) => {
                const isGrouped = (a.childAssignments?.length ?? 0) > 1;
                const sitesLabel = a.childAssignments
                  ?.map((assignment) =>
                    assignment.site.code
                      ? `${assignment.site.code} - ${assignment.site.name}`
                      : assignment.site.name,
                  )
                  .join(", ");

                return (
                  <TableRow key={a.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium border-r py-2">
                      <div>{a.product.name}</div>
                      {isGrouped && sitesLabel ? (
                        <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                          {sitesLabel}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-center border-r py-2">
                      <Badge variant="outline">{a.quantity}</Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={
                            isGrouped
                              ? "This total is across multiple sites"
                              : "Edit"
                          }
                          disabled={isGrouped}
                          onClick={() => openEdit(a)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Reprint voucher"
                          disabled={reprinting === a.id}
                          onClick={() => handleReprint(a)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <PaginationBar page={page} totalPages={totalPages} total={processed.length} onPage={setPage} />
        </div>
      )}

      {/* ── Edit / Return / Transfer Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget?.product.name}</DialogTitle>
          </DialogHeader>

          {/* Mode switcher */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            {(["edit", "return", "transfer"] as EditMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setEditMode(m)}
                className={`flex-1 py-1.5 font-medium capitalize transition-colors ${
                  editMode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {m === "edit" ? "Edit Details" : m === "return" ? "Return" : "Transfer"}
              </button>
            ))}
          </div>

          {/* Edit Details */}
          {editMode === "edit" && (
            <div className="space-y-4">
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
          )}

          {/* Return */}
          {editMode === "return" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Return plant to the office. Max available: <span className="font-medium text-foreground">{editTarget?.quantity}</span>
              </p>
              <div className="space-y-1.5">
                <Label>Quantity to return</Label>
                <Input
                  type="number"
                  min={1}
                  max={editTarget?.quantity ?? 1}
                  value={returnQty}
                  onChange={(e) => setReturnQty(Math.min(Number(e.target.value), editTarget?.quantity ?? 1))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea value={returnNote} onChange={(e) => setReturnNote(e.target.value)} rows={2} placeholder="Reason for return…" />
              </div>
            </div>
          )}

          {/* Transfer */}
          {editMode === "transfer" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Transfer to another supervisor's site. Max available: <span className="font-medium text-foreground">{editTarget?.quantity}</span>
              </p>
              <div className="space-y-1.5">
                <Label>To Supervisor</Label>
                <Select
                  value={transferSupId}
                  onValueChange={(v) => { setTransferSupId(v); setTransferSiteId(""); }}
                >
                  <SelectTrigger><SelectValue placeholder="Select supervisor…" /></SelectTrigger>
                  <SelectContent>
                    {transferSupervisors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name ?? s.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {transferSupId && (
                <div className="space-y-1.5">
                  <Label>To Site</Label>
                  <Select value={transferSiteId} onValueChange={setTransferSiteId}>
                    <SelectTrigger><SelectValue placeholder="Select site…" /></SelectTrigger>
                    <SelectContent>
                      {transferSites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.code ? `${s.code} — ${s.name}` : s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={editTarget?.quantity ?? 1}
                  value={transferQty}
                  onChange={(e) => setTransferQty(Math.min(Number(e.target.value), editTarget?.quantity ?? 1))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea value={transferNote} onChange={(e) => setTransferNote(e.target.value)} rows={2} placeholder="Reason for transfer…" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            {editMode === "edit" && (
              <Button onClick={handleEditDetails} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save Changes"}
              </Button>
            )}
            {editMode === "return" && (
              <Button onClick={handleReturn} disabled={returnSaving}>
                {returnSaving ? "Returning…" : "Return to Office"}
              </Button>
            )}
            {editMode === "transfer" && (
              <Button onClick={handleTransfer} disabled={transferSaving || !transferSiteId}>
                {transferSaving ? "Transferring…" : "Transfer"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Plant Assignments ────────────────────────────────────────────────────────

export function PlantAssignmentsTab({
  createTrigger,
}: {
  createTrigger?: number;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [plantItems, setPlantItems] = useState<PlantItemDto[]>([]);
  const [deploySupervisors, setDeploySupervisors] = useState<
    PlantSupervisorDto[]
  >([]);
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

  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reprinting, setReprinting] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (createTrigger) setDeployOpen(true);
  }, [createTrigger]);

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
            sites: (s.sites ?? []).map((site: any) => ({
              id: site.id,
              name: site.name,
              code: site.code ?? null,
            })),
          })),
        );
      });
    fetch("/api/app/admin/sites", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setSites(j.sites ?? []));
    fetch("/api/app/admin/procurement-products?productType=PLANT&limit=500", {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((j) => {
        const products = j.data ?? j.products ?? [];
        setPlantItems(
          products.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku ?? null,
            thumbnailUrl: p.thumbnailUrl ?? null,
            sizes: p.sizes ?? [],
          })),
        );
      });
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
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to transfer");
    } finally {
      setTransferSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/app/admin/plant-assignments/${deleteTarget.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete");
      toast.success(`${deleteTarget.product.name} assignment deleted`);
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function handleReprint(a: Assignment) {
    setReprinting(a.id);
    const pad = (n: number) => String(n).padStart(2, "0");
    const deployed = new Date(a.deployedOn);
    const orderNumber = a.reference ??
      `PO-${deployed.getFullYear()}${pad(deployed.getMonth() + 1)}${pad(deployed.getDate())}-${a.id.slice(-4).toUpperCase()}`;
    const issuedDate = deployed.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const voucherData = {
      orderNumber,
      issuedDate,
      supervisorName: a.supervisorName ?? a.assignedByUser?.name ?? "",
      sites: [
        {
          siteName: a.site.name,
          siteCode: a.site.code,
          items: [
            {
              productName: a.product.name,
              quantity: a.quantity,
              note: a.note ?? undefined,
            },
          ],
        },
      ],
    };
    try {
      const res = await fetch("/api/app/admin/plant-voucher/pdf", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(voucherData),
      });
      if (!res.ok) throw new Error("Failed to generate voucher");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("Could not generate voucher PDF");
    } finally {
      setReprinting(null);
    }
  }

  const selectedTransferSite = sites.find((s) => s.id === transferSiteId);
  const transferableSites = sites.filter(
    (s) => s.id !== transferTarget?.site.id,
  );

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => {
    setPage(0);
  }, [search, filterStatus, filterSupervisor]);

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
        {/* <Button
          variant="default"
          size="sm"
          onClick={() => setDeployOpen(true)}
          className="gap-1.5"
        >
          <Truck className="h-4 w-4" />
          Deploy Plant
        </Button> */}
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
                <TableHead className="text-xs font-semibold uppercase tracking-wide border-r w-28">
                  Order #
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide border-r">
                  Item
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide border-r">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Site
                  </span>
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-center border-r w-16">
                  Qty
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-center border-r w-28">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide border-r w-32">
                  Deployed On
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide border-r w-36">
                  From
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide w-24">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-10 text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-10 text-muted-foreground"
                  >
                    <Wrench className="mx-auto h-6 w-6 mb-1 opacity-30" />
                    {search
                      ? "No assignments match your search"
                      : "No assignments yet"}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((a) => (
                  <TableRow key={a.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm border-r">
                      {a.reference ? (
                        <span className="font-semibold text-foreground">#{a.reference}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium border-r">
                      {a.product.name}
                    </TableCell>
                    <TableCell className="text-sm border-r whitespace-nowrap">
                      {a.site.code
                        ? `${a.site.code} — ${a.site.name}`
                        : a.site.name}
                    </TableCell>
                    <TableCell className="text-center border-r">
                      <Badge variant="secondary">{a.quantity}</Badge>
                    </TableCell>
                    <TableCell className="text-center border-r">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusClass(a.status)}`}
                      >
                        {a.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground border-r">
                      {formatDate(a.deployedOn)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground border-r">
                      {a.transfersIn.length > 0
                        ? a.transfersIn[0].fromSite.name
                        : "Office"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
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
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Transfer to another site"
                              onClick={() => openTransfer(a)}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Return to office"
                              disabled={returningId === a.id}
                              onClick={() => handleReturnToOffice(a)}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Reprint voucher"
                          disabled={reprinting === a.id}
                          onClick={() => handleReprint(a)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Delete assignment"
                          onClick={() => setDeleteTarget(a)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(0);
              }}
            >
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 25, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 text-xs">
              {filtered.length === 0
                ? "0 of 0"
                : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)} of ${filtered.length}`}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(0)}
              disabled={page === 0}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
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
                From:{" "}
                {transferTarget?.site.code
                  ? `${transferTarget.site.code} - ${transferTarget.site.name}`
                  : transferTarget?.site.name}{" "}
                — {transferTarget?.quantity} unit(s) available
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>To Site</Label>
              <Popover
                open={transferSiteOpen}
                onOpenChange={setTransferSiteOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={transferSiteOpen}
                    className="w-full justify-between h-10 text-sm font-normal"
                  >
                    <span className="truncate">
                      {selectedTransferSite
                        ? siteLabel(selectedTransferSite)
                        : "Select destination site…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput
                      placeholder="Search site…"
                      className="text-sm"
                    />
                    <CommandList>
                      <CommandEmpty>No site found.</CommandEmpty>
                      <CommandGroup>
                        {transferableSites.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={siteLabel(s)}
                            onSelect={() => {
                              setTransferSiteId(s.id);
                              setTransferSiteOpen(false);
                            }}
                            className="text-sm"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                transferSiteId === s.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Assignment</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm">
              Are you sure you want to delete the assignment of{" "}
              <span className="font-semibold">
                {deleteTarget?.product.name}
              </span>{" "}
              at{" "}
              <span className="font-semibold">{deleteTarget?.site.name}</span>?
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deploy Sheet */}
      <Sheet open={deployOpen} onOpenChange={setDeployOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-full lg:max-w-[85vw] p-0 overflow-y-auto"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Deploy Plant to Site</SheetTitle>
          </SheetHeader>
          <PlantDeployPOS
            supervisors={deploySupervisors}
            items={plantItems}
            allSites={sites.map((s) => ({
              id: s.id,
              name: s.name,
              code: s.code,
            }))}
            onDeployed={() => {
              setDeployOpen(false);
              load();
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
