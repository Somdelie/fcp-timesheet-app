"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Loader2,
  Search,
  User,
  CreditCard,
  Check,
  RefreshCcw,
} from "lucide-react";

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  code: string | null;
}

interface UnmatchedScan {
  id: string;
  cardNumber: string;
  rawName: string | null;
  siteName: string | null;
  scanTime: string;
}

export default function SeedCardNumbersPage() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [unmatchedScans, setUnmatchedScans] = useState<UnmatchedScan[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingScans, setLoadingScans] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadEmployees() {
      setLoadingEmployees(true);
      try {
        const res = await fetch("/api/employees?show=active");
        const data = await res.json();
        if (res.ok && Array.isArray(data.employees)) {
          setEmployees(
            data.employees.map((employee: any) => ({
              id: employee.id,
              firstName: employee.firstName,
              lastName: employee.lastName,
              code: employee.code ?? null,
            })),
          );
        } else {
          throw new Error(data?.error || "Failed to load employees");
        }
      } catch (error) {
        console.error(error);
        toast.error("Unable to load employees");
      } finally {
        setLoadingEmployees(false);
      }
    }

    async function loadScans() {
      setLoadingScans(true);
      try {
        const res = await fetch("/api/app/admin/cards/seed");
        const data = await res.json();
        if (res.ok && Array.isArray(data.scans)) {
          setUnmatchedScans(data.scans);
        } else {
          throw new Error(data?.error || "Failed to load unmatched scans");
        }
      } catch (error) {
        console.error(error);
        toast.error("Unable to load unmatched scans");
      } finally {
        setLoadingScans(false);
      }
    }

    void loadEmployees();
    void loadScans();
  }, []);

  const selectedEmployee = useMemo(
    () =>
      employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const filteredEmployees = useMemo(() => {
    const query = employeeQuery.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) => {
      return (
        `${employee.firstName} ${employee.lastName}`
          .toLowerCase()
          .includes(query) || employee.code?.toLowerCase().includes(query)
      );
    });
  }, [employeeQuery, employees]);

  const handleSubmit = async () => {
    if (!selectedEmployeeId) {
      toast.error("Select an employee to assign the card");
      return;
    }
    if (!cardNumber.trim()) {
      toast.error("Enter the card number from the lost card");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/app/admin/cards/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          cardNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Server error ${res.status}`);
      }
      toast.success(
        `Card assigned to ${selectedEmployee?.firstName} ${selectedEmployee?.lastName}. ${data.matchedScanCount} unmatched scan(s) matched.`,
      );
      setCardNumber("");
      void refreshScans();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to assign card number",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const refreshScans = async () => {
    setLoadingScans(true);
    try {
      const res = await fetch("/api/app/admin/cards/seed");
      const data = await res.json();
      if (res.ok && Array.isArray(data.scans)) {
        setUnmatchedScans(data.scans);
      }
    } finally {
      setLoadingScans(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Seed Lost Cards</CardTitle>
            <CardDescription>
              Assign a new physical card number to an employee and match any
              previously stored unmatched scans for that card.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="employee-search">Employee</Label>
              <Command>
                <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <CommandInput
                    id="employee-search"
                    placeholder="Search employee name or current card code"
                    value={employeeQuery}
                    onValueChange={setEmployeeQuery}
                    className="border-none p-0 outline-none"
                  />
                </div>
                <CommandList>
                  <CommandEmpty>No employees found.</CommandEmpty>
                  <CommandGroup>
                    {filteredEmployees.map((employee) => (
                      <CommandItem
                        key={employee.id}
                        value={employee.id}
                        onSelect={(value) => {
                          setSelectedEmployeeId(value);
                          const found = employees.find(
                            (item) => item.id === value,
                          );
                          setEmployeeQuery(
                            found ? `${found.firstName} ${found.lastName}` : "",
                          );
                        }}
                        className="gap-2"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {employee.firstName} {employee.lastName}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {employee.code ?? "No card"}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-number">Card Number</Label>
              <div className="relative">
                <Input
                  id="card-number"
                  value={cardNumber}
                  onChange={(event) => setCardNumber(event.target.value)}
                  placeholder="Enter new card number"
                />
                <CreditCard className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            {selectedEmployee && (
              <div className="rounded-md border border-border bg-muted/50 p-4 text-sm">
                <p className="font-medium">
                  Selected employee: {selectedEmployee.firstName}{" "}
                  {selectedEmployee.lastName}
                </p>
                <p className="text-muted-foreground">
                  Current card code: {selectedEmployee.code ?? "None"}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                onClick={handleSubmit}
                disabled={submitting || loadingEmployees}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assign card
                  </>
                ) : (
                  "Assign card"
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={refreshScans}
                disabled={loadingScans}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh unmatched scans
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unmatched Card Scans</CardTitle>
            <CardDescription>
              These are card numbers scanned by the app that did not match any
              employee yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingScans ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading unmatched scans…
              </div>
            ) : unmatchedScans.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No unmatched scans found.
              </p>
            ) : (
              <div className="space-y-3">
                {unmatchedScans.slice(0, 12).map((scan) => (
                  <div
                    key={scan.id}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div>
                        <div className="font-medium">{scan.cardNumber}</div>
                        <div className="text-muted-foreground">
                          {scan.rawName ?? "No name captured"}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>{scan.siteName ?? "Unknown site"}</div>
                        <div>{new Date(scan.scanTime).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {unmatchedScans.length > 12 && (
                  <p className="text-xs text-muted-foreground">
                    Showing latest 12 of {unmatchedScans.length} unmatched
                    scans.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
