import CreateEmployeeForm from "@/components/employees/CreateEmployeeForm";
import EmployeeRowActions from "@/components/employees/EmployeeRowActions";
import { listEmployees } from "@/actions/employees";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatMoneyString(s: string) {
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n)) return `R ${s}`;
  return `R ${n.toFixed(2)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function EmployeesList({
  q,
  show = "active",
}: {
  q?: string;
  show?: "active" | "all";
}) {
  const res = await listEmployees({ q, show });

  if (!res.ok) {
    return (
      <div className="rounded-md border p-4 text-sm text-red-600">
        Failed to load employees
      </div>
    );
  }

  const employees = res.employees;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Workers visible to you based on your role.
          </p>
        </div>
        <CreateEmployeeForm />
      </div>

      {/* Table wrapper */}
      {employees.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            No employees found
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Adjust your filters or add a new employee.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-zinc-200/60 bg-white/80 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900/40">
          <div className="border-b p-3 text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {employees.length}
            </span>{" "}
            employees
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Day rate</TableHead>
                  <TableHead>QR code</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-55 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow
                    key={e.id}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/60"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border bg-muted text-[11px] font-medium">
                          {e.faceImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={e.faceImageUrl}
                              alt={`${e.firstName} ${e.lastName}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <>
                              {e.firstName[0]}
                              {e.lastName[0]}
                            </>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-900 dark:text-white">
                            {e.firstName} {e.lastName}
                          </span>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {e.linkedToForemanId && (
                              <Badge variant="secondary" className="text-xs">
                                Assistant
                              </Badge>
                            )}
                            {!e.linkedToForemanId &&
                              (e.createdByRole === "FOREMAN" || e.userId) && (
                                <Badge variant="default" className="text-xs">
                                  Foreman
                                </Badge>
                              )}
                            {!e.linkedToForemanId &&
                              e.createdByRole !== "FOREMAN" &&
                              !e.userId && (
                                <Badge variant="secondary" className="text-xs">
                                  Individual
                                </Badge>
                              )}
                            {!e.isActive && (
                              <Badge variant="destructive" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-zinc-800 dark:text-zinc-200">
                        {e.defaultDayRate
                          ? formatMoneyString(e.defaultDayRate)
                          : "Company default"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-zinc-800 dark:text-zinc-300">
                        {e.qrCodeValue}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-zinc-700 dark:text-zinc-300">
                        {formatDate(e.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <EmployeeRowActions
                        id={e.id}
                        qrCodeValue={e.qrCodeValue}
                        isActive={e.isActive}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
