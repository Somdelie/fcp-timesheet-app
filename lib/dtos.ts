// lib/dtos.ts
export type AdminTimesheetListRow = {
  id: string; // could be prisma Timesheet.id OR periodStart_periodEnd_foremanId (your choice)
  startISO: string;
  endISO: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";

  foreman: { id: string; name: string };
  supervisor?: { id: string; name: string } | null;

  totalWorkerDays?: number | null;
  totalWorkerWages?: number | null;

  sites: Array<{ id: string; code?: string | null; name: string }>; // ✅ important
};

export type SiteMini = { id: string; name: string; code?: string | null };

export type TimesheetColumnDto = {
  iso: string;
  day: string; // Sat Sun Mon...
  date?: string; // optional "01" "02" etc (client can add)
};

export type TimesheetRowDto = {
  employeeId: string;
  fullName: string;
  dayRate: number;
  present: boolean[];
  daysWorked: number;
  pay: number;
};

export type TimesheetDetailDto = {
  id: string;
  startISO: string;
  endISO: string;

  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";

  foreman?: { id: string; name: string } | null;
  supervisor?: { id: string; name: string } | null;

  sites: SiteMini[];
  columns: TimesheetColumnDto[];
  rows: TimesheetRowDto[];
  totals?: { totalDays: number; totalPay: number };
};

export type TimesheetPeriodOption = {
  id: string; // start_end
  startISO: string;
  endISO: string;
};

export type IdName = { id: string; name: string };

export type TimesheetStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";

// lib/dtos.ts

export type TimesheetDetailDto2 = {
  id: string;
  startISO: string;
  endISO: string;

  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";
  submittedAt?: string | null;

  // server sends these objects
  foreman?: { id: string; name: string };
  supervisor?: { id: string; name: string };

  sites?: Array<{ id: string; code?: string | null; name: string }>;

  // UI-friendly derived fields
  foremanName?: string;
  sitesLabel?: string;

  columns: Array<{
    iso: string; // YYYY-MM-DD
    day: string; // Mon/Tue...
    date?: string; // "01".."31" (UI-only; we’ll derive if missing)
  }>;

  rows: Array<{
    employeeId: string;
    fullName: string;
    dayRate: number;
    present: boolean[];
    daysWorked: number;
    pay: number;
    isForeman?: boolean;
  }>;

  totals?: {
    totalDays: number;
    totalPay: number;
  };
};

export type SupervisorTimesheetListRow = {
  id: string;
  startISO: string;
  endISO: string;
  foremanName: string;
  siteCode?: string | null;
  siteName: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";
};
