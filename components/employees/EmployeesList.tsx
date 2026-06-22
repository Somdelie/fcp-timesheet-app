"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, RotateCw, X, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CreateEmployeeForm from "@/components/employees/CreateEmployeeForm";
import EmployeesTable, {
  type Employee,
} from "@/components/employees/EmployeesTable";
import { listEmployees, listEmployeeCreators } from "@/actions/employees";

type Creator = { id: string; name: string; role: string };

export default function EmployeesList({
  show = "active",
}: {
  q?: string;
  show?: "active" | "all";
}) {
  const [query, setQuery] = useState("");
  const [selectedCreator, setSelectedCreator] = useState<string>("all");
  const [creators, setCreators] = useState<Creator[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  /** Load all employees + creators once on mount */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [empRes, creatorsList] = await Promise.all([
        listEmployees({ show }),
        listEmployeeCreators(),
      ]);
      if (empRes.ok) {
        setAllEmployees(empRes.employees as Employee[]);
      } else {
        setError(true);
      }
      setCreators(creatorsList);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** Pure client-side filtering — instant, no server round-trips */
  const filtered = useMemo(() => {
    let result = allEmployees;

    // Filter by creator
    if (selectedCreator !== "all") {
      result = result.filter((e) => e.createdByUserId === selectedCreator);
    }

    // Filter by search query
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          e.firstName.toLowerCase().includes(q) ||
          e.lastName.toLowerCase().includes(q) ||
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.qrCodeValue.toLowerCase().includes(q),
      );
    }

    return result;
  }, [allEmployees, selectedCreator, query]);

  if (error && allEmployees.length === 0) {
    return (
      <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
        Failed to load employees
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 space-y-3">
      {/* Toolbar: search + foreman filter + actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Created-by filter */}
          <Select value={selectedCreator} onValueChange={setSelectedCreator}>
            <SelectTrigger className="h-9 flex-1 shrink-0">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="All Foremen" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Foremen</SelectItem>
              {creators.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.role ? ` (${c.role})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => loadData()}
            className="gap-1.5"
          >
            <RotateCw
              className={`h-4 w-4 ${loading ? "animate-spin text-muted-foreground" : ""}`}
            />
            <span className="text-xs font-medium">
              {loading ? "Loading" : "Refresh"}
            </span>
          </Button>
          <CreateEmployeeForm onSaved={loadData} />
        </div>
      </div>

      {/* Table or empty state */}
      {!loading && filtered.length === 0 ? (
        <div className="border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            No employees found
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Adjust your search or filters, or add a new employee.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto w-full">
          <EmployeesTable data={filtered} onChanged={loadData} />
        </div>
      )}
    </div>
  );
}
