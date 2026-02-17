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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, QrCode, UserPlus } from "lucide-react";

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
    const newValue = value === "all" ? "" : value;
    setSelectedSiteId(newValue);
    loadScans(newValue, selectedForemanId, selectedSupervisorId);
  };

  const handleForemanChange = (value: string) => {
    const newValue = value === "all" ? "" : value;
    setSelectedForemanId(newValue);
    loadScans(selectedSiteId, newValue, selectedSupervisorId);
  };

  const handleSupervisorChange = (value: string) => {
    const newValue = value === "all" ? "" : value;
    setSelectedSupervisorId(newValue);
    loadScans(selectedSiteId, selectedForemanId, newValue);
  };

  const groupedScans = groupScansByDate(scans);

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
            <div className="w-48">
              <Select
                value={selectedSiteId || "all"}
                onValueChange={handleSiteChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select
                value={selectedForemanId || "all"}
                onValueChange={handleForemanChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Foremen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Foremen</SelectItem>
                  {foremen.map((foreman) => (
                    <SelectItem key={foreman.id} value={foreman.id}>
                      {foreman.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select
                value={selectedSupervisorId || "all"}
                onValueChange={handleSupervisorChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Supervisors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Supervisors</SelectItem>
                  {supervisors.map((supervisor) => (
                    <SelectItem key={supervisor.id} value={supervisor.id}>
                      {supervisor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <div className="space-y-8">
              {groupedScans.map((group) => (
                <div key={group.date}>
                  <h2 className="mb-4 text-lg font-semibold">{group.label}</h2>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Site</TableHead>
                          <TableHead>Foreman</TableHead>
                          <TableHead>Scanned At</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Location</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.scans.map((scan) => (
                          <TableRow key={scan.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {scan.employeeName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {scan.employeeCode}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{scan.siteName}</TableCell>
                            <TableCell>{scan.foremanName}</TableCell>
                            <TableCell>
                              {new Date(scan.scannedAtISO).toLocaleTimeString(
                                "en-GB",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </TableCell>
                            <TableCell>
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
                            <TableCell>
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
