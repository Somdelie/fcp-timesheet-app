import EmployeesList from "@/components/employees/EmployeesList";

export const revalidate = 300;

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
    <div className="mx-auto flex flex-col min-h-0 max-w-7xl space-y-4">
      <EmployeesList q={q} show={show} />
    </div>
  );
}
