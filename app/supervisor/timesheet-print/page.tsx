import TimesheetQuickViewClient from "@/components/timesheets/TimesheetQuickViewClient";

export const dynamic = "force-dynamic";

export default function SupervisorTimesheetPrintPublicPage() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <TimesheetQuickViewClient />
    </div>
  );
}
