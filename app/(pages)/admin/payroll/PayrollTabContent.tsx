"use client";

import { useEffect, useState } from "react";

import OvertimePage from "@/app/(pages)/admin/overtime/page";
import OvertimePricesPage from "@/app/(pages)/admin/overtime-prices/page";
import DeductionsPage from "@/app/(pages)/admin/deductions/page";
import TimesheetPrintPage from "@/app/(pages)/admin/timesheet-print/page";

type PayrollTabValue = "quick-view" | "deductions" | "overtime" | "prices";

export function PayrollTabContent({ activeTab }: { activeTab: PayrollTabValue }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-40" />;
  }

  return (
    <>
      {activeTab === "quick-view" ? <TimesheetPrintPage /> : null}
      {activeTab === "deductions" ? <DeductionsPage /> : null}
      {activeTab === "overtime" ? <OvertimePage /> : null}
      {activeTab === "prices" ? <OvertimePricesPage /> : null}
    </>
  );
}
