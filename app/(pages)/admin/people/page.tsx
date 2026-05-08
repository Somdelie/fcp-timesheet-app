import Link from "next/link";

import EmployeesPage from "@/app/(pages)/employees/page";
import ForemanPage from "@/app/(pages)/foreman/page";
import UsersPage from "@/app/(pages)/users/page";
import AdminSupervisorsPage from "@/app/(pages)/admin/supervisors/page";
import AdminTransferEmployeePage from "@/app/(pages)/admin/transfer-employee/page";

const TABS = [
  { value: "employees", label: "Employees" },
  { value: "foremen", label: "Foremen" },
  { value: "users", label: "User Management" },
  { value: "supervisors", label: "Supervisors" },
  { value: "transfer", label: "Transfer Employee" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function isTabValue(value: string | undefined): value is TabValue {
  return TABS.some((tab) => tab.value === value);
}

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; show?: string }>;
}) {
  const sp = await searchParams;
  const activeTab = isTabValue(sp?.tab) ? sp.tab : "employees";

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* <div>
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Manage employees, foremen, users, supervisors and employee transfers.
        </p>
      </div> */}

      <div className="rounded border border-muted/50 bg-card p-4">
        <div className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/admin/people?tab=${tab.value}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === "employees" ? (
            <EmployeesPage
              searchParams={Promise.resolve({ q: sp?.q, show: sp?.show })}
            />
          ) : null}
          {activeTab === "foremen" ? <ForemanPage /> : null}
          {activeTab === "users" ? <UsersPage /> : null}
          {activeTab === "supervisors" ? <AdminSupervisorsPage /> : null}
          {activeTab === "transfer" ? <AdminTransferEmployeePage /> : null}
        </div>
      </div>
    </div>
  );
}
