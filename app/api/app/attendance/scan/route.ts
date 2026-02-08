import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  siteId: z.string().min(1),
  employeeCode: z.string().min(1),
});

function startOfTodayLocal() {
  // Use server local day boundary (fine if server timezone is your ops timezone).
  // If you need SA-specific day boundary, we can force Africa/Johannesburg later.
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeEmployeeCode(raw: string) {
  const t = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return t;
}

function isValidEmployeeCode(code: string) {
  return /^EMP[_-][A-Z0-9]+$/.test(code);
}

async function ensureForemanAssignedToSite(opts: {
  userId: string;
  siteId: string;
}) {
  const foreman = await prisma.foreman.findUnique({
    where: { userId: opts.userId },
    select: { id: true },
  });
  if (!foreman)
    return { ok: false as const, error: "Foreman profile not found." };

  const now = new Date();

  const assignment = await prisma.foremanSiteAssignment.findFirst({
    where: {
      foremanId: foreman.id,
      siteId: opts.siteId,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gte: now } }],
    },
    select: { id: true },
  });

  if (!assignment) {
    return {
      ok: false as const,
      error: "You are not assigned to this site.",
    };
  }

  return { ok: true as const, foremanId: foreman.id };
}

async function getOrCreateSiteDay(opts: {
  siteId: string;
  foremanId: string;
  workDate: Date;
}) {
  // Check if siteDay already exists for this foreman on this date
  const existing = await prisma.siteDay.findFirst({
    where: {
      foremanId: opts.foremanId,
      workDate: opts.workDate,
    },
    select: { id: true, siteId: true, foremanId: true, workDate: true },
  });

  if (existing) {
    return existing;
  }

  // Create new siteDay for this foreman on this date/site
  try {
    return await prisma.siteDay.create({
      data: {
        siteId: opts.siteId,
        foremanId: opts.foremanId,
        workDate: opts.workDate,
      },
      select: { id: true, siteId: true, foremanId: true, workDate: true },
    });
  } catch (e: any) {
    // if race condition, fetch again
    if (e?.code === "P2002") {
      const again = await prisma.siteDay.findFirst({
        where: {
          foremanId: opts.foremanId,
          workDate: opts.workDate,
        },
        select: { id: true, siteId: true, foremanId: true, workDate: true },
      });
      if (again) return again;
    }
    // if foreman already has a day for another site, this hits @@unique([foremanId, workDate])
    if (e?.code === "P2002") {
      throw new Error(
        "You already have an attendance sheet for today on another site.",
      );
    }
    throw e;
  }
}

export async function POST(req: Request) {
  const auth = await requireServerAuth();
  if (auth.role !== "FOREMAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const siteId = body.data.siteId;
  const employeeCode = normalizeEmployeeCode(body.data.employeeCode);

  if (!isValidEmployeeCode(employeeCode)) {
    return NextResponse.json(
      { error: "Invalid employee code" },
      { status: 400 },
    );
  }

  const assigned = await ensureForemanAssignedToSite({
    userId: auth.userId,
    siteId,
  });

  if (!assigned.ok) {
    return NextResponse.json({ error: assigned.error }, { status: 403 });
  }

  const workDate = startOfTodayLocal();

  // Get company default day rate
  const companySetting = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
    select: { defaultEmployeeDayRate: true },
  });
  const defaultRate = companySetting?.defaultEmployeeDayRate;

  const employee = await prisma.employee.findFirst({
    where: { qrCodeValue: employeeCode },
    select: {
      id: true,
      isActive: true,
      defaultDayRate: true,
      firstName: true,
      lastName: true,
      userId: true,
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  if (!employee.isActive) {
    return NextResponse.json(
      { error: "Employee is inactive" },
      { status: 409 },
    );
  }

  // Check if the employee is a foreman - foremen cannot be scanned
  if (employee.userId) {
    const isForeman = await prisma.foreman.findUnique({
      where: { userId: employee.userId },
      select: { id: true },
    });
    if (isForeman) {
      return NextResponse.json(
        { error: "Cannot scan a foreman." },
        { status: 409 },
      );
    }
  }

  const effectiveRate = employee.defaultDayRate || defaultRate;
  if (!effectiveRate) {
    return NextResponse.json(
      { error: "No day rate configured for employee" },
      { status: 400 },
    );
  }

  let siteDay;
  try {
    siteDay = await getOrCreateSiteDay({
      siteId,
      foremanId: assigned.foremanId,
      workDate,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to open site day" },
      { status: 409 },
    );
  }

  // Create scan. Unique constraint prevents double-booking for the day.
  try {
    const scan = await prisma.attendanceScan.create({
      data: {
        siteDayId: siteDay.id,
        employeeId: employee.id,
        workDate,
        siteId,
        dayRateAtScan: effectiveRate,
        qrPayload: employeeCode,
      },
      select: { id: true, scannedAt: true },
    });

    return NextResponse.json({
      ok: true,
      scan: {
        id: scan.id,
        scannedAt: scan.scannedAt.toISOString(),
        employee: {
          id: employee.id,
          fullName: `${employee.firstName} ${employee.lastName}`.trim(),
          code: employeeCode,
        },
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: "Employee already scanned today." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to save scan" }, { status: 500 });
  }
}
