import Link from "next/link";

import { PayrollTabContent } from "./PayrollTabContent";

const TABS = [
  { value: "quick-view", label: "Timesheet Quick View" },
  { value: "deductions", label: "Deductions" },
  { value: "overtime", label: "Overtime Entries" },
  { value: "prices", label: "Overtime Prices" },
  { value: "transfer", label: "Transfer Employee" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function isTabValue(value: string | undefined): value is TabValue {
  return TABS.some((tab) => tab.value === value);
}

export default async function AdminPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const activeTab = isTabValue(sp?.tab) ? sp.tab : "quick-view";

  return (
    <div className="mx-auto w-full">
      <div className="rounded border border-muted/50 bg-card p-4">
        <div className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/admin/payroll?tab=${tab.value}`}
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
          <PayrollTabContent activeTab={activeTab} />
        </div>
      </div>
    </div>
  );
}
