import EmployeesList from "@/components/employees/EmployeesList";

interface EmployeesPageProps {
  searchParams?: {
    q?: string;
    show?: string;
  };
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; show?: string }>;
}) {
  const sp = await searchParams;
  const q = sp?.q ?? "";
  const show = sp?.show === "all" ? "all" : "active";

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6 space-y-4">
      <form
        method="get"
        className="flex flex-col gap-2 md:flex-row md:items-end"
      >
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Search</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name or QR..."
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2"
          />
        </div>

        <div className="min-w-35">
          <label className="text-xs text-muted-foreground">Show</label>
          <select
            name="show"
            defaultValue={show}
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="active">Active</option>
            <option value="all">All</option>
          </select>
        </div>

        <button className="h-10 rounded-md border px-4 text-sm hover:bg-muted">
          Filter
        </button>
      </form>

      <EmployeesList q={q} show={show} />
    </div>
  );
}
