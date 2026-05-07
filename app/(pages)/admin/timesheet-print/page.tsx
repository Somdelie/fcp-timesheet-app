import TimesheetQuickViewClient from "@/components/timesheets/TimesheetQuickViewClient";

export const dynamic = "force-dynamic";

export default function TimesheetPrintPage() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Timesheet Quick View</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a foreman and fortnight period to view and print the timesheet sheet.
        </p>
      </div>
      <TimesheetQuickViewClient />
    </div>
  );
}
