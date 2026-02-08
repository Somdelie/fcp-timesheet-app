export type TimesheetGridColumn = {
  iso: string; // "2026-02-07"
  dayLabel: string; // "Sat"
  dateLabel: string; // "07"
};

export type TimesheetGridRow = {
  id: string; // employeeId (or any stable id)
  label: string; // full name
  dayRate?: number; // optional
  present: boolean[]; // length === columns.length
  daysWorked: number;
  pay: number;

  // optional “grouping” (lets you highlight foreman row, assistants, etc)
  kind?: "FOREMAN" | "WORKER" | "OTHER";
};

export type TimesheetGridModel = {
  columns: Array<{
    iso: string;
    dayLabel: string;
    dateLabel: string;
  }>;

  rows: Array<{
    id: string;
    label: string;
    dayRate: number;
    present: boolean[];
    daysWorked: number;
    pay: number;

    // ✅ add this
    isForeman?: boolean;
  }>;

  totals: {
    totalDays: number;
    totalPay: number;

    // ✅ add these
    foremanDays: number;
    foremanPay: number;
    teamDays: number;
    teamPay: number;
  };

  // ✅ add this
  foremanName?: string;
};
