"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  CalendarPlus,
  Check,
  ChevronsUpDown,
  Loader2,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteOption {
  id: string;
  name: string;
  code: string | null;
}

interface ForemanOption {
  id: string;
  name: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  qrCodeValue: string | null;
}

export default function AdminManualScanPage() {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [foremen, setForemen] = useState<ForemanOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedForemanId, setSelectedForemanId] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [workDates, setWorkDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState("");
  const [reason, setReason] = useState("");

  const [siteOpen, setSiteOpen] = useState(false);
  const [foremanOpen, setForemanOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingForemen, setLoadingForemen] = useState(false);
  const [loadingScannedIds, setLoadingScannedIds] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scannedEmployeeIdsByDate, setScannedEmployeeIdsByDate] = useState<
    Record<string, string[]>
  >({});
  const [recentScans, setRecentScans] = useState<any[]>([]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [sitesRes, employeesRes] = await Promise.all([
          fetch("/api/app/admin/sites?take=1500"),
          fetch("/api/employees?show=active"),
        ]);

        if (sitesRes.ok) {
          const sitesData = await sitesRes.json();
          setSites(
            (sitesData.sites ?? sitesData ?? []).map((site: any) => ({
              id: site.id,
              name: site.name,
              code: site.code ?? null,
            })),
          );
        }

        if (employeesRes.ok) {
          const employeeData = await employeesRes.json();
          setEmployees(
            (employeeData.employees ?? employeeData ?? []).map(
              (employee: any) => ({
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                qrCodeValue: employee.qrCodeValue ?? employee.code ?? null,
              }),
            ),
          );
        }
      } catch {
        toast.error("Failed to load options");
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, []);

  useEffect(() => {
    if (workDates.length === 0) {
      setScannedEmployeeIdsByDate({});
      return;
    }

    async function loadScannedIds() {
      setLoadingScannedIds(true);
      try {
        const entries = await Promise.all(
          workDates.map(async (date) => {
            const res = await fetch(
              `/api/admin/attendance-scans/manual?date=${date}`,
            );
            if (!res.ok) return [date, []] as const;
            const data = await res.json();
            return [date, data.scannedEmployeeIds ?? []] as const;
          }),
        );
        setScannedEmployeeIdsByDate(Object.fromEntries(entries));
      } catch {
        setScannedEmployeeIdsByDate({});
      } finally {
        setLoadingScannedIds(false);
      }
    }

    loadScannedIds();
  }, [workDates]);

  useEffect(() => {
    if (!selectedSiteId) {
      setForemen([]);
      setSelectedForemanId("");
      return;
    }

    async function loadForemen() {
      setLoadingForemen(true);
      try {
        const res = await fetch(
          `/api/app/admin/sites/${selectedSiteId}/foremen`,
        );
        if (res.ok) {
          const data = await res.json();
          const assignments = data.assignments ?? data.foremen ?? data ?? [];
          const foremanList = (
            Array.isArray(assignments) ? assignments : []
          ).map((foreman: any) => ({
            id: foreman.foremanId ?? foreman.id,
            name: foreman.foremanName ?? foreman.name ?? "Unknown",
          }));
          setForemen(foremanList);
          if (foremanList.length === 1) {
            setSelectedForemanId(foremanList[0].id);
          }
        }
      } catch {
        toast.error("Failed to load foremen for site");
      } finally {
        setLoadingForemen(false);
      }
    }

    loadForemen();
  }, [selectedSiteId]);

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const todayStr = todayUtc.toISOString().split("T")[0];

  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const selectedForeman = foremen.find(
    (foreman) => foreman.id === selectedForemanId,
  );
  const selectedEmployees = employees.filter((employee) =>
    selectedEmployeeIds.includes(employee.id),
  );
  const scannedEmployeeIds = useMemo(
    () => new Set(Object.values(scannedEmployeeIdsByDate).flat()),
    [scannedEmployeeIdsByDate],
  );
  const availableEmployees =
    workDates.length > 0
      ? employees.filter((employee) =>
          workDates.some(
            (date) =>
              !(scannedEmployeeIdsByDate[date] ?? []).includes(employee.id),
          ),
        )
      : employees;

  function addWorkDate() {
    if (!dateInput) return;
    if (workDates.includes(dateInput)) {
      setDateInput("");
      return;
    }
    setWorkDates((prev) => [...prev, dateInput].sort());
    setDateInput("");
  }

  function toggleEmployee(employeeId: string) {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId],
    );
  }

  const handleSubmit = async () => {
    if (!selectedSiteId) return toast.error("Please select a site");
    if (!selectedForemanId) return toast.error("Please select a foreman");
    if (selectedEmployeeIds.length === 0) {
      return toast.error("Please select at least one employee");
    }
    if (workDates.length === 0) {
      return toast.error("Please select at least one date");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/attendance-scans/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSiteId,
          foremanId: selectedForemanId,
          employeeIds: selectedEmployeeIds,
          workDates,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to create scans");
      }

      const createdScans = (data.scans ?? [data.scan]).filter(Boolean);
      const createdCount = createdScans.length;
      const skippedCount = data.skipped?.length ?? 0;
      toast.success(
        skippedCount > 0
          ? `${createdCount} scan${createdCount === 1 ? "" : "s"} created, ${skippedCount} skipped`
          : `${createdCount} scan${createdCount === 1 ? "" : "s"} created`,
      );

      setRecentScans((prev) => [...createdScans, ...prev].slice(0, 10));
      setScannedEmployeeIdsByDate((prev) => {
        const next = { ...prev };
        for (const scan of createdScans) {
          const date = scan.workDate;
          const employeeId = scan.employee?.id;
          if (!date || !employeeId) continue;
          next[date] = Array.from(new Set([...(next[date] ?? []), employeeId]));
        }
        return next;
      });
      setSelectedEmployeeIds([]);
      setReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create scans");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingOptions) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-2">
      <div>
        <h1 className="text-2xl font-bold">Manual Employee Scan</h1>
        <p className="text-muted-foreground">
          Create attendance scans for multiple employees across one or more
          dates. Use this when a foreman forgot to scan employees.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            New Manual Scans
          </CardTitle>
          <CardDescription>
            Select the site, foreman, dates, and employees to create scans in
            batch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Site *</Label>
            <Popover open={siteOpen} onOpenChange={setSiteOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedSite
                    ? `${selectedSite.code ? selectedSite.code + " - " : ""}${selectedSite.name}`
                    : "Select a site..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search sites..." />
                  <CommandList>
                    <CommandEmpty>No sites found.</CommandEmpty>
                    <CommandGroup>
                      {sites.map((site) => (
                        <CommandItem
                          key={site.id}
                          value={`${site.code ?? ""} ${site.name}`}
                          onSelect={() => {
                            setSelectedSiteId(site.id);
                            setSelectedForemanId("");
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
                          {site.code ? `${site.code} - ` : ""}
                          {site.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Foreman *</Label>
            {loadingForemen ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading foremen...
              </div>
            ) : foremen.length === 0 && selectedSiteId ? (
              <p className="text-sm text-muted-foreground">
                No foremen assigned to this site.
              </p>
            ) : (
              <Popover open={foremanOpen} onOpenChange={setForemanOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={!selectedSiteId || foremen.length === 0}
                  >
                    {selectedForeman
                      ? selectedForeman.name
                      : "Select foreman..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search foremen..." />
                    <CommandList>
                      <CommandEmpty>No foremen found.</CommandEmpty>
                      <CommandGroup>
                        {foremen.map((foreman) => (
                          <CommandItem
                            key={foreman.id}
                            value={foreman.name}
                            onSelect={() => {
                              setSelectedForemanId(foreman.id);
                              setForemanOpen(false);
                            }}
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
            )}
          </div>

          <div className="space-y-2">
            <Label>Work Dates *</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                max={todayStr}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addWorkDate}
                disabled={!dateInput}
                className="gap-2"
              >
                <CalendarPlus className="h-4 w-4" />
                Add
              </Button>
            </div>
            {workDates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {workDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    onClick={() =>
                      setWorkDates((prev) => prev.filter((d) => d !== date))
                    }
                    className="inline-flex items-center gap-1 rounded border bg-muted px-2 py-1 text-xs"
                  >
                    {date}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Add one or more previous/current dates. Existing scans will be
              skipped automatically.
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              Employees *
              {workDates.length > 0 && !loadingScannedIds && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({availableEmployees.length} available
                  {scannedEmployeeIds.size > 0 &&
                    `, ${scannedEmployeeIds.size} already scanned on selected dates`}
                  )
                </span>
              )}
              {loadingScannedIds && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (loading...)
                </span>
              )}
            </Label>
            <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedEmployees.length > 0
                    ? `${selectedEmployees.length} employee${selectedEmployees.length === 1 ? "" : "s"} selected`
                    : "Select employees..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search employees..." />
                  <CommandList>
                    <CommandEmpty>No employees found.</CommandEmpty>
                    <CommandGroup>
                      {availableEmployees.map((employee) => (
                        <CommandItem
                          key={employee.id}
                          value={`${employee.firstName} ${employee.lastName} ${employee.qrCodeValue ?? ""}`}
                          onSelect={() => toggleEmployee(employee.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedEmployeeIds.includes(employee.id)
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {employee.firstName} {employee.lastName}
                          {employee.qrCodeValue && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({employee.qrCodeValue})
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedEmployees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedEmployees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => toggleEmployee(employee.id)}
                    className="inline-flex items-center gap-1 rounded border bg-muted px-2 py-1 text-xs"
                  >
                    {employee.firstName} {employee.lastName}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Foreman forgot to scan the employees"
              rows={2}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !selectedSiteId ||
              !selectedForemanId ||
              selectedEmployeeIds.length === 0 ||
              workDates.length === 0
            }
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Scans...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create {selectedEmployeeIds.length * workDates.length || ""}{" "}
                Manual Scan
                {selectedEmployeeIds.length * workDates.length === 1 ? "" : "s"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {recentScans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Created Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentScans.map((scan, index) => (
                <div
                  key={scan?.id ?? index}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {scan?.employee?.fullName ?? "Unknown"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {scan?.site ?? "Unknown site"} -{" "}
                      {scan?.foreman ?? "Unknown foreman"} - {scan?.workDate}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-green-600">
                    Created
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
