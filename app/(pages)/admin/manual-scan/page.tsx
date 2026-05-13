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
import { Check, ChevronsUpDown, Loader2, UserPlus } from "lucide-react";
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
  // Options
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [foremen, setForemen] = useState<ForemanOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  // Selected values
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedForemanId, setSelectedForemanId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [reason, setReason] = useState("");

  // Combobox open states
  const [siteOpen, setSiteOpen] = useState(false);
  const [foremanOpen, setForemanOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);

  // Loading states
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingForemen, setLoadingForemen] = useState(false);
  const [loadingScannedIds, setLoadingScannedIds] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Already-scanned employee IDs for the selected date
  const [scannedEmployeeIds, setScannedEmployeeIds] = useState<Set<string>>(
    new Set(),
  );

  // Recent scans
  const [recentScans, setRecentScans] = useState<any[]>([]);

  // Load sites and employees on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        const [sitesRes, employeesRes] = await Promise.all([
          fetch("/api/app/admin/sites?take=1500"),
          fetch("/api/employees?show=active"),
        ]);

        if (sitesRes.ok) {
          const sitesData = await sitesRes.json();
          const siteList = (sitesData.sites ?? sitesData ?? []).map(
            (s: any) => ({
              id: s.id,
              name: s.name,
              code: s.code ?? null,
            }),
          );
          setSites(siteList);
        }

        if (employeesRes.ok) {
          const empData = await employeesRes.json();
          const empList = (empData.employees ?? empData ?? []).map(
            (e: any) => ({
              id: e.id,
              firstName: e.firstName,
              lastName: e.lastName,
              qrCodeValue: e.qrCodeValue ?? e.code ?? null,
            }),
          );
          setEmployees(empList);
        }
      } catch (err: any) {
        toast.error("Failed to load options");
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, []);

  // Load scanned employee IDs when date changes
  useEffect(() => {
    if (!workDate) {
      setScannedEmployeeIds(new Set());
      return;
    }

    async function loadScannedIds() {
      setLoadingScannedIds(true);
      try {
        const res = await fetch(
          `/api/admin/attendance-scans/manual?date=${workDate}`,
        );
        if (res.ok) {
          const data = await res.json();
          setScannedEmployeeIds(new Set(data.scannedEmployeeIds ?? []));
        }
      } catch {
        // silently fail – just show all employees
        setScannedEmployeeIds(new Set());
      } finally {
        setLoadingScannedIds(false);
      }
    }

    loadScannedIds();
  }, [workDate]);

  // Load foremen when site changes
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
          ).map((f: any) => ({
            id: f.foremanId ?? f.id,
            name: f.foremanName ?? f.name ?? "Unknown",
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

  const handleSubmit = async () => {
    if (!selectedSiteId) return toast.error("Please select a site");
    if (!selectedForemanId) return toast.error("Please select a foreman");
    if (!selectedEmployeeId) return toast.error("Please select an employee");
    if (!workDate) return toast.error("Please select a date");

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/attendance-scans/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSiteId,
          foremanId: selectedForemanId,
          employeeId: selectedEmployeeId,
          workDate,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to create scan");
      }

      toast.success(
        `Scan created for ${data.scan?.employee?.fullName ?? "employee"} on ${workDate}`,
      );

      setRecentScans((prev) => [data.scan, ...prev].slice(0, 10));

      // Add this employee to the scanned set so they disappear from the list
      setScannedEmployeeIds((prev) => new Set([...prev, selectedEmployeeId]));

      // Reset employee and reason for quick re-use
      setSelectedEmployeeId("");
      setReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create scan");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSite = sites.find((s) => s.id === selectedSiteId);
  const selectedForeman = foremen.find((f) => f.id === selectedForemanId);
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  // Filter out employees who already have a scan for the selected date
  const availableEmployees = workDate
    ? employees.filter((e) => !scannedEmployeeIds.has(e.id))
    : employees;

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const minDate = new Date(todayUtc);
  minDate.setUTCDate(minDate.getUTCDate() - 6);
  const todayStr = todayUtc.toISOString().split("T")[0];
  const minDateStr = minDate.toISOString().split("T")[0];

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
          Create an attendance scan for an employee on a previous or current
          day. Use this when a foreman forgot to scan an employee.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            New Manual Scan
          </CardTitle>
          <CardDescription>
            Select the site, foreman, employee, and date to create the scan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Site */}
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

          {/* Foreman */}
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
                        {foremen.map((f) => (
                          <CommandItem
                            key={f.id}
                            value={f.name}
                            onSelect={() => {
                              setSelectedForemanId(f.id);
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

          {/* Work Date — placed before Employee so scanned IDs load first */}
          <div className="space-y-2">
            <Label>Work Date *</Label>
            <Input
              type="date"
              value={workDate}
              onChange={(e) => {
                setWorkDate(e.target.value);
                setSelectedEmployeeId("");
              }}
              min={minDateStr}
              max={todayStr}
            />
            <p className="text-xs text-muted-foreground">
              Select a date within the last 7 days ({minDateStr} to {todayStr}).
              Employees already scanned on this date will be hidden.
            </p>
          </div>

          {/* Employee */}
          <div className="space-y-2">
            <Label>
              Employee *
              {workDate && !loadingScannedIds && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({availableEmployees.length} available
                  {scannedEmployeeIds.size > 0 &&
                    `, ${scannedEmployeeIds.size} already scanned`}
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
                  {selectedEmployee
                    ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                    : "Select an employee..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search employees..." />
                  <CommandList>
                    <CommandEmpty>No employees found.</CommandEmpty>
                    <CommandGroup>
                      {availableEmployees.map((emp) => (
                        <CommandItem
                          key={emp.id}
                          value={`${emp.firstName} ${emp.lastName} ${emp.qrCodeValue ?? ""}`}
                          onSelect={() => {
                            setSelectedEmployeeId(emp.id);
                            setEmployeeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedEmployeeId === emp.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {emp.firstName} {emp.lastName}
                          {emp.qrCodeValue && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({emp.qrCodeValue})
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Foreman forgot to scan the employee"
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !selectedSiteId ||
              !selectedForemanId ||
              !selectedEmployeeId ||
              !workDate
            }
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Scan...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Manual Scan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Manual Scans */}
      {recentScans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Created Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentScans.map((scan, idx) => (
                <div
                  key={scan?.id ?? idx}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {scan?.employee?.fullName ?? "Unknown"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {scan?.site ?? "Unknown site"} &bull;{" "}
                      {scan?.foreman ?? "Unknown foreman"} &bull;{" "}
                      {scan?.workDate}
                    </p>
                  </div>
                  <span className="text-xs text-green-600 font-medium">
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
