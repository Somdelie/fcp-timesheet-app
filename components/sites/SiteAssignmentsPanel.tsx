"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Users, Loader2, Trash2, Calendar } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  assignSupervisorToSite,
  endSupervisorSiteAssignment,
  listSupervisorSiteAssignments,
  assignForemanToSite,
  endForemanSiteAssignment,
  listForemanSiteAssignments,
  assignAdminToSite,
  endAdminSiteAssignment,
  listAdminSiteAssignments,
} from "@/actions/site-assignments";

import { TeamSelectionDialog } from "./TeamSelectionDialog";

interface Assignment {
  id: string;
  person?: {
    name: string;
    email: string;
    supervisorId?: string;
    userId?: string;
    team?: string | null;
  } | null;
  endsOn?: string | null;
  startsOn: string;
}

interface PersonOption {
  id: string; // ✅ MUST BE User.id
  name: string;
  email: string;
}

function Card({
  title,
  description,
  children,
  icon: Icon,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-6 shadow-sm transition-all hover:shadow-md">
      <div className="mb-6 flex items-center gap-3">
        {Icon && <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function AssignmentRow({
  a,
  onEnd,
  isLoading,
}: {
  a: Assignment;
  onEnd: () => void;
  isLoading: boolean;
}) {
  const isActive = !a.endsOn;

  return (
    <div className="group flex items-start justify-between gap-3 rounded border border-slate-200/30 bg-slate-50/30 p-4 transition-all hover:bg-slate-100/50 dark:border-slate-700/30 dark:bg-slate-800/20 dark:hover:bg-slate-800/40">
      <div className="min-w-0 flex-1">
        <h4 className="truncate font-semibold text-slate-900 dark:text-white">
          {a.person?.name ?? "Unknown Person"}
        </h4>
        <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">
          {a.person?.email ?? "No email"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1 rounded-full bg-slate-200/40 px-2 py-1 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            {isActive ? "Active" : "Ended"}
          </div>
          <div className="flex items-center gap-1 rounded-full bg-slate-200/40 px-2 py-1 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300">
            <Calendar className="h-3 w-3" />
            {new Date(a.startsOn).toLocaleDateString()}
          </div>
        </div>
      </div>

      {isActive && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEnd}
          disabled={isLoading}
          className="h-9 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-red-500/50 dark:hover:bg-red-500/10"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">End</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export default function SiteAssignmentsPanel({
  siteId,
  supervisorOptions,
  foremanOptions,
  adminOptions,
}: {
  siteId: string;
  supervisorOptions: PersonOption[];
  foremanOptions: PersonOption[];
  adminOptions: PersonOption[];
}) {
  const [supervisorUserId, setSupervisorUserId] = React.useState<string>("");
  const [foremanUserId, setForemanUserId] = React.useState<string>("");
  const [adminUserId, setAdminUserId] = React.useState<string>("");

  const [supervisors, setSupervisors] = React.useState<Assignment[]>([]);
  const [foremen, setForemen] = React.useState<Assignment[]>([]);
  const [admins, setAdmins] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [assigningSuper, setAssigningSuper] = React.useState(false);
  const [assigningFore, setAssigningFore] = React.useState(false);
  const [assigningAdmin, setAssigningAdmin] = React.useState(false);
  const [endingId, setEndingId] = React.useState<string | null>(null);

  // Team selection dialog state
  const [showTeamSelection, setShowTeamSelection] = React.useState(false);
  const [pendingSupervisorId, setPendingSupervisorId] =
    React.useState<string>("");
  const [teamsToAssign, setTeamsToAssign] = React.useState<
    { supervisorId: string; supervisorName: string; team: string | null }[]
  >([]);

  // Check if there are any active supervisors (no endsOn date)
  const hasActiveSupervisor = supervisors.some((s) => !s.endsOn);

  async function refresh() {
    setLoading(true);
    try {
      const [supRes, foreRes, adminRes] = await Promise.all([
        listSupervisorSiteAssignments(siteId),
        listForemanSiteAssignments(siteId),
        listAdminSiteAssignments(siteId),
      ]);
      setSupervisors(supRes.ok ? supRes.assignments : []);
      setForemen(foreRes.ok ? foreRes.assignments : []);
      setAdmins(adminRes.ok ? adminRes.assignments : []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const handleAssignSupervisor = async () => {
    if (!supervisorUserId) return toast.error("Please select a supervisor");

    // If there's already 1+ active supervisors, we need team selection for both
    const activeSupervisors = supervisors.filter((s) => !s.endsOn);
    if (activeSupervisors.length >= 1) {
      // Prepare dialog with existing supervisors + new one
      const selectedSuper = supervisorOptions.find(
        (s) => s.id === supervisorUserId,
      );
      if (!selectedSuper) return;

      const toAssign = [
        ...activeSupervisors.map((s) => ({
          supervisorId: s.person?.userId || "",
          supervisorName: s.person?.name || "Unknown",
          team: (s.person as any)?.team || null,
        })),
        {
          supervisorId: supervisorUserId,
          supervisorName: selectedSuper.name,
          team: null,
        },
      ];

      setTeamsToAssign(toAssign);
      setPendingSupervisorId(supervisorUserId);
      setShowTeamSelection(true);
      return;
    }

    // First supervisor, assign directly without team selection
    setAssigningSuper(true);
    try {
      const res = await assignSupervisorToSite({ siteId, supervisorUserId });

      if (!res.ok)
        return toast.error(res.error ?? "Failed to assign supervisor");

      toast.success("Supervisor assigned");
      setSupervisorUserId("");
      await refresh();
    } finally {
      setAssigningSuper(false);
    }
  };

  const handleTeamSelectionConfirm = async (
    assignments: { supervisorId: string; team: string }[],
  ) => {
    setAssigningSuper(true);
    try {
      // First, update existing supervisors with their teams
      for (const assignment of assignments) {
        if (assignment.supervisorId === pendingSupervisorId) continue; // Skip the new one for now
        // TODO: If you want to update existing assignments, you'd need an updateSupervisorTeam action
        // For now, teams are assigned only on creation
      }

      // Then assign the new supervisor with team
      const newAssignment = assignments.find(
        (a) => a.supervisorId === pendingSupervisorId,
      );
      if (!newAssignment) return toast.error("Team selection required");

      const res = await assignSupervisorToSite({
        siteId,
        supervisorUserId: pendingSupervisorId,
        team: newAssignment.team,
      });

      if (!res.ok)
        return toast.error(res.error ?? "Failed to assign supervisor");

      toast.success("Supervisor assigned with team");
      setSupervisorUserId("");
      setPendingSupervisorId("");
      setShowTeamSelection(false);
      await refresh();
    } finally {
      setAssigningSuper(false);
    }
  };

  const handleAssignForeman = async () => {
    if (!foremanUserId) return toast.error("Please select a foreman");

    setAssigningFore(true);
    try {
      const res = await assignForemanToSite({ siteId, foremanUserId });

      if (!res.ok) return toast.error(res.error ?? "Failed to assign foreman");

      toast.success("Foreman assigned");
      setForemanUserId("");
      await refresh();
    } finally {
      setAssigningFore(false);
    }
  };

  const handleEndSupervisorAssignment = async (assignmentId: string) => {
    setEndingId(assignmentId);
    try {
      const res = await endSupervisorSiteAssignment({ assignmentId, siteId });
      if (!res.ok) return toast.error(res.error ?? "Failed to end assignment");
      toast.success("Assignment ended");
      await refresh();
    } finally {
      setEndingId(null);
    }
  };

  const handleEndForemanAssignment = async (assignmentId: string) => {
    setEndingId(assignmentId);
    try {
      const res = await endForemanSiteAssignment({ assignmentId, siteId });
      if (!res.ok) return toast.error("Failed to end assignment");
      toast.success("Assignment ended");
      await refresh();
    } finally {
      setEndingId(null);
    }
  };

  const handleAssignAdmin = async () => {
    if (!adminUserId) return toast.error("Please select an admin");

    setAssigningAdmin(true);
    try {
      const res = await assignAdminToSite({ siteId, adminUserId });
      if (!res.ok) return toast.error(res.error ?? "Failed to assign admin");
      toast.success("Admin assigned");
      setAdminUserId("");
      await refresh();
    } finally {
      setAssigningAdmin(false);
    }
  };

  const handleEndAdminAssignment = async (assignmentId: string) => {
    setEndingId(assignmentId);
    try {
      const res = await endAdminSiteAssignment({ assignmentId, siteId });
      if (!res.ok) return toast.error(res.error ?? "Failed to end assignment");
      toast.success("Assignment ended");
      await refresh();
    } finally {
      setEndingId(null);
    }
  };

  return (
    <Card
      title="Assignments"
      description="Manage supervisors, foremen, and admins"
      icon={Users}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Supervisors */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              Supervisors
            </h3>

            <div className="flex gap-2">
              <Select
                value={supervisorUserId}
                onValueChange={setSupervisorUserId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a supervisor" />
                </SelectTrigger>
                <SelectContent>
                  {supervisorOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleAssignSupervisor}
                disabled={assigningSuper || !supervisorUserId}
                className="gap-2"
              >
                {assigningSuper ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Assigning...</span>
                  </>
                ) : (
                  "Add"
                )}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded border border-dashed border-slate-300 py-8 dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading...
              </p>
            </div>
          ) : supervisors.length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50/30 p-8 text-center dark:border-slate-700 dark:bg-slate-800/20">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No supervisors assigned yet
              </p>
            </div>
          ) : (
            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {supervisors.map((s) => (
                <AssignmentRow
                  key={s.id}
                  a={s}
                  isLoading={endingId === s.id}
                  onEnd={() => handleEndSupervisorAssignment(s.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Foremen */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              Foremen
            </h3>

            {!hasActiveSupervisor && !loading && (
              <div className="mb-3 rounded border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                You must assign a supervisor to this site before adding foremen.
                Foremen will be automatically linked to the site&apos;s
                supervisors when assigned.
              </div>
            )}

            <div className="flex gap-2">
              <Select
                value={foremanUserId}
                onValueChange={setForemanUserId}
                disabled={!hasActiveSupervisor}
              >
                <SelectTrigger
                  className={`w-full ${!hasActiveSupervisor ? "opacity-50" : ""}`}
                >
                  <SelectValue
                    placeholder={
                      hasActiveSupervisor
                        ? "Select a foreman"
                        : "Assign a supervisor first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {foremanOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} — {f.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleAssignForeman}
                disabled={
                  assigningFore || !foremanUserId || !hasActiveSupervisor
                }
                className="gap-2"
              >
                {assigningFore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Assigning...</span>
                  </>
                ) : (
                  "Add"
                )}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded border border-dashed border-slate-300 py-8 dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading...
              </p>
            </div>
          ) : foremen.length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50/30 p-8 text-center dark:border-slate-700 dark:bg-slate-800/20">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No foremen assigned yet
              </p>
            </div>
          ) : (
            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {foremen.map((f) => (
                <AssignmentRow
                  key={f.id}
                  a={f}
                  isLoading={endingId === f.id}
                  onEnd={() => handleEndForemanAssignment(f.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Admins */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              Admins
            </h3>

            <div className="flex gap-2">
              <Select value={adminUserId} onValueChange={setAdminUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an admin" />
                </SelectTrigger>
                <SelectContent>
                  {adminOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — {a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleAssignAdmin}
                disabled={assigningAdmin || !adminUserId}
                className="gap-2"
              >
                {assigningAdmin ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Assigning...</span>
                  </>
                ) : (
                  "Add"
                )}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded border border-dashed border-slate-300 py-8 dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading...
              </p>
            </div>
          ) : admins.length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50/30 p-8 text-center dark:border-slate-700 dark:bg-slate-800/20">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No admins assigned yet
              </p>
            </div>
          ) : (
            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {admins.map((a) => (
                <AssignmentRow
                  key={a.id}
                  a={a}
                  isLoading={endingId === a.id}
                  onEnd={() => handleEndAdminAssignment(a.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded border border-slate-200/50 bg-blue-50/50 p-3 text-xs text-blue-700 dark:border-slate-700/50 dark:bg-blue-500/5 dark:text-blue-400">
        <strong>Workflow:</strong> Assign supervisors first, then foremen.
        Foremen are automatically linked to all active supervisors when assigned
        to a site. When assigning 2+ supervisors, select their team assignments.
      </div>

      <TeamSelectionDialog
        open={showTeamSelection}
        onOpenChange={setShowTeamSelection}
        supervisors={teamsToAssign}
        onConfirm={handleTeamSelectionConfirm}
        isLoading={assigningSuper}
      />
    </Card>
  );
}
