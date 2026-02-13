"use client";

import { useBreadcrumbs } from "@/lib/breadcrumb-context";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  Edit2,
  Mail,
  User,
  X,
  Briefcase,
  DollarSign,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ForemenTable, {
  type ForemanRow,
} from "@/components/foremen/ForemenTable";
import {
  actionAdminListEmployees,
  actionAdminCreateAssistant,
} from "@/actions/admin";
import type { AdminEmployee } from "@/lib/apiClient";

interface Foreman {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  foreman: {
    id: string;
    defaultDayRate: string | null;
    createdAt: string;
  } | null;
  isAssistant: boolean;
}

export function ForemanContent({ foremen }: { foremen: Foreman[] }) {
  const { setBreadcrumbs } = useBreadcrumbs();
  const router = useRouter();
  const [selectedForeman, setSelectedForeman] = useState<Foreman | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Add Assistant dialog state
  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false);
  const [selectedForemanForAssistant, setSelectedForemanForAssistant] =
    useState<Foreman | null>(null);
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee] =
    useState<AdminEmployee | null>(null);
  const [isNewUserAssistant, setIsNewUserAssistant] = useState(true);
  const [createAssistantLoading, setCreateAssistantLoading] = useState(false);
  const [createAssistantData, setCreateAssistantData] = useState({
    employeeId: "",
    assistantName: "",
    assistantEmail: "",
    assistantPassword: "",
  });
  const [showCredentials, setShowCredentials] = useState<{
    assistantName: string;
    assistantEmail: string;
    assistantPassword: string;
  } | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard", href: "/" }, { label: "Foremen" }]);
  }, [setBreadcrumbs]);

  const openDialog = (foreman: Foreman) => {
    setSelectedForeman(foreman);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedForeman(null);
  };

  const loadEmployeesForAssistant = async () => {
    try {
      const result = await actionAdminListEmployees({});
      if (result.ok) {
        setEmployees(result.employees);
      } else {
        toast.error(result.error);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load employees");
    }
  };

  const handleOpenAddAssistant = async (foreman: Foreman) => {
    setSelectedForemanForAssistant(foreman);
    setSelectedEmployee(null);
    setIsNewUserAssistant(true);
    setCreateAssistantData({
      employeeId: "",
      assistantName: "",
      assistantEmail: "",
      assistantPassword: "",
    });
    await loadEmployeesForAssistant();
    setAssistantDialogOpen(true);
  };

  const handleSelectEmployeeForAssistant = (emp: AdminEmployee) => {
    setSelectedEmployee(emp);
    setCreateAssistantData({
      employeeId: emp.id,
      assistantName: emp.userId ? emp.userName || "" : "",
      assistantEmail: emp.userId ? emp.userEmail || "" : "",
      assistantPassword: "",
    });
    setIsNewUserAssistant(!emp.userId);
  };

  const handleCreateAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForemanForAssistant?.foreman?.id) {
      toast.error("No foreman selected");
      return;
    }
    if (!createAssistantData.employeeId) {
      toast.error("Please select an employee");
      return;
    }
    if (isNewUserAssistant && !createAssistantData.assistantPassword) {
      toast.error("Password is required for new users");
      return;
    }
    if (
      isNewUserAssistant &&
      createAssistantData.assistantPassword.length < 8
    ) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setCreateAssistantLoading(true);

    try {
      const result = await actionAdminCreateAssistant({
        foremanId: selectedForemanForAssistant.foreman.id,
        employeeId: createAssistantData.employeeId,
        assistantName: createAssistantData.assistantName,
        assistantEmail: createAssistantData.assistantEmail,
        assistantPassword: createAssistantData.assistantPassword,
      });

      if (result.ok) {
        setShowCredentials({
          assistantName: result.assistant.assistantName || "",
          assistantEmail: result.assistant.assistantEmail,
          assistantPassword: createAssistantData.assistantPassword,
        });
        setAssistantDialogOpen(false);
        setCreateAssistantData({
          employeeId: "",
          assistantName: "",
          assistantEmail: "",
          assistantPassword: "",
        });
        router.refresh();
      } else {
        toast.error(result.error || `HTTP ${result.status || "error"}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to create assistant");
    } finally {
      setCreateAssistantLoading(false);
    }
  };

  const filtered = query.trim()
    ? foremen.filter(
        (f) =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.email.toLowerCase().includes(query.toLowerCase()),
      )
    : foremen;

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}

        {/* Search */}
        <div className="mb-3 rounded border border-zinc-200/50 bg-white/80 backdrop-blur-sm px-5 py-3 shadow-sm transition-all hover:shadow-md dark:border-zinc-700/50 dark:bg-card/40">
          <div className="flex flex-col gap-4 sm:flex-row items-end sm:justify-between">
            <div className="flex-1 w-full">
              <label
                htmlFor="search"
                className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Search Foremen, Manage all foremen in the system.
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <Input
                  id="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="h-10 pl-9 dark:bg-zinc-800/50 dark:border-zinc-700/50 dark:text-white dark:placeholder-zinc-500"
                />
              </div>
            </div>
            <Button asChild className="gap-2" size="lg">
              <Link href="/users/new">
                <Plus className="h-4 w-4" />
                Create Foreman
              </Link>
            </Button>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="rounded border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
            <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-slate-950 flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              No foremen found
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Try adjusting your search or create a new foreman to get started.
            </p>
          </div>
        ) : (
          <ForemenTable
            data={filtered}
            onView={openDialog}
            onAddAssistant={handleOpenAddAssistant}
          />
        )}
      </div>
      {/* Dialog for viewing foreman details */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md border-0 shadow-lg">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold">
                Foreman Details
              </DialogTitle>
              <button
                onClick={closeDialog}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </DialogHeader>

          {selectedForeman && (
            <div className="space-y-5 py-4 grid grid-cols-2">
              {/* Name */}
              <div className="flex items-start gap-3">
                <div className="mt-1 p-2 bg-sky-50 rounded">
                  <User size={18} className="text-sky-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground tracking-wider">
                    NAME
                  </p>
                  <p className="mt-1.5 font-semibold text-foreground">
                    {selectedForeman.name}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3">
                <div className="mt-1 p-2 bg-emerald-50 rounded">
                  <Mail size={18} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground tracking-wider">
                    EMAIL
                  </p>
                  <p className="mt-1.5 font-semibold text-foreground break-all">
                    {selectedForeman.email}
                  </p>
                </div>
              </div>

              {/* Role */}
              <div className="flex items-start gap-3">
                <div className="mt-1 p-2 bg-purple-50 rounded">
                  <Briefcase size={18} className="text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground tracking-wider">
                    ROLE
                  </p>
                  <p className="mt-1.5 font-semibold text-foreground">
                    {selectedForeman.role}
                  </p>
                </div>
              </div>

              {/* Default Day Rate */}
              {selectedForeman.foreman?.defaultDayRate && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-2 bg-amber-50 rounded">
                    <DollarSign size={18} className="text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-muted-foreground tracking-wider">
                      DEFAULT DAY RATE
                    </p>
                    <p className="mt-1.5 font-semibold text-foreground">
                      R {selectedForeman.foreman.defaultDayRate}
                    </p>
                  </div>
                </div>
              )}

              {/* Created Date */}
              <div className="flex items-start gap-3">
                <div className="mt-1 p-2 bg-slate-100 rounded">
                  <Calendar size={18} className="text-slate-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground tracking-wider">
                    CREATED
                  </p>
                  <p className="mt-1.5 font-semibold text-foreground">
                    {selectedForeman.createdAt}
                  </p>
                </div>
              </div>

              {/* Foreman Created Date */}
              <div className="flex items-start gap-3">
                <div className="mt-1 p-2 bg-slate-100 rounded">
                  <Calendar size={18} className="text-slate-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground tracking-wider">
                    FOREMAN CREATED
                  </p>
                  <p className="mt-1.5 font-semibold text-foreground">
                    {selectedForeman.foreman?.createdAt || "N/A"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    // Handle edit functionality here
                    console.log("Edit foreman:", selectedForeman);
                  }}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium h-10 gap-2"
                >
                  <Edit2 size={16} />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={closeDialog}
                  className="flex-1 font-medium h-10 border-slate-200 hover:bg-slate-50"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Assistant Dialog */}
      <Dialog open={assistantDialogOpen} onOpenChange={setAssistantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Assistant</DialogTitle>
            <DialogDescription>
              Create an assistant account for{" "}
              {selectedForemanForAssistant?.name ||
                selectedForemanForAssistant?.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAssistant} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Employee</label>
              <Select
                value={createAssistantData.employeeId}
                onValueChange={(value) => {
                  const emp = employees.find((e) => e.id === value);
                  if (emp) {
                    handleSelectEmployeeForAssistant(emp);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose an employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No employees available
                    </div>
                  ) : (
                    employees.map((emp) => (
                      <SelectItem
                        key={emp.id}
                        value={emp.id}
                        className="border-b"
                      >
                        <span>
                          {emp.firstName} {emp.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({emp.qrCodeValue})
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedEmployee && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-3 text-sm">
                {isNewUserAssistant ? (
                  <p className="text-muted-foreground">
                    Creating new user account for this employee
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Linking existing user account
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-medium">
                Assistant Name {!isNewUserAssistant && "(Auto-filled)"}
              </label>
              <Input
                type="text"
                placeholder="Assistant name"
                value={createAssistantData.assistantName}
                onChange={(e) =>
                  setCreateAssistantData({
                    ...createAssistantData,
                    assistantName: e.target.value,
                  })
                }
                disabled={!isNewUserAssistant}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Assistant Email {!isNewUserAssistant && "(Auto-filled)"}
              </label>
              <Input
                type="email"
                placeholder="assistant@example.com"
                value={createAssistantData.assistantEmail}
                onChange={(e) =>
                  setCreateAssistantData({
                    ...createAssistantData,
                    assistantEmail: e.target.value,
                  })
                }
                disabled={!isNewUserAssistant}
                required
              />
            </div>
            {isNewUserAssistant && (
              <div>
                <label className="text-sm font-medium">
                  Assistant Password
                </label>
                <Input
                  type="password"
                  placeholder="Min 8 characters"
                  value={createAssistantData.assistantPassword}
                  onChange={(e) =>
                    setCreateAssistantData({
                      ...createAssistantData,
                      assistantPassword: e.target.value,
                    })
                  }
                  required
                  minLength={8}
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssistantDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createAssistantLoading}>
                {createAssistantLoading ? "Creating..." : "Create Assistant"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      {showCredentials && (
        <Dialog
          open={!!showCredentials}
          onOpenChange={() => setShowCredentials(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assistant Created Successfully</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please save these credentials securely:
              </p>
              <div className="bg-muted/50 dark:bg-muted/20 p-4 rounded-lg space-y-4 border border-border">
                <div>
                  <label className="text-sm font-semibold block mb-2">
                    Name
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background dark:bg-slate-900 p-3 rounded border border-border text-sm font-mono select-all">
                      {showCredentials.assistantName}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          showCredentials.assistantName,
                        );
                        toast.success("Name copied");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-2">
                    Email
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background dark:bg-slate-900 p-3 rounded border border-border text-sm font-mono select-all break-all">
                      {showCredentials.assistantEmail}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          showCredentials.assistantEmail,
                        );
                        toast.success("Email copied");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-2">
                    Password
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background dark:bg-slate-900 p-3 rounded border border-border text-sm font-mono select-all">
                      {showCredentials.assistantPassword}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          showCredentials.assistantPassword,
                        );
                        toast.success("Password copied");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 border border-blue-200 dark:border-blue-900">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  ℹ️ Share these credentials with the assistant securely. They
                  will not be shown again.
                </p>
              </div>
              <Button
                onClick={() => setShowCredentials(null)}
                className="w-full"
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
