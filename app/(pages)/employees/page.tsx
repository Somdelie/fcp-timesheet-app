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
    <div className="mx-auto max-w-7xl space-y-4 overflow-hidden">
      <EmployeesList q={q} show={show} />
    </div>
  );
}
