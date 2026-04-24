"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { RotateCw, Wrench, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const STATUS_OPTIONS = ["ALL", "DEPLOYED", "RETURNED", "DAMAGED", "LOST"];

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      const res = await fetch(
        `/api/app/admin/plant-assignments?${params}`,
        { credentials: "include" },
      );
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

  const filtered = assignments.filter((a) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      a.product.name.toLowerCase().includes(term) ||
      a.site.name.toLowerCase().includes(term) ||
      (a.site.code ?? "").toLowerCase().includes(term)
    );
  });

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
              <TableHead>Item</TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Site
                </span>
              </TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Deployed On</TableHead>
              <TableHead>Transferred From</TableHead>
              <TableHead>Note</TableHead>
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
                  {search ? "No assignments match your search" : "No assignments yet"}
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
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {a.note || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
