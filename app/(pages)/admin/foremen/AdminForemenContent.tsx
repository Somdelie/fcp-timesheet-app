"use client";

import { useBreadcrumbs } from "@/lib/breadcrumb-context";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Users,
  Check,
  ChevronsUpDown,
  Landmark,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import ForemenTable from "@/components/foremen/ForemenTable";
import {
  actionAdminListEmployees,
  actionAdminCreateAssistant,
} from "@/actions/admin";
import { switchForemanTeam } from "@/actions/foreman-team";
import { getTeamRateOptions } from "@/actions/company-settings";
import { updateForemanBankName } from "@/actions/foreman-bank";
import { updateForeman } from "@/actions/foreman-update";
import { SA_BANKS } from "@/lib/sa-banks";
import type { AdminEmployee } from "@/lib/apiClient";

type TeamOption = {
  value: string;
  label: string;
};

const DEFAULT_TEAM_OPTIONS: TeamOption[] = [
  { value: "PAINTERS", label: "Painters" },
  { value: "BUILDING", label: "Building" },
  { value: "SPECIAL_COATINGS", label: "Special Coatings" },
  { value: "CAPE_TOWN", label: "Cape Town" },
];

const TEAM_LABELS: Record<string, string> = {
  PAINTERS: "Painters",
  BUILDING: "Building",
  SPECIAL_COATINGS: "Special Coatings",
  CAPE_TOWN: "Cape Town",
};

