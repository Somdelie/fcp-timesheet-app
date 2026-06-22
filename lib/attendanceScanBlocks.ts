import { prisma } from "@/lib/prisma";

type ScanBlockRule = {
  siteId: string;
  siteCode: string;
  employeeId: string;
  employeeQrCode: string;
  employeeFirstName: string;
  employeeLastName: string;
  message: string;
};

export type AttendanceScanBlock = {
  employeeId: string;
  employeeName: string;
  message: string;
};

const SCAN_BLOCKS: ScanBlockRule[] = [
  {
    siteId: "cmmf811js003lv4plx1jz0idd",
    siteCode: "6658",
    employeeId: "cmml52nl600c2moplmffqflw3",
    employeeQrCode: "EMP-B4B17ED73FD4F7D7",
    employeeFirstName: "Bambo",
    employeeLastName: "Ndlovu",
    message: "Bambo Ndlovu is blocked from scanning at 6658 - CHAMBERLAIN EASTRAND.",
  },
];

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesEmployee(
  rule: ScanBlockRule,
  employee: {
    id: string;
    qrCodeValue: string | null;
    firstName: string;
    lastName: string;
  },
) {
  const firstName = normalize(employee.firstName);
  const lastName = normalize(employee.lastName);

  return (
    employee.id === rule.employeeId ||
    employee.qrCodeValue === rule.employeeQrCode ||
    (firstName === normalize(rule.employeeFirstName) &&
      lastName === normalize(rule.employeeLastName))
  );
}

export async function getBlockedAttendanceScanEmployeeIds(input: {
  siteId: string;
  employeeIds: string[];
}) {
  const uniqueEmployeeIds = Array.from(new Set(input.employeeIds));
  if (!input.siteId || uniqueEmployeeIds.length === 0) {
    return new Map<string, AttendanceScanBlock>();
  }

  const site = await prisma.site.findUnique({
    where: { id: input.siteId },
    select: { id: true, code: true, name: true },
  });
  if (!site) return new Map<string, AttendanceScanBlock>();

  const relevantRules = SCAN_BLOCKS.filter(
    (rule) => site.id === rule.siteId || site.code === rule.siteCode,
  );
  if (relevantRules.length === 0) {
    return new Map<string, AttendanceScanBlock>();
  }

  const employees = await prisma.employee.findMany({
    where: { id: { in: uniqueEmployeeIds } },
    select: {
      id: true,
      qrCodeValue: true,
      firstName: true,
      lastName: true,
    },
  });

  const blocked = new Map<string, AttendanceScanBlock>();
  for (const employee of employees) {
    const rule = relevantRules.find((item) => matchesEmployee(item, employee));
    if (!rule) continue;

    blocked.set(employee.id, {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      message: rule.message,
    });
  }

  return blocked;
}

export async function getAttendanceScanBlock(input: {
  siteId: string;
  employeeId: string;
}) {
  const blocked = await getBlockedAttendanceScanEmployeeIds({
    siteId: input.siteId,
    employeeIds: [input.employeeId],
  });
  return blocked.get(input.employeeId) ?? null;
}
