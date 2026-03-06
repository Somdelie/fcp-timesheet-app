"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  ArrowRightLeft,
  Search,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";
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
  direction: "IN" | "OUT";
  dayRate: string;
  scanType: string;
  isTransferred: boolean;
  transferredFromSiteId: string | null;
  transferredAt: string | null;
}

interface SiteOption {
  id: string;
  name: string;
}

interface ForemanOption {
  id: string;
  name: string;
}

export default function AdminTransferEmployeePage() {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [siteOpen, setSiteOpen] = useState(false);
  const [scans, setScans] = useState<SiteScan[]>([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [scannedInCount, setScannedInCount] = useState(0);
  const [scannedOutCount, setScannedOutCount] = useState(0);

  // Transfer dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedScan, setSelectedScan] = useState<SiteScan | null>(null);
  const [destinationSiteId, setDestinationSiteId] = useState<string>("");
  const [destSiteOpen, setDestSiteOpen] = useState(false);
  const [destForemen, setDestForemen] = useState<ForemanOption[]>([]);
  const [selectedForemanId, setSelectedForemanId] = useState<string>("");
  const [foremanOpen, setForemanOpen] = useState(false);
  const [loadingForemen, setLoadingForemen] = useState(false);
  const [transferReason, setTransferReason] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Load sites
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/attendance-scans");
        if (!res.ok) throw new Error("Failed to load sites");
        const data = await res.json();
        setSites(data.sites || []);
      } catch (err: any) {
        toast.error(err.message || "Failed to load sites");
      }
    })();
  }, []);

  // Load scans for selected site
  const loadScans = useCallback(async (siteId: string) => {
    if (!siteId) return;
    setLoadingScans(true);
    try {
      const res = await fetch(
        `/api/app/supervisor/sites/${encodeURIComponent(siteId)}/scans-today`,
      );
      if (!res.ok) throw new Error("Failed to load today's scans");
      const data = await res.json();
      setScans(data.scans || []);
      setScannedInCount(data.scannedInCount ?? 0);
      setScannedOutCount(data.scannedOutCount ?? 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load scans");
      setScans([]);
    } finally {
      setLoadingScans(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSiteId) {
      loadScans(selectedSiteId);
    } else {
      setScans([]);
      setScannedInCount(0);
      setScannedOutCount(0);
    }
  }, [selectedSiteId, loadScans]);

  // Load foremen when destination site changes
  useEffect(() => {
    if (!destinationSiteId) {
      setDestForemen([]);
      setSelectedForemanId("");
      return;
    }
    (async () => {
      setLoadingForemen(true);
      setSelectedForemanId("");
      try {
        const res = await fetch(
          `/api/app/supervisor/sites/${encodeURIComponent(destinationSiteId)}/scans-today`,
        );
        if (!res.ok) throw new Error("Failed to load foremen");
        const data = await res.json();
        const foremen: ForemanOption[] = data.foremen || [];
        setDestForemen(foremen);
        // Auto-select if only one foreman
        if (foremen.length === 1) {
          setSelectedForemanId(foremen[0].id);
        }
      } catch {
        setDestForemen([]);
      } finally {
        setLoadingForemen(false);
      }
    })();
  }, [destinationSiteId]);

  // Filter scans by search
  const filteredScans = scans.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.employeeName.toLowerCase().includes(q) ||
      s.employeeCode.toLowerCase().includes(q)
    );
  });

  const scannedIn = filteredScans.filter((s) => !s.isScannedOut);
  const scannedOut = filteredScans.filter((s) => s.isScannedOut);

  // Open transfer dialog
  const openTransfer = (scan: SiteScan) => {
    setSelectedScan(scan);
    setDestinationSiteId("");
    setSelectedForemanId("");
    setDestForemen([]);
    setTransferReason("");
    setTransferDialogOpen(true);
  };

  // Perform transfer
  const doTransfer = async () => {
    if (
      !selectedScan ||
      !destinationSiteId ||
      !selectedSiteId ||
      !selectedForemanId
    )
      return;
    setTransferring(true);
    try {
      const res = await fetch("/api/app/supervisor/transfer-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedScan.employeeId,
          fromSiteId: selectedSiteId,
          toSiteId: destinationSiteId,
          toForemanId: selectedForemanId,
          reason: transferReason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Transfer failed");
      }
      const data = await res.json();
      toast.success(data.message || "Transfer successful!");
      setTransferDialogOpen(false);
      setSelectedScan(null);
      // Refresh scans
      await loadScans(selectedSiteId);
    } catch (err: any) {
      toast.error(err.message || "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  const selectedSiteName =
    sites.find((s) => s.id === selectedSiteId)?.name ?? "";
  const destinationSiteName =
    sites.find((s) => s.id === destinationSiteId)?.name ?? "";
  const selectedForemanName =
    destForemen.find((f) => f.id === selectedForemanId)?.name ?? "";
  const destinationSites = sites.filter((s) => s.id !== selectedSiteId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Employee
          </CardTitle>
          <CardDescription>
            Transfer employees between sites. Select a source site, then
            transfer scanned-in employees to a different site. Transferred
            employees can be scanned out at their new site.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Site selector + Stats */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
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
                    {selectedSiteId
                      ? (sites.find((s) => s.id === selectedSiteId)?.name ??
                        "Select a site...")
                      : "Select a site..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search sites…" />
                    <CommandList>
                      <CommandEmpty>No sites found.</CommandEmpty>
                      <CommandGroup>
                        {sites.map((site) => (
                          <CommandItem
                            key={site.id}
                            value={site.id}
                            keywords={[site.name]}
                            onSelect={() => {
                              setSelectedSiteId(
                                site.id === selectedSiteId ? "" : site.id,
                              );
                              setSiteOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSiteId === site.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {site.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Search Employees
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or code..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {selectedSiteId && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded border p-3 text-center">
                <div className="text-2xl font-black text-emerald-600">
                  {scannedInCount}
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  Scanned In
                </div>
              </div>
              <div className="rounded border p-3 text-center">
                <div className="text-2xl font-black text-slate-500">
                  {scannedOutCount}
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  Scanned Out
                </div>
              </div>
              <div className="rounded border p-3 text-center">
                <div className="text-2xl font-black text-blue-600">
                  {scans.length}
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  Total
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanned-in employees (transferable) */}
      {selectedSiteId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employees on Site ({scannedIn.length})
            </CardTitle>
            <CardDescription>
              These employees are currently scanned in and can be transferred.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingScans ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : scannedIn.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No employees currently scanned in at this site.
              </div>
            ) : (
              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="border">Employee</TableHead>
                      <TableHead className="border">Code</TableHead>
                      <TableHead className="border">Scanned In</TableHead>
                      <TableHead className="border">Day Rate</TableHead>
                      <TableHead className="border">Status</TableHead>
                      <TableHead className="border text-right">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scannedIn.map((scan) => (
                      <TableRow key={scan.id}>
                        <TableCell className="border font-medium">
                          {scan.employeeName}
                        </TableCell>
                        <TableCell className="border text-sm text-muted-foreground">
                          {scan.employeeCode}
                        </TableCell>
                        <TableCell className="border">
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {new Date(scan.scannedAt).toLocaleTimeString(
                              "en-GB",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="border text-sm">
                          R{scan.dayRate}
                        </TableCell>
                        <TableCell className="border">
                          {scan.isTransferred ? (
                            <Badge variant="secondary" className="text-xs">
                              ↗ Transferred here
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-emerald-600 border-emerald-300"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              On Site
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="border text-right">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openTransfer(scan)}
                            className="gap-1"
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                            Transfer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scanned-out employees */}
      {selectedSiteId && scannedOut.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground">
              Scanned Out ({scannedOut.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="border">Employee</TableHead>
                    <TableHead className="border">Code</TableHead>
                    <TableHead className="border">Scanned In</TableHead>
                    <TableHead className="border">Scanned Out</TableHead>
                    <TableHead className="border">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scannedOut.map((scan) => (
                    <TableRow key={scan.id} className="opacity-60">
                      <TableCell className="border font-medium">
                        {scan.employeeName}
                      </TableCell>
                      <TableCell className="border text-sm text-muted-foreground">
                        {scan.employeeCode}
                      </TableCell>
                      <TableCell className="border text-sm">
                        {new Date(scan.scannedAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="border text-sm">
                        {scan.scannedOutAt
                          ? new Date(scan.scannedOutAt).toLocaleTimeString(
                              "en-GB",
                              { hour: "2-digit", minute: "2-digit" },
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="border">
                        <Badge variant="secondary" className="text-xs">
                          <XCircle className="h-3 w-3 mr-1" />
                          Scanned Out
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transfer Dialog */}
      <Dialog
        open={transferDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTransferDialogOpen(false);
            setSelectedScan(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Transfer Employee
            </DialogTitle>
            <DialogDescription>
              Move this employee from <strong>{selectedSiteName}</strong> to
              another site.
            </DialogDescription>
          </DialogHeader>

          {selectedScan && (
            <div className="space-y-4">
              {/* Employee info */}
              <div className="rounded border bg-muted/50 p-3">
                <div className="font-semibold">{selectedScan.employeeName}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedScan.employeeCode} • Scanned in:{" "}
                  {new Date(selectedScan.scannedAt).toLocaleTimeString(
                    "en-GB",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                </div>
              </div>

              {/* Destination site */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Transfer to:
                </label>
                <Popover open={destSiteOpen} onOpenChange={setDestSiteOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={destSiteOpen}
                      className="w-full justify-between font-normal"
                    >
                      {destinationSiteId
                        ? (destinationSites.find(
                            (s) => s.id === destinationSiteId,
                          )?.name ?? "Select destination site...")
                        : "Select destination site..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search sites…" />
                      <CommandList>
                        <CommandEmpty>No sites found.</CommandEmpty>
                        <CommandGroup>
                          {destinationSites.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={s.id}
                              keywords={[s.name]}
                              onSelect={() => {
                                setDestinationSiteId(
                                  s.id === destinationSiteId ? "" : s.id,
                                );
                                setDestSiteOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  destinationSiteId === s.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Foreman at destination site */}
              {destinationSiteId && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Foreman at destination:
                  </label>
                  {loadingForemen ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading foremen...
                    </div>
                  ) : destForemen.length === 0 ? (
                    <div className="text-sm text-destructive py-2">
                      No foreman assigned to this site
                    </div>
                  ) : destForemen.length === 1 ? (
                    <div className="rounded border bg-muted/50 p-2 text-sm">
                      {destForemen[0].name}
                    </div>
                  ) : (
                    <Popover open={foremanOpen} onOpenChange={setForemanOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={foremanOpen}
                          className="w-full justify-between font-normal"
                        >
                          {selectedForemanId
                            ? (destForemen.find(
                                (f) => f.id === selectedForemanId,
                              )?.name ?? "Select foreman...")
                            : "Select foreman..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search foremen\u2026" />
                          <CommandList>
                            <CommandEmpty>No foremen found.</CommandEmpty>
                            <CommandGroup>
                              {destForemen.map((f) => (
                                <CommandItem
                                  key={f.id}
                                  value={f.id}
                                  keywords={[f.name]}
                                  onSelect={() => {
                                    setSelectedForemanId(
                                      f.id === selectedForemanId ? "" : f.id,
                                    );
                                    setForemanOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedForemanId === f.id
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {f.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Reason (optional):
                </label>
                <Textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Site needs more workers"
                  rows={2}
                />
              </div>

              {/* Summary */}
              {destinationSiteId && selectedForemanId && (
                <div className="rounded border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 text-sm">
                  <strong>{selectedScan.employeeName}</strong> will be
                  transferred from <strong>{selectedSiteName}</strong> to{" "}
                  <strong>{destinationSiteName}</strong> under foreman{" "}
                  <strong>{selectedForemanName}</strong>. They will be able to
                  clock out at the new site.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferDialogOpen(false)}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button
              onClick={doTransfer}
              disabled={
                !destinationSiteId || !selectedForemanId || transferring
              }
            >
              {transferring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Confirm Transfer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
