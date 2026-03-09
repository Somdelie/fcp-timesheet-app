"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Loader2,
  MapPin,
  QrCode,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Scan {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  siteId: string;
  siteName: string;
  foremanId: string;
  foremanName: string;
  supervisorId: string | null;
  supervisorName: string | null;
  workDateISO: string;
  scannedAtISO: string;
  scanType: "REGULAR" | "MANUAL";
  overtimeType: "NONE" | "HALF_DAY" | "FULL_DAY";
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

interface FilterOption {
  id: string;
  name: string;
}

function groupScansByDate(scans: Scan[]) {
  const groups: Map<string, Scan[]> = new Map();

  for (const scan of scans) {
    const dateKey = scan.workDateISO.split("T")[0];
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(scan);
  }

  // Sort by date descending
  const sortedEntries = Array.from(groups.entries()).sort(
    (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime(),
  );

  return sortedEntries.map(([date, scans]) => {
    const d = new Date(date + "T00:00:00Z");
    const label = d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return { date, label, scans };
  });
}

export default function AdminAttendanceScansPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<FilterOption[]>([]);
  const [foremen, setForemen] = useState<FilterOption[]>([]);
  const [supervisors, setSupervisors] = useState<FilterOption[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedForemanId, setSelectedForemanId] = useState<string>("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");
  const [siteOpen, setSiteOpen] = useState(false);
  const [foremanOpen, setForemanOpen] = useState(false);
  const [supervisorOpen, setSupervisorOpen] = useState(false);

  const loadScans = async (
    siteId?: string,
    foremanId?: string,
    supervisorId?: string,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      if (foremanId) params.set("foremanId", foremanId);
      if (supervisorId) params.set("supervisorId", supervisorId);
      const url = `/api/admin/attendance-scans${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Failed to load scans");
      }
      const data = await res.json();
      setScans(data.scans || []);
      // Only update filter options on initial load (no filters)
      if (!siteId && !foremanId && !supervisorId) {
        setSites(data.sites || []);
        setForemen(data.foremen || []);
        setSupervisors(data.supervisors || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load scans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScans();
  }, []);

  const handleSiteChange = (value: string) => {
    const newValue = value === selectedSiteId ? "" : value;
    setSelectedSiteId(newValue);
    setSiteOpen(false);
    loadScans(newValue, selectedForemanId, selectedSupervisorId);
  };

  const handleForemanChange = (value: string) => {
    const newValue = value === selectedForemanId ? "" : value;
    setSelectedForemanId(newValue);
    setForemanOpen(false);
    loadScans(selectedSiteId, newValue, selectedSupervisorId);
  };

  const handleSupervisorChange = (value: string) => {
    const newValue = value === selectedSupervisorId ? "" : value;
    setSelectedSupervisorId(newValue);
    setSupervisorOpen(false);
    loadScans(selectedSiteId, selectedForemanId, newValue);
  };

  const groupedScans = groupScansByDate(scans);

  // Pagination state per tab (date)
  const [pageIndexMap, setPageIndexMap] = useState<Record<string, number>>({});
  const [pageSize, setPageSize] = useState(20);
  const [activeTab, setActiveTab] = useState<string>("");

  // Set default active tab when data loads
  useEffect(() => {
    if (groupedScans.length > 0 && !activeTab) {
      setActiveTab(groupedScans[0].date);
    }
  }, [groupedScans, activeTab]);

  // Reset pagination when filters change
  useEffect(() => {
    setPageIndexMap({});
    setActiveTab("");
  }, [scans]);

  const getPageIndex = (date: string) => pageIndexMap[date] ?? 0;
  const setPageIndex = (date: string, idx: number) =>
    setPageIndexMap((prev) => ({ ...prev, [date]: idx }));

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance Scans</CardTitle>
          <CardDescription>
            View all attendance scans with location data (last 7 days)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-4">
            <Popover open={siteOpen} onOpenChange={setSiteOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={siteOpen}
                  className="w-52 justify-between font-normal"
                >
                  {selectedSiteId
                    ? (sites.find((s) => s.id === selectedSiteId)?.name ??
                      "All Sites")
                    : "All Sites"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search sites…" />
                  <CommandList>
                    <CommandEmpty>No sites found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all_sites__"
                        keywords={["all", "sites"]}
                        onSelect={() => {
                          setSelectedSiteId("");
                          setSiteOpen(false);
                          loadScans(
                            "",
                            selectedForemanId,
                            selectedSupervisorId,
                          );
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            !selectedSiteId ? "opacity-100" : "opacity-0",
                          )}
                        />
                        All Sites
                      </CommandItem>
                      {sites.map((site) => (
                        <CommandItem
                          key={site.id}
                          value={site.id}
                          keywords={[site.name]}
                          onSelect={() => handleSiteChange(site.id)}
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

            <Popover open={foremanOpen} onOpenChange={setForemanOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={foremanOpen}
                  className="w-52 justify-between font-normal"
                >
                  {selectedForemanId
                    ? (foremen.find((f) => f.id === selectedForemanId)?.name ??
                      "All Foremen")
                    : "All Foremen"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search foremen…" />
                  <CommandList>
                    <CommandEmpty>No foremen found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all_foremen__"
                        keywords={["all", "foremen"]}
                        onSelect={() => {
                          setSelectedForemanId("");
                          setForemanOpen(false);
                          loadScans(selectedSiteId, "", selectedSupervisorId);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            !selectedForemanId ? "opacity-100" : "opacity-0",
                          )}
                        />
                        All Foremen
                      </CommandItem>
                      {foremen.map((foreman) => (
                        <CommandItem
                          key={foreman.id}
                          value={foreman.id}
                          keywords={[foreman.name]}
                          onSelect={() => handleForemanChange(foreman.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedForemanId === foreman.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {foreman.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Popover open={supervisorOpen} onOpenChange={setSupervisorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={supervisorOpen}
                  className="w-52 justify-between font-normal"
                >
                  {selectedSupervisorId
                    ? (supervisors.find((s) => s.id === selectedSupervisorId)
                        ?.name ?? "All Supervisors")
                    : "All Supervisors"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search supervisors…" />
                  <CommandList>
                    <CommandEmpty>No supervisors found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all_supervisors__"
                        keywords={["all", "supervisors"]}
                        onSelect={() => {
                          setSelectedSupervisorId("");
                          setSupervisorOpen(false);
                          loadScans(selectedSiteId, selectedForemanId, "");
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            !selectedSupervisorId ? "opacity-100" : "opacity-0",
                          )}
                        />
                        All Supervisors
                      </CommandItem>
                      {supervisors.map((supervisor) => (
                        <CommandItem
                          key={supervisor.id}
                          value={supervisor.id}
                          keywords={[supervisor.name]}
                          onSelect={() => handleSupervisorChange(supervisor.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSupervisorId === supervisor.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {supervisor.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : scans.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No scans found for the selected filters
            </div>
          ) : (
            <Tabs
              value={activeTab || groupedScans[0]?.date}
              onValueChange={(v) => setActiveTab(v)}
            >
              <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
                {groupedScans.map((group) => {
                  const shortLabel = new Date(
                    group.date + "T00:00:00Z",
                  ).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  });
                  return (
                    <TabsTrigger key={group.date} value={group.date}>
                      {shortLabel}
                      <Badge
                        variant="secondary"
                        className="ml-1.5 h-5 px-1.5 text-xs"
                      >
                        {group.scans.length}
                      </Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {groupedScans.map((group) => {
                const pi = getPageIndex(group.date);
                const totalPages = Math.max(
                  1,
                  Math.ceil(group.scans.length / pageSize),
                );
                const pageScans = group.scans.slice(
                  pi * pageSize,
                  (pi + 1) * pageSize,
                );

                return (
                  <TabsContent key={group.date} value={group.date}>
                    <h2 className="mb-3 text-lg font-semibold">
                      {group.label}
                    </h2>
                    <div className="rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="border-x">Employee</TableHead>
                            <TableHead className="border-x">Site</TableHead>
                            <TableHead className="border-x">Foreman</TableHead>
                            <TableHead className="border-x">
                              Scanned At
                            </TableHead>
                            <TableHead className="border-x">Type</TableHead>
                            <TableHead className="border-x">Location</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageScans.map((scan) => (
                            <TableRow key={scan.id}>
                              <TableCell className="border-x">
                                <div>
                                  <div className="font-medium">
                                    {scan.employeeName}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {scan.employeeCode}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="border-x">
                                {scan.siteName}
                              </TableCell>
                              <TableCell className="border-x">
                                {scan.foremanName}
                              </TableCell>
                              <TableCell className="border-x">
                                {new Date(scan.scannedAtISO).toLocaleTimeString(
                                  "en-GB",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </TableCell>
                              <TableCell className="border-x">
                                {scan.scanType === "MANUAL" ? (
                                  <Badge variant="outline" className="gap-1">
                                    <UserPlus className="h-3 w-3" />
                                    Manual
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="gap-1">
                                    <QrCode className="h-3 w-3" />
                                    QR
                                  </Badge>
                                )}
                                {scan.overtimeType !== "NONE" && (
                                  <Badge variant="default" className="ml-1">
                                    {scan.overtimeType === "HALF_DAY"
                                      ? "½ OT"
                                      : "Full OT"}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="border-x">
                                {scan.latitude && scan.longitude ? (
                                  <div className="space-y-1">
                                    {scan.address && (
                                      <div className="max-w-xs truncate text-sm">
                                        {scan.address}
                                      </div>
                                    )}
                                    <a
                                      href={`https://www.google.com/maps?q=${scan.latitude},${scan.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      <MapPin className="h-3 w-3" />
                                      View map
                                    </a>
                                  </div>
                                ) : scan.address ? (
                                  <div className="flex items-center gap-1 text-sm">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    <span className="max-w-xs truncate">
                                      {scan.address}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    No location
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t px-4 py-3 mt-2 rounded-b-md bg-muted/60">
                      <div className="hidden text-sm text-muted-foreground lg:block">
                        Showing {pi * pageSize + 1} to{" "}
                        {Math.min((pi + 1) * pageSize, group.scans.length)} of{" "}
                        {group.scans.length} scans
                      </div>
                      <div className="flex w-full items-center gap-4 lg:w-fit lg:gap-8">
                        <div className="hidden items-center gap-2 lg:flex">
                          <span className="text-sm font-medium">
                            Rows per page
                          </span>
                          <Select
                            value={String(pageSize)}
                            onValueChange={(v) => {
                              setPageSize(Number(v));
                              setPageIndexMap({});
                            }}
                          >
                            <SelectTrigger className="h-8 w-20">
                              <SelectValue placeholder={pageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                              {[10, 20, 50, 100].map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                  {size}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex w-fit items-center justify-center text-sm font-medium">
                          Page {pi + 1} of {totalPages}
                        </div>
                        <div className="ml-auto flex items-center gap-2 lg:ml-0">
                          <Button
                            variant="outline"
                            size="icon"
                            className="hidden h-8 w-8 lg:flex"
                            onClick={() => setPageIndex(group.date, 0)}
                            disabled={pi === 0}
                          >
                            <span className="sr-only">Go to first page</span>
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setPageIndex(group.date, Math.max(0, pi - 1))
                            }
                            disabled={pi === 0}
                          >
                            <span className="sr-only">Previous page</span>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setPageIndex(
                                group.date,
                                Math.min(totalPages - 1, pi + 1),
                              )
                            }
                            disabled={pi >= totalPages - 1}
                          >
                            <span className="sr-only">Next page</span>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="hidden h-8 w-8 lg:flex"
                            onClick={() =>
                              setPageIndex(group.date, totalPages - 1)
                            }
                            disabled={pi >= totalPages - 1}
                          >
                            <span className="sr-only">Go to last page</span>
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
