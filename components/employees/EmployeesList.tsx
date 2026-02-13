import CreateEmployeeForm from "@/components/employees/CreateEmployeeForm";
import EmployeesTable from "@/components/employees/EmployeesTable";
import { listEmployees } from "@/actions/employees";

export default async function EmployeesList({
  q,
  show = "active",
}: {
  q?: string;
  show?: "active" | "all";
}) {
  const res = await listEmployees({
    q,
    show,
  });

  if (!res.ok) {
    return (
      <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
        Failed to load employees
      </div>
    );
  }

  const employees = res.employees;

  return (
    <div className="space-y-4 ">
      {/* Header row */}
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Workers visible to you based on your role.
          </p>
        </div>
        <CreateEmployeeForm />
      </div>

      {/* Empty state */}
      {employees.length === 0 ? (
        <div className="border border-dashed border-zinc-300 bg-white/50 p-12 text-center dark:border-zinc-700/50 dark:bg-card/30">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            No employees found
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Adjust your filters or add a new employee.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto w-full">
          <EmployeesTable data={employees} />
        </div>
      )}
    </div>
  );
}