const TEAM_COLORS: Record<string, string> = {
  PAINTERS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  BUILDING:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  SPECIAL_COATINGS:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  CAPE_TOWN: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

interface Foreman {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  foreman: {
    id: string;
    defaultDayRate: string | null;
    defaultTeam: string;
    bankName: string | null;
    createdAt: string;
    supervisorId: string | null;
    supervisorName: string | null;
    assistants: Array<{
      id: string;
      name: string;
      email: string | null;
      qrCodeValue: string;
      startsOn: string;
    }>;
  } | null;
  isAssistant: boolean;
}

export function AdminForemenContent({ foremen }: { foremen: Foreman[] }) {
  const { setBreadcrumbs } = useBreadcrumbs();
  const router = useRouter();
  const [teamOptions, setTeamOptions] = useState(DEFAULT_TEAM_OPTIONS);
  const [selectedForeman, setSelectedForeman] = useState<Foreman | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Add Assistant dialog state
  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false);
  const [selectedForemanForAssistant, setSelectedForemanForAssistant] =
    useState<Foreman | null>(null);
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [assistantEmployeeOpen, setAssistantEmployeeOpen] = useState(false);
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

  // Team switch dialog state
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamDialogForeman, setTeamDialogForeman] = useState<Foreman | null>(
    null,
  );
  const [teamDialogValue, setTeamDialogValue] = useState<string>("");
  const [isSwitchingTeam, setIsSwitchingTeam] = useState(false);

  // Bank name edit dialog state
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [bankDialogForeman, setBankDialogForeman] = useState<Foreman | null>(
    null,
  );
  const [bankDialogValue, setBankDialogValue] = useState<string>("");
  const [isUpdatingBank, setIsUpdatingBank] = useState(false);

  // Edit foreman dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Foreman | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    defaultDayRate: "",
    bankName: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const teamLabels = useMemo(
    () => ({
      ...TEAM_LABELS,
      ...Object.fromEntries(teamOptions.map((team) => [team.value, team.label])),
    }),
    [teamOptions],
  );

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard", href: "/" }, { label: "Foremen" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    let alive = true;

    async function loadTeamOptions() {
      const res = await getTeamRateOptions();
      if (!alive || !res.ok) return;
      setTeamOptions(
        res.teams.map((team) => ({ value: team.code, label: team.name })),
      );
    }

    loadTeamOptions();
    return () => {
      alive = false;
    };
  }, []);

  const openDialog = (foreman: Foreman) => {
    setSelectedForeman(foreman);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedForeman(null);
  };

  const handleOpenSwitchTeam = (foreman: Foreman) => {
    setTeamDialogForeman(foreman);
    setTeamDialogValue(foreman.foreman?.defaultTeam ?? "PAINTERS");
    setTeamDialogOpen(true);
  };

  const handleSwitchTeam = async () => {
    if (!teamDialogForeman?.foreman?.id) return;
    setIsSwitchingTeam(true);
    try {
      const res = await switchForemanTeam({
        foremanId: teamDialogForeman.foreman.id,
        newTeam: teamDialogValue as any,
      });
      if (res.ok) {
        toast.success(res.message || "Team switched successfully!");
        setTeamDialogOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to switch team.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to switch team.");
    } finally {
      setIsSwitchingTeam(false);
    }
  };

  const handleOpenEdit = (foreman: Foreman) => {
    setEditTarget(foreman);
    setEditForm({
      name: foreman.name,
      defaultDayRate: foreman.foreman?.defaultDayRate ?? "",
      bankName: foreman.foreman?.bankName ?? "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget?.foreman?.id) return;
    setIsSavingEdit(true);
    try {
      const res = await updateForeman({
        foremanId: editTarget.foreman.id,
        name: editForm.name,
        defaultDayRate: editForm.defaultDayRate || null,
        bankName: (editForm.bankName || null) as any,
      });
      if (res.ok) {
        toast.success(res.message || "Foreman updated!");
        setEditDialogOpen(false);
        closeDialog();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update foreman.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to update foreman.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenEditBank = (foreman: Foreman) => {
    setBankDialogForeman(foreman);
    setBankDialogValue(foreman.foreman?.bankName ?? "");
    setBankDialogOpen(true);
  };

  const handleUpdateBank = async () => {
    if (!bankDialogForeman?.foreman?.id) return;
    setIsUpdatingBank(true);
    try {
      const res = await updateForemanBankName({
        foremanId: bankDialogForeman.foreman.id,
        bankName: (bankDialogValue || null) as any,
      });
      if (res.ok) {
        toast.success(res.message || "Bank name updated successfully!");
        setBankDialogOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update bank name.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to update bank name.");
    } finally {
      setIsUpdatingBank(false);
    }
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
    if (!createAssistantData.assistantPassword) {
      toast.error("Password is required");
      return;
    }
    if (createAssistantData.assistantPassword.length < 8) {
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
        {/* Search */}
        <div className="mb-3 rounded border border-zinc-200/50 bg-white/80 backdrop-blur-sm px-5 py-3 shadow-sm transition-all hover:shadow-md dark:border-zinc-700/50 dark:bg-card/40">
          <div className="flex flex-col gap-4 sm:flex-row items-end sm:justify-between">
            <div className="flex-1 w-full">
              {/* <label
                htmlFor="search"
                className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Search Foremen, Manage all foremen in the system.
              </label> */}
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
            teamOptions={teamOptions}
            onView={openDialog}
            onAddAssistant={handleOpenAddAssistant}
            onSwitchTeam={handleOpenSwitchTeam}
            onEditBank={handleOpenEditBank}
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

              {/* Team */}
              {selectedForeman.foreman && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-2 bg-violet-50 rounded">
                    <Users size={18} className="text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-muted-foreground tracking-wider">
                      TEAM
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${TEAM_COLORS[selectedForeman.foreman.defaultTeam] ?? ""}`}
                      >
                        {teamLabels[selectedForeman.foreman.defaultTeam] ??
                          selectedForeman.foreman.defaultTeam}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Name */}
              {selectedForeman.foreman && (
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-2 bg-green-50 rounded">
                    <Landmark size={18} className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-muted-foreground tracking-wider">
                      BANK
                    </p>
                    <p className="mt-1.5 font-semibold text-foreground">
                      {selectedForeman.foreman.bankName ?? "—"}
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

              {selectedForeman.foreman && (
                <div className="col-span-2 border-t pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="p-2 bg-orange-50 rounded">
                      <UserPlus size={18} className="text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground tracking-wider">
                        ASSISTANTS
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedForeman.foreman.assistants.length} active
                      </p>
                    </div>
                  </div>

                  {selectedForeman.foreman.assistants.length === 0 ? (
                    <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
                      No assistants assigned.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedForeman.foreman.assistants.map((assistant) => (
                        <div
                          key={assistant.id}
                          className="rounded border bg-muted/30 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">
                                {assistant.name}
                              </p>
                              <p className="truncate text-sm text-muted-foreground">
                                {assistant.email ?? "No login email"}
                              </p>
                            </div>
                            <span className="shrink-0 rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 dark:bg-orange-300/20 dark:text-orange-300">
                              Assistant
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Code: {assistant.qrCodeValue}</span>
                            <span>Since: {assistant.startsOn}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="col-span-2 flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => handleOpenEdit(selectedForeman)}
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
              <Popover
                open={assistantEmployeeOpen}
                onOpenChange={setAssistantEmployeeOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={assistantEmployeeOpen}
                    className="w-full justify-between mt-1"
                  >
                    {createAssistantData.employeeId
                      ? (() => {
                          const emp = employees.find(
                            (e) => e.id === createAssistantData.employeeId,
                          );
                          return emp
                            ? `${emp.firstName} ${emp.lastName}`
                            : "Choose an employee...";
                        })()
                      : "Choose an employee..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search employees…" />
                    <CommandList>
                      <CommandEmpty>No employees found.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={emp.id}
                            keywords={[
                              `${emp.firstName} ${emp.lastName}`,
                              emp.qrCodeValue || "",
                              emp.userEmail || "",
                            ]}
                            onSelect={() => {
                              handleSelectEmployeeForAssistant(emp);
                              setAssistantEmployeeOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                createAssistantData.employeeId === emp.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            <span>
                              {emp.firstName} {emp.lastName}
                            </span>
                            {emp.qrCodeValue && (
                              <span className="text-xs text-muted-foreground ml-2">
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
            {selectedEmployee && (
              <div className="rounded bg-blue-50 dark:bg-blue-950 p-3 text-sm">
                {isNewUserAssistant ? (
                  <p className="text-muted-foreground">
                    Creating new user account for this member
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
            <div>
              <label className="text-sm font-medium">Assistant Password</label>
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
              <div className="bg-muted/50 dark:bg-muted/20 p-4 rounded space-y-4 border border-border">
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
              <div className="rounded bg-blue-50 dark:bg-blue-950/30 p-3 border border-blue-200 dark:border-blue-900">
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

      {/* Edit Foreman Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Foreman</DialogTitle>
            <DialogDescription>
              Update details for <strong>{editTarget?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="Full name"
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Default Day Rate (R)
              </label>
              <Input
                value={editForm.defaultDayRate}
                onChange={(e) =>
                  setEditForm({ ...editForm, defaultDayRate: e.target.value })
                }
                placeholder="e.g. 350.00"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Bank</label>
              <Select
                value={editForm.bankName}
                onValueChange={(v) => setEditForm({ ...editForm, bankName: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent>
                  {SA_BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={isSavingEdit}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Bank Name Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Bank Name</DialogTitle>
            <DialogDescription>
              Update the bank for <strong>{bankDialogForeman?.name}</strong>.
              This is used for payment exports.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bank</label>
              <Select
                value={bankDialogValue}
                onValueChange={setBankDialogValue}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent>
                  {SA_BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setBankDialogOpen(false)}
                disabled={isUpdatingBank}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateBank}
                disabled={
                  isUpdatingBank ||
                  bankDialogValue ===
                    (bankDialogForeman?.foreman?.bankName ?? "")
                }
              >
                {isUpdatingBank ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Switch Team Dialog */}
      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Switch Team</DialogTitle>
            <DialogDescription>
              Change the default team for{" "}
              <strong>{teamDialogForeman?.name}</strong>. This affects the day
              rate used for all future scans under this foreman.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Team</label>
              <Select
                value={teamDialogValue}
                onValueChange={setTeamDialogValue}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teamOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Existing attendance scans will not be affected. Only future
                scans will use the new team rate.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setTeamDialogOpen(false)}
                disabled={isSwitchingTeam}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSwitchTeam}
                disabled={
                  isSwitchingTeam ||
                  teamDialogValue === teamDialogForeman?.foreman?.defaultTeam
                }
              >
                {isSwitchingTeam ? "Switching..." : "Switch Team"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
