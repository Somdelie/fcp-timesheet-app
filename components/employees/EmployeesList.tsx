import CreateEmployeeForm from "@/components/employees/CreateEmployeeForm";
import EmployeeRowActions from "@/components/employees/EmployeeRowActions";
import { listEmployees } from "@/actions/employees";

function formatMoneyString(s: string) {
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n)) return `R ${s}`;
  return `R ${n.toFixed(2)}`;
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

      {/* List */}
      <div className="rounded-xl border bg-background">
        <div className="border-b p-3 text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {employees.length}
          </span>{" "}
          employees
        </div>

        {employees.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No employees found.
          </div>
        ) : (
          <div className="divide-y">
            {employees.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
              >
                {/* Left */}
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-medium">
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

                  {/* Text */}
                  <div>
                    <div className="font-medium">
                      {e.firstName} {e.lastName}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        Day rate:{" "}
                        <span className="font-medium text-foreground">
                          {formatMoneyString(e.defaultDayRate)}
                        </span>
                      </span>

                      <span className="font-mono text-xs">
                        QR:{" "}
                        <span className="text-foreground">{e.qrCodeValue}</span>
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                      Added {new Date(e.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Right */}
                <EmployeeRowActions
                  id={e.id}
                  qrCodeValue={e.qrCodeValue}
                  isActive={e.isActive}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
