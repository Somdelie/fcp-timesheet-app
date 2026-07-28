"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  ArrowRightLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown,
  Clock,
  GripVertical,
  Loader2,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface SiteScan {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  employeePhotoUrl: string | null;
  scannedAt: string;
  scannedOutAt: string | null;
  isScannedOut: boolean;
  dayRate: string;
  isTransferred: boolean;
  workDateISO: string;
}

interface SiteOption {
  id: string;
  name: string;
  code: string | null;
}

interface ForemanOption {
  id: string;
  name: string;
}

interface TrashItem {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  description: string | null;
  metadata: unknown;
  deletedByName: string | null;
  deletedAt: string;
  expiresAt: string;
}

type SiteForemenState = {
  loading: boolean;
  loaded: boolean;
  foremen: ForemanOption[];
  selectedForemanId: string;
};

type PendingAction =
  | {
      type: "transfer";
      siteId: string;
      siteName: string;
      foremanId: string;
      foremanName: string;
      sameSite: boolean;
      employeeCount: number;
    }
  | {
      type: "delete";
      employeeCount: number;
    }
  | {
      type: "clear-trash";
      employeeCount: number;
    };

const emptyForemenState: SiteForemenState = {
  loading: false,
  loaded: false,
  foremen: [],
  selectedForemanId: "",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function siteLabel(site: SiteOption) {
  return site.code ? `${site.code} - ${site.name}` : site.name;
}

function dateKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateLabel(dateISO: string) {
  return dateFromDateKey(dateISO).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export default function AdminTransferEmployeePage() {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedDateISOs, setSelectedDateISOs] = useState<string[]>(() => [todayISO()]);
  const [dateCalendarMonth, setDateCalendarMonth] = useState(new Date());
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [scans, setScans] = useState<SiteScan[]>([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [selectedScanIds, setSelectedScanIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [foremenBySite, setForemenBySite] = useState<Record<string, SiteForemenState>>({});
  const [dragging, setDragging] = useState(false);
  const [dragOverSiteId, setDragOverSiteId] = useState<string | null>(null);
  const [transferringSiteId, setTransferringSiteId] = useState<string | null>(null);
  const [isOverBin, setIsOverBin] = useState(false);
  const [isDroppedInBin, setIsDroppedInBin] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [clearingTrash, setClearingTrash] = useState(false);
  const trashDropInProgressRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/app/admin/sites?fields=lite&isActive=true");
        if (!res.ok) throw new Error("Failed to load sites");
        const data = await res.json();
        setSites(data.sites || []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load sites");
      }
    })();
  }, []);

  const loadScans = useCallback(async (siteId: string, dateISOs: string[]) => {
    if (!siteId || dateISOs.length === 0) {
      setScans([]);
      setSelectedScanIds([]);
      return;
    }
    setLoadingScans(true);
    try {
      const settled = await Promise.allSettled(
        dateISOs.map(async (dateISO) => {
          const res = await fetch(
            `/api/app/supervisor/sites/${encodeURIComponent(siteId)}/scans-today?dateISO=${encodeURIComponent(dateISO)}`,
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `Failed to load scans for ${dateISO}`);
          const scansForDate: SiteScan[] = (data.scans || []).map((scan: SiteScan) => ({
            ...scan,
            workDateISO: dateISO,
          }));
          return scansForDate;
        }),
      );

      const nextScans: SiteScan[] = [];
      const errors: string[] = [];
      settled.forEach((result) => {
        if (result.status === "fulfilled") {
          nextScans.push(...result.value);
        } else {
          errors.push(result.reason instanceof Error ? result.reason.message : "Failed to load scans");
        }
      });

      setScans(nextScans);
      setSelectedScanIds((ids) =>
        ids.filter((id) => nextScans.some((scan) => scan.id === id)),
      );
      if (errors.length > 0) {
        toast.error(errors.length === 1 ? errors[0] : `${errors.length} dates failed to load`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load scans");
      setScans([]);
      setSelectedScanIds([]);
    } finally {
      setLoadingScans(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSiteId && selectedDateISOs.length > 0) {
      void loadScans(selectedSiteId, selectedDateISOs);
    } else {
      setScans([]);
      setSelectedScanIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId, selectedDateISOs.join(","), loadScans]);

  const ensureForemenForSite = useCallback(
    async (siteId: string) => {
      const current = foremenBySite[siteId];
      if (current?.loaded || current?.loading) return current ?? emptyForemenState;

      setForemenBySite((state) => ({
        ...state,
        [siteId]: { ...emptyForemenState, loading: true },
      }));

      try {
        const res = await fetch(
          `/api/app/supervisor/sites/${encodeURIComponent(siteId)}/scans-today?dateISO=${encodeURIComponent(todayISO())}`,
        );
        if (!res.ok) throw new Error("Failed to load foremen");
        const data = await res.json();
        const foremen: ForemanOption[] = data.foremen || [];
        const selectedForemanId = foremen.length === 1 ? foremen[0].id : "";
        const nextState = {
          loading: false,
          loaded: true,
          foremen,
          selectedForemanId,
        };
        setForemenBySite((state) => ({ ...state, [siteId]: nextState }));
        return nextState;
      } catch {
        const nextState = {
          loading: false,
          loaded: true,
          foremen: [],
          selectedForemanId: "",
        };
        setForemenBySite((state) => ({ ...state, [siteId]: nextState }));
        return nextState;
      }
    },
    [foremenBySite],
  );

  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const selectedSiteName = selectedSite ? siteLabel(selectedSite) : "";
  const destinationSites = useMemo(() => {
    const term = siteSearch.trim().toLowerCase();
    return sites
      .filter(
        (site) =>
          !term ||
          site.name.toLowerCase().includes(term) ||
          (site.code ?? "").toLowerCase().includes(term),
      )
      .sort((a, b) => {
        if (a.id === selectedSiteId) return -1;
        if (b.id === selectedSiteId) return 1;
        return 0;
      });
  }, [sites, selectedSiteId, siteSearch]);

  const filteredScans = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return scans.filter(
      (scan) =>
        !term ||
        scan.employeeName.toLowerCase().includes(term) ||
        scan.employeeCode.toLowerCase().includes(term),
    );
  }, [scans, searchQuery]);

  const selectedScanIdSet = useMemo(() => new Set(selectedScanIds), [selectedScanIds]);
  const selectedScans = useMemo(
    () => scans.filter((scan) => selectedScanIdSet.has(scan.id)),
    [scans, selectedScanIdSet],
  );
  const selectedTransferScans = useMemo(
    () => selectedScans.filter((scan) => !scan.isScannedOut),
    [selectedScans],
  );
  const scannedCount = scans.length;
  const photoScanOutCount = scans.filter((scan) => scan.isScannedOut).length;
  const allVisibleSelected =
    filteredScans.length > 0 &&
    filteredScans.every((scan) => selectedScanIdSet.has(scan.id));
  const someVisibleSelected =
    filteredScans.some((scan) => selectedScanIdSet.has(scan.id)) && !allVisibleSelected;
  const showTrashBin = dragging || isDroppedInBin || deletingSelected;
  const binImage = isDroppedInBin
    ? "/trash/bin-drop.png"
    : isOverBin
      ? "/trash/bin-open.png"
      : "/trash/bin-closed.png";
  const trashLabel = deletingSelected
    ? "Deleting..."
    : isOverBin
      ? `Drop to delete ${selectedScans.length}`
      : selectedScans.length > 0
        ? `Delete ${selectedScans.length} selected`
        : "Select employees first";
  const trashTileLabel = isOverBin
    ? `Drop to delete ${selectedScans.length}`
    : trashItems.length > 0
      ? `${trashItems.length} item${trashItems.length === 1 ? "" : "s"} in bin`
      : "Open trash bin";

  useEffect(() => {
    if (trashOpen) {
      void loadTrash();
    }
  }, [trashOpen]);

  function toggleScan(scanId: string, checked: boolean) {
    setSelectedScanIds((ids) =>
      checked
        ? ids.includes(scanId)
          ? ids
          : [...ids, scanId]
        : ids.filter((id) => id !== scanId),
    );
  }

  function toggleVisible(checked: boolean) {
    const visibleIds = filteredScans.map((scan) => scan.id);
    setSelectedScanIds((ids) => {
      if (!checked) return ids.filter((id) => !visibleIds.includes(id));
      const next = new Set(ids);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }

  function setSiteForeman(siteId: string, foremanId: string) {
    setForemenBySite((state) => ({
      ...state,
      [siteId]: {
        ...(state[siteId] ?? emptyForemenState),
        selectedForemanId: foremanId,
      },
    }));
  }

  async function loadTrash() {
    setLoadingTrash(true);
    try {
      const res = await fetch("/api/admin/trash");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load trash");
      setTrashItems(data.items || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load trash");
    } finally {
      setLoadingTrash(false);
    }
  }

  async function clearTrash() {
    setClearingTrash(true);
    try {
      const res = await fetch("/api/admin/trash", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to clear bin");
      setTrashItems([]);
      toast.success("Bin cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear bin");
    } finally {
      setClearingTrash(false);
    }
  }

  async function requestTransferToSite(siteId: string) {
    if (!selectedSiteId || selectedTransferScans.length === 0) {
      toast.info("Select employees that have not been closed by site photo");
      return;
    }

    const foremenState = await ensureForemenForSite(siteId);
    const latestState = foremenBySite[siteId] ?? foremenState;
    const foremanId = latestState.selectedForemanId || foremenState.selectedForemanId;

    if (!foremenState.foremen.length) {
      toast.error("No foreman assigned to this destination site");
      return;
    }
    if (!foremanId) {
      toast.info("Select a destination foreman on that site card first");
      return;
    }

    const destinationSite = sites.find((site) => site.id === siteId);
    const foremanName =
      foremenState.foremen.find((foreman) => foreman.id === foremanId)?.name ??
      "the selected foreman";
    setPendingAction({
      type: "transfer",
      siteId,
      siteName: destinationSite ? siteLabel(destinationSite) : "selected site",
      foremanId,
      foremanName,
      sameSite: siteId === selectedSiteId,
      employeeCount: selectedTransferScans.length,
    });
  }

  async function transferToSite(siteId: string, foremanId: string) {
    if (!selectedSiteId || selectedTransferScans.length === 0) {
      toast.info("Select employees that have not been closed by site photo");
      return;
    }

    setTransferringSiteId(siteId);
    try {
      const failures: string[] = [];
      const transferredIds: string[] = [];

      for (const scan of selectedTransferScans) {
        const res = await fetch("/api/app/supervisor/transfer-employee", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: scan.employeeId,
            fromSiteId: selectedSiteId,
            toSiteId: siteId,
            toForemanId: foremanId,
            workDateISO: scan.workDateISO,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          failures.push(`${scan.employeeName}: ${data.error || "Transfer failed"}`);
        } else {
          transferredIds.push(scan.id);
        }
      }

      if (transferredIds.length > 0) {
        toast.success(
          transferredIds.length === 1
            ? "Employee transferred"
            : `${transferredIds.length} employees transferred`,
        );
        setSelectedScanIds((ids) => ids.filter((id) => !transferredIds.includes(id)));
      }

      if (failures.length > 0) {
        toast.error(
          failures.length === 1
            ? failures[0]
            : `${failures.length} transfers failed. ${failures[0]}`,
        );
      }

      await loadScans(selectedSiteId, selectedDateISOs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferringSiteId(null);
    }
  }

  async function deleteSelectedScans() {
    if (selectedScans.length === 0) {
      toast.info("Select one or more employees first");
      return;
    }

    setDeletingSelected(true);
    try {
      const failures: string[] = [];
      const deletedIds: string[] = [];

      for (const scan of selectedScans) {
        const res = await fetch(
          `/api/admin/attendance-scans?id=${encodeURIComponent(scan.id)}`,
          { method: "DELETE" },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          failures.push(`${scan.employeeName}: ${data.error || "Delete failed"}`);
        } else {
          deletedIds.push(scan.id);
        }
      }

      if (deletedIds.length > 0) {
        toast.success(
          deletedIds.length === 1
            ? "Employee scan deleted"
            : `${deletedIds.length} employee scans deleted`,
        );
        setSelectedScanIds((ids) => ids.filter((id) => !deletedIds.includes(id)));
      }

      if (failures.length > 0) {
        toast.error(
          failures.length === 1
            ? failures[0]
            : `${failures.length} deletes failed. ${failures[0]}`,
        );
      }

      if (selectedSiteId) {
        await loadScans(selectedSiteId, selectedDateISOs);
      }
      if (trashOpen) {
        await loadTrash();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingSelected(false);
    }
  }

  function handleDragStart(event: React.DragEvent) {
    if (selectedScans.length === 0) {
      event.preventDefault();
      toast.info("Select one or more employees first");
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", selectedScanIds.join(","));
    event.dataTransfer.setData("scanIds", selectedScanIds.join(","));
    setDragging(true);
  }

  function handleDragEnd() {
    if (trashDropInProgressRef.current) return;
    setDragging(false);
    setDragOverSiteId(null);
    setIsOverBin(false);
  }

  async function handleTrashDrop(event: React.DragEvent) {
    event.preventDefault();
    if (selectedScans.length === 0) {
      setIsOverBin(false);
      toast.info("Select one or more employees first");
      return;
    }
    trashDropInProgressRef.current = true;
    setIsDroppedInBin(true);
    setIsOverBin(false);
    setDragOverSiteId(null);
    setPendingAction({ type: "delete", employeeCount: selectedScans.length });
  }

  function requestDeleteSelectedScans() {
    setTrashOpen(true);
  }

  function resetTrashDragState() {
    setIsDroppedInBin(false);
    setDragging(false);
    trashDropInProgressRef.current = false;
    setIsOverBin(false);
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);

    if (action.type === "transfer") {
      await transferToSite(action.siteId, action.foremanId);
      return;
    }

    if (action.type === "clear-trash") {
      await clearTrash();
      return;
    }

    setIsDroppedInBin(true);
    await deleteSelectedScans();
    setTimeout(resetTrashDragState, 600);
  }

  function cancelPendingAction() {
    setPendingAction(null);
    resetTrashDragState();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Employee
          </CardTitle>
          <CardDescription>
            Select employees, then drag them to a destination site or the dustbin.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_180px_1fr]">
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Source Site
              </label>
              <Popover open={siteOpen} onOpenChange={setSiteOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={siteOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedSiteId ? selectedSiteName : "Select a site..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search sites..." />
                    <CommandList>
                      <CommandEmpty>No sites found.</CommandEmpty>
                      <CommandGroup>
                        {sites.map((site) => (
                          <CommandItem
                            key={site.id}
                            value={site.id}
                            keywords={[site.name, site.code ?? ""]}
                            onSelect={() => {
                              setSelectedSiteId(site.id === selectedSiteId ? "" : site.id);
                              setSiteOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSiteId === site.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {siteLabel(site)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Work Date{selectedDateISOs.length > 1 ? "s" : ""}
              </label>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {selectedDateISOs.length === 0
                        ? "Select date(s)..."
                        : selectedDateISOs.length === 1
                          ? dateLabel(selectedDateISOs[0])
                          : `${selectedDateISOs.length} dates selected`}
                    </span>
                    <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="multiple"
                    month={dateCalendarMonth}
                    onMonthChange={setDateCalendarMonth}
                    selected={selectedDateISOs.map(dateFromDateKey)}
                    onSelect={(dates) => {
                      const keys = Array.from(
                        new Set((dates ?? []).map(dateKeyFromDate)),
                      ).sort();
                      setSelectedDateISOs(keys.length ? keys : [todayISO()]);
                      setSelectedScanIds([]);
                    }}
                  />
                  <div className="flex items-center justify-between gap-2 border-t p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDateISOs([todayISO()]);
                        setSelectedScanIds([]);
                      }}
                    >
                      Today only
                    </Button>
                    <Button type="button" size="sm" onClick={() => setDatePopoverOpen(false)}>
                      Done
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Search Employees
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by name or code..."
                  className="pl-9"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {selectedSiteId ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded border p-3 text-center">
                <div className="text-2xl font-black text-green-600">{scannedCount}</div>
                <div className="text-xs font-medium text-muted-foreground">Scanned</div>
              </div>
              <div className="rounded border p-3 text-center">
                <div className="text-2xl font-black text-slate-500">{photoScanOutCount}</div>
                <div className="text-xs font-medium text-muted-foreground">Closed by Site Photo</div>
              </div>
              <div className="rounded border p-3 text-center">
                <div className="text-2xl font-black text-blue-600">{selectedScans.length}</div>
                <div className="text-xs font-medium text-muted-foreground">Selected</div>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={requestDeleteSelectedScans}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    requestDeleteSelectedScans();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setIsOverBin(true);
                }}
                onDragEnter={() => setIsOverBin(true)}
                onDragLeave={() => setIsOverBin(false)}
                onDrop={(event) => void handleTrashDrop(event)}
                className={cn(
                  "flex min-h-[86px] cursor-pointer items-center gap-3 rounded border border-dashed p-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedScans.length > 0
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300"
                    : "bg-muted/30 text-muted-foreground",
                  isOverBin && "scale-[1.02] border-red-500 bg-red-100 ring-2 ring-red-200 dark:bg-red-950/40",
                  isDroppedInBin && "animate-bounce",
                )}
              >
                <img src={binImage} alt="Trash bin" className="h-14 w-14 shrink-0 object-contain" />
                <div className="min-w-0">
                  <div className="text-sm font-bold">Delete scans</div>
                  <div className="text-xs font-medium">{trashTileLabel}</div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {selectedSiteId ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.35fr)]">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Employees ({filteredScans.length})
                  </CardTitle>
                  <CardDescription>
                    Site-photo closed rows can be deleted. Only open scans can be transferred.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    aria-label="Select all visible employees"
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => toggleVisible(checked === true)}
                  />
                  <span className="text-xs text-muted-foreground">All</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingScans ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredScans.length === 0 ? (
                <div className="rounded border border-dashed py-16 text-center text-sm text-muted-foreground">
                  No employee scans match this view.
                </div>
              ) : (
                <div
                  draggable={selectedScans.length > 0}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "space-y-2 rounded border border-dashed p-2 transition-colors",
                    selectedScans.length > 0 && "cursor-grab border-primary/40 bg-primary/5 active:cursor-grabbing",
                  )}
                >
                  {selectedScans.length > 0 ? (
                    <div className="flex items-center justify-between rounded bg-background px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      <span>{selectedScans.length} selected</span>
                      <span className="inline-flex items-center gap-1">
                        <GripVertical className="h-3.5 w-3.5" />
                        Drag selected group
                      </span>
                    </div>
                  ) : null}

                  {filteredScans.map((scan) => {
                    const selected = selectedScanIdSet.has(scan.id);
                    return (
                      <div
                        key={scan.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleScan(scan.id, !selected)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleScan(scan.id, !selected);
                          }
                        }}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded border bg-background p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected && "border-primary bg-primary/10",
                        )}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(checked) => toggleScan(scan.id, checked === true)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${scan.employeeName}`}
                        />
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted text-sm font-semibold">
                          {scan.employeePhotoUrl ? (
                            <img
                              src={scan.employeePhotoUrl}
                              alt={scan.employeeName}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            scan.employeeName
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{scan.employeeName}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{scan.employeeCode}</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timeLabel(scan.scannedAt)}
                            </span>
                            {selectedDateISOs.length > 1 ? (
                              <span className="inline-flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {dateLabel(scan.workDateISO)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {scan.isTransferred ? (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            Transferred here
                          </Badge>
                        ) : null}
                        {scan.isScannedOut ? (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            Site photo closed
                          </Badge>
                        ) : (
                          <Badge className="shrink-0 bg-green-600 text-xs hover:bg-green-600">
                            Open scan
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Destination Sites</CardTitle>
                  <CardDescription>
                    Drop selected employees onto a destination site, or onto the source site
                    itself to move them to a different foreman.
                  </CardDescription>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={siteSearch}
                    onChange={(event) => setSiteSearch(event.target.value)}
                    placeholder="Search destination sites..."
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid max-h-[640px] gap-3 overflow-auto pr-1 md:grid-cols-2">
                {destinationSites.map((site) => {
                  const state = foremenBySite[site.id] ?? emptyForemenState;
                  const isOver = dragOverSiteId === site.id;
                  const isTransferring = transferringSiteId === site.id;
                  const isSameSite = site.id === selectedSiteId;

                  return (
                    <div
                      key={site.id}
                      onDragEnter={() => setDragOverSiteId(site.id)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverSiteId(site.id);
                      }}
                      onDragLeave={() => setDragOverSiteId(null)}
                      onDrop={async (event) => {
                        event.preventDefault();
                        setDragOverSiteId(null);
                        setDragging(false);
                        await requestTransferToSite(site.id);
                      }}
                      className={cn(
                        "rounded border bg-background p-3 transition-colors",
                        dragging && "border-dashed",
                        isSameSite && "border-amber-300 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/10",
                        isOver && "border-primary bg-primary/10 ring-2 ring-primary/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="truncate text-sm font-semibold">{siteLabel(site)}</div>
                            {isSameSite ? (
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                Same site
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isSameSite
                              ? "Reassign selected employees to a different foreman here"
                              : state.loaded
                                ? state.foremen.length
                                  ? `${state.foremen.length} foreman option${state.foremen.length === 1 ? "" : "s"}`
                                  : "No foreman assigned"
                                : "Foreman loads on hover/drop"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={state.loading}
                          onClick={() => void ensureForemenForSite(site.id)}
                        >
                          {state.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Load"}
                        </Button>
                      </div>

                      {state.loaded && state.foremen.length > 1 ? (
                        <div className="mt-3">
                          <Select
                            value={state.selectedForemanId}
                            onValueChange={(value) => setSiteForeman(site.id, value)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select foreman" />
                            </SelectTrigger>
                            <SelectContent>
                              {state.foremen.map((foreman) => (
                                <SelectItem key={foreman.id} value={foreman.id}>
                                  {foreman.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      {state.loaded && state.foremen.length === 1 ? (
                        <div className="mt-3 rounded bg-muted/50 px-2 py-1.5 text-xs">
                          {state.foremen[0].name}
                        </div>
                      ) : null}

                      <Button
                        type="button"
                        className="mt-3 w-full gap-2"
                        size="sm"
                        disabled={selectedTransferScans.length === 0 || state.loading || isTransferring}
                        onMouseEnter={() => void ensureForemenForSite(site.id)}
                        onClick={() => void requestTransferToSite(site.id)}
                      >
                        {isTransferring ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRightLeft className="h-4 w-4" />
                        )}
                        {isSameSite ? "Reassign Foreman" : "Transfer Here"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Select a source site to start transferring employees.
          </CardContent>
        </Card>
      )}

      {showTrashBin ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setIsOverBin(true);
          }}
          onDragEnter={() => setIsOverBin(true)}
          onDragLeave={() => setIsOverBin(false)}
          onDrop={(event) => void handleTrashDrop(event)}
          className={cn(
            "fixed bottom-6 right-6 z-50 flex flex-col items-center transition-all duration-300",
            isOverBin ? "scale-110" : "scale-100",
            isDroppedInBin && "animate-bounce",
          )}
        >
          <img
            src={binImage}
            alt="Trash bin"
            className="h-36 w-36 object-contain drop-shadow-2xl md:h-40 md:w-40"
          />
          <div className="mt-1 rounded-full border bg-background px-3 py-1 text-xs font-semibold shadow">
            {trashLabel}
          </div>
        </div>
      ) : null}

      <Sheet open={trashOpen} onOpenChange={setTrashOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <img src="/trash/bin-closed.png" alt="Trash bin" className="h-12 w-12 object-contain" />
              <div>
                <SheetTitle>Trash Bin</SheetTitle>
                <SheetDescription>
                  Deleted items stay here for 7 days before they are cleared automatically.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-auto px-4">
            {loadingTrash ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading trash...
              </div>
            ) : trashItems.length === 0 ? (
              <div className="rounded border border-dashed py-16 text-center text-sm text-muted-foreground">
                The bin is empty.
              </div>
            ) : (
              <div className="space-y-3">
                {trashItems.map((item) => (
                  <div key={item.id} className="rounded border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{item.label}</div>
                        {item.description ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">{item.description}</div>
                        ) : null}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {item.entityType}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      <span>
                        Deleted {new Date(item.deletedAt).toLocaleString("en-GB")}
                        {item.deletedByName ? ` by ${item.deletedByName}` : ""}
                      </span>
                      <span>Auto clears {new Date(item.expiresAt).toLocaleString("en-GB")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadTrash()}
              disabled={loadingTrash || clearingTrash}
            >
              {loadingTrash ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={trashItems.length === 0 || clearingTrash}
              onClick={() => setPendingAction({ type: "clear-trash", employeeCount: trashItems.length })}
            >
              {clearingTrash ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Clear Bin
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && cancelPendingAction()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "delete"
                ? "Move selected scans to trash?"
                : pendingAction?.type === "clear-trash"
                  ? "Clear the trash bin?"
                  : pendingAction?.sameSite
                    ? "Reassign selected employees to a different foreman?"
                    : "Transfer selected employees?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "delete"
                ? `This will move ${pendingAction.employeeCount} selected attendance scan${
                    pendingAction.employeeCount === 1 ? "" : "s"
                  } for ${selectedSiteName || "this site"} to the trash bin. Trash items auto-clear after 7 days.`
                : pendingAction?.type === "clear-trash"
                  ? `This will permanently clear ${pendingAction.employeeCount} item${
                      pendingAction.employeeCount === 1 ? "" : "s"
                    } from the trash bin.`
                : pendingAction?.sameSite
                  ? `This will reassign ${pendingAction.employeeCount} open scan${
                      pendingAction.employeeCount === 1 ? "" : "s"
                    } at ${selectedSiteName || "this site"} to foreman ${pendingAction.foremanName}.`
                : pendingAction
                  ? `This will transfer ${pendingAction.employeeCount} open scan${
                      pendingAction.employeeCount === 1 ? "" : "s"
                    } from ${selectedSiteName || "the source site"} to ${pendingAction.siteName} (foreman ${pendingAction.foremanName}).`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPendingAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={pendingAction?.type === "delete" || pendingAction?.type === "clear-trash" ? "destructive" : "default"}
              onClick={(event) => {
                event.preventDefault();
                void confirmPendingAction();
              }}
            >
              {pendingAction?.type === "delete"
                ? "Move to Trash"
                : pendingAction?.type === "clear-trash"
                  ? "Clear Bin"
                  : pendingAction?.sameSite
                    ? "Reassign"
                    : "Transfer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
