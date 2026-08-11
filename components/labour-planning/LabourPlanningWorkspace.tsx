"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Users,
  WalletCards,
  CalendarDays,
  Send,
  Check,
  Ban,
  Flag,
} from "lucide-react";
import {
  createLabourPlan,
  getLabourPlanningBootstrap,
  listLabourPlans,
  transitionLabourPlanStatus,
} from "@/actions/labour-planning";

type TeamEntry = {
  teamCode: string;
  peopleCount: number;
  expectedOvertime: boolean;
  foremanId: string;
  supervisorId: string;
  notes: string;
};

const emptyEntry = (): TeamEntry => ({
  teamCode: "",
  peopleCount: 1,
  expectedOvertime: false,
  foremanId: "",
  supervisorId: "",
  notes: "",
});

// Every team in a plan is staffed at the same headcount for each day in the
// plan's date range. Per-day variation is possible on the backend but isn't
// exposed by this form yet.
function dateRange(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

const statusStyles: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
  COMPLETED: "bg-zinc-200 text-zinc-700",
};

const money = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

export function LabourPlanningWorkspace() {
  const [bootstrap, setBootstrap] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    siteId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    title: "",
    reason: "",
    notes: "",
    entries: [emptyEntry()],
  });

  const load = useCallback(async () => {
    const [bootstrapResult, plansResult] = await Promise.all([
      getLabourPlanningBootstrap(),
      listLabourPlans(),
    ]);
    if (bootstrapResult.ok) setBootstrap(bootstrapResult);
    if (plansResult.ok) setPlans(plansResult.plans);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activePlans = useMemo(
    () =>
      plans.filter(
        (plan) => plan.status === "APPROVED" || plan.status === "SUBMITTED",
      ),
    [plans],
  );
  const totals = useMemo(
    () => ({
      planned: activePlans.reduce(
        (total, plan) => total + plan.plannedPeople,
        0,
      ),
      actual: activePlans.reduce(
        (total, plan) => total + plan.averageActualPeople,
        0,
      ),
      projected: activePlans.reduce(
        (total, plan) => total + plan.projectedCost,
        0,
      ),
    }),
    [activePlans],
  );

  const updateEntry = (index: number, patch: Partial<TeamEntry>) => {
    setForm((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const dates = dateRange(form.startDate, form.endDate);
    if (!dates.length) {
      setMessage("Enter a valid date range.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const result = await createLabourPlan({
      siteId: form.siteId,
      title: form.title,
      reason: form.reason,
      notes: form.notes,
      teams: form.entries.map((entry) => ({
        teamCode: entry.teamCode,
        foremanId: entry.foremanId,
        overrideSupervisorId: entry.supervisorId || null,
        notes: entry.notes || null,
        days: dates.map((workDate) => ({
          workDate,
          peopleCount: entry.peopleCount,
          expectedOvertime: entry.expectedOvertime,
        })),
      })),
    });
    setSubmitting(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setForm((current) => ({
      ...current,
      title: "",
      reason: "",
      notes: "",
      entries: [emptyEntry()],
    }));
    setShowForm(false);
    setMessage("Labour plan saved as a draft.");
    await load();
  };

  const changeStatus = async (
    planId: string,
    status: "SUBMITTED" | "APPROVED" | "CANCELLED" | "COMPLETED",
  ) => {
    const result = await transitionLabourPlanStatus(planId, status);
    setMessage(result.ok ? `Plan ${status.toLowerCase()}.` : result.error);
    if (result.ok) await load();
  };

  if (loading)
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        Loading labour planning…
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Sites Operations
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Labour Planning</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record management’s staffing plan, then compare it with attendance
            reality.
          </p>
        </div>
        <button
          onClick={() => setShowForm((open) => !open)}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New Labour Plan
        </button>
      </header>

      {message && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          {message}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <Metric
          icon={<Users className="h-4 w-4" />}
          label="Planned Labour"
          value={String(totals.planned)}
          hint="Across submitted and approved plans"
        />
        <Metric
          icon={<CalendarDays className="h-4 w-4" />}
          label="Actual Labour"
          value={String(totals.actual)}
          hint="Average daily attendance"
        />
        <Metric
          icon={<WalletCards className="h-4 w-4" />}
          label="Projected Wages"
          value={money.format(totals.projected)}
          hint="From saved team-rate snapshots"
        />
      </section>

      {showForm && (
        <form
          onSubmit={submit}
          className="rounded-lg border bg-card p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">New Labour Plan</h2>
              <p className="text-sm text-muted-foreground">
                Select a site, then plan one or more teams.
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
              Draft
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="From Date">
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  setForm({ ...form, startDate: event.target.value })
                }
              />
            </Field>
            <Field label="To Date">
              <input
                required
                type="date"
                min={form.startDate}
                value={form.endDate}
                onChange={(event) =>
                  setForm({ ...form, endDate: event.target.value })
                }
              />
            </Field>
            <Field label="Site">
              <select
                required
                value={form.siteId}
                onChange={(event) =>
                  setForm({ ...form, siteId: event.target.value })
                }
              >
                <option value="">Select site</option>
                {bootstrap?.sites.map((site: any) => (
                  <option key={site.id} value={site.id}>
                    {site.code ? `${site.code} — ` : ""}
                    {site.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Plan Title">
              <input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
                placeholder="Programme catch-up"
              />
            </Field>
            <Field label="Reason">
              <input
                value={form.reason}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
                placeholder="Why is this labour needed?"
              />
            </Field>
            <Field label="Notes">
              <input
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
                placeholder="Optional notes"
              />
            </Field>
          </div>
          <div className="mt-5 border-t pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium">Planned Teams</h3>
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, entries: [...form.entries, emptyEntry()] })
                }
                className="text-sm font-medium text-primary"
              >
                + Add Team
              </button>
            </div>
            <div className="space-y-3">
              {form.entries.map((entry, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-7"
                >
                  <Field label="Team">
                    <select
                      required
                      value={entry.teamCode}
                      onChange={(event) =>
                        updateEntry(index, { teamCode: event.target.value })
                      }
                    >
                      <option value="">Select team</option>
                      {bootstrap?.teams.map((team: any) => (
                        <option key={team.code} value={team.code}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="People">
                    <input
                      required
                      min="1"
                      type="number"
                      value={entry.peopleCount}
                      onChange={(event) =>
                        updateEntry(index, {
                          peopleCount: Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Foreman">
                    <select
                      required
                      value={entry.foremanId}
                      onChange={(event) =>
                        updateEntry(index, { foremanId: event.target.value })
                      }
                    >
                      <option value="">Select foreman</option>
                      {bootstrap?.foremen
                        .filter(
                          (foreman: any) =>
                            !entry.teamCode ||
                            foreman.defaultTeam === entry.teamCode,
                        )
                        .map((foreman: any) => (
                          <option key={foreman.id} value={foreman.id}>
                            {foreman.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Supervisor">
                    <select
                      value={entry.supervisorId}
                      onChange={(event) =>
                        updateEntry(index, { supervisorId: event.target.value })
                      }
                    >
                      <option value="">Unassigned</option>
                      {bootstrap?.supervisors.map((supervisor: any) => (
                        <option key={supervisor.id} value={supervisor.id}>
                          {supervisor.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Overtime">
                    <label className="flex h-9 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={entry.expectedOvertime}
                        onChange={(event) =>
                          updateEntry(index, {
                            expectedOvertime: event.target.checked,
                          })
                        }
                      />{" "}
                      Expected
                    </label>
                  </Field>
                  <div className="flex items-end">
                    {form.entries.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            entries: form.entries.filter(
                              (_, entryIndex) => entryIndex !== index,
                            ),
                          })
                        }
                        className="h-9 rounded-md border px-3 text-sm text-destructive"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-9 rounded-md border px-3 text-sm"
            >
              Cancel
            </button>
            <button
              disabled={submitting}
              className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {submitting ? "Saving…" : "Save Draft"}
            </button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b px-5 py-3">
          <h2 className="font-semibold">Labour Plans</h2>
        </div>
        {plans.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No labour plans yet. Create a draft to record the expected teams and
            labour cost.
          </div>
        ) : (
          <div className="divide-y">
            {plans.map((plan) => (
              <article key={plan.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {plan.site.code ? `${plan.site.code} — ` : ""}
                        {plan.site.name}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[plan.status]}`}
                      >
                        {plan.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(plan.startDate).toLocaleDateString("en-ZA", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      –{" "}
                      {new Date(plan.endDate).toLocaleDateString("en-ZA", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {plan.reason ? ` · ${plan.reason}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {money.format(plan.projectedCost)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Projected wages
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-4">
                  <Stat
                    label="Planned"
                    value={`${plan.plannedPeople} people`}
                  />
                  <Stat
                    label="Actual"
                    value={`${plan.averageActualPeople} average/day`}
                  />
                  <Stat
                    label="Variance"
                    value={`${plan.averageActualPeople - plan.plannedPeople >= 0 ? "+" : ""}${plan.averageActualPeople - plan.plannedPeople}`}
                  />
                  <div className="flex items-end gap-2">
                    {plan.status === "DRAFT" && (
                      <Action
                        icon={<Send className="h-3.5 w-3.5" />}
                        label="Submit"
                        onClick={() => void changeStatus(plan.id, "SUBMITTED")}
                      />
                    )}
                    {plan.status === "SUBMITTED" && (
                      <Action
                        icon={<Check className="h-3.5 w-3.5" />}
                        label="Approve"
                        onClick={() => void changeStatus(plan.id, "APPROVED")}
                      />
                    )}
                    {plan.status === "APPROVED" && (
                      <Action
                        icon={<Flag className="h-3.5 w-3.5" />}
                        label="Complete"
                        onClick={() => void changeStatus(plan.id, "COMPLETED")}
                      />
                    )}
                    {(plan.status === "DRAFT" ||
                      plan.status === "SUBMITTED" ||
                      plan.status === "APPROVED") && (
                      <Action
                        icon={<Ban className="h-3.5 w-3.5" />}
                        label="Cancel"
                        destructive
                        onClick={() => void changeStatus(plan.id, "CANCELLED")}
                      />
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {plan.teams.map((team: any) => (
                    <span
                      key={team.id}
                      className="rounded-md bg-muted px-2 py-1 text-xs"
                    >
                      {team.teamNameSnapshot}: {team.plannedPeopleDays} ·{" "}
                      {team.foreman?.user?.name ?? "Foreman unassigned"}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <span className="[&>input]:h-9 [&>input]:w-full [&>input]:rounded-md [&>input]:border [&>input]:bg-background [&>input]:px-2 [&>select]:h-9 [&>select]:w-full [&>select]:rounded-md [&>select]:border [&>select]:bg-background [&>select]:px-2">
        {children}
      </span>
    </label>
  );
}
function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
function Action({
  icon,
  label,
  destructive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium ${destructive ? "text-destructive" : ""}`}
    >
      {icon}
      {label}
    </button>
  );
}
