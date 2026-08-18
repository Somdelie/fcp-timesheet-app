import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeDayRateAtScan } from "@/lib/employeeDayRate";
import { requireServerAuth } from "@/lib/auth-server";
import { z } from "zod";
import { ensureSiteDayPhotoRequestForSiteDay } from "@/lib/siteDayPhotoRequest";
import { getAttendanceScanBlock } from "@/lib/attendanceScanBlocks";
import { joburgTodayISO, startOfDayUTC } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  siteId: z.string().min(1),
  employeeCode: z.string().min(1),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  address: z.string().optional().nullable(),
  rawName: z.string().optional().nullable(),
  scanTime: z.string().optional().nullable(),
});

function normalizeEmployeeCode(raw: string) {
  const t = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return t;
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
        site: { connect: { id: opts.siteId } },
        foreman: { connect: { id: opts.foremanId } },
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

  const assigned = await ensureForemanAssignedToSite({
    userId: auth.userId,
    siteId,
  });

  if (!assigned.ok) {
    return NextResponse.json({ error: assigned.error }, { status: 403 });
  }

  const workDate = startOfDayUTC(joburgTodayISO());

  const employee = await prisma.employee.findFirst({
    where: { qrCodeValue: employeeCode },
    select: {
      id: true,
      isActive: true,
      firstName: true,
      lastName: true,
      userId: true,
    },
  });

  if (!employee) {
    const cardScan = await prisma.attendanceCardScan.create({
      data: {
        cardNumber: employeeCode,
        status: "UNMATCHED",
        rawName: body.data.rawName?.trim() || null,
        scanTime: body.data.scanTime
          ? new Date(body.data.scanTime)
          : new Date(),
        site: { connect: { id: siteId } },
      },
      select: {
        id: true,
        cardNumber: true,
        scanTime: true,
        rawName: true,
        siteId: true,
      },
    });

    return NextResponse.json({
      ok: true,
      status: "UNMATCHED",
      scan: {
        id: cardScan.id,
        cardNumber: cardScan.cardNumber,
        scanTime: cardScan.scanTime.toISOString(),
        rawName: cardScan.rawName,
        siteId: cardScan.siteId,
      },
    });
  }
  if (!employee.isActive) {
    const fullName = `${employee.firstName} ${employee.lastName}`.trim();
    return NextResponse.json(
      {
        error: `${fullName} is deactivated. Please contact your supervisor.`,
      },
      { status: 409 },
    );
  }

  const scanBlock = await getAttendanceScanBlock({
    siteId,
    employeeId: employee.id,
  });
  if (scanBlock) {
    return NextResponse.json({ error: scanBlock.message }, { status: 409 });
  }

  const rateResult = await computeDayRateAtScan({
    employeeId: employee.id,
    foremanId: assigned.foremanId,
    siteId,
    workDate,
  });

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
        siteDay: { connect: { id: siteDay.id } },
        employee: { connect: { id: employee.id } },
        workDate,
        site: { connect: { id: siteId } },
        dayRateAtScan: rateResult.dayRate,
        team: rateResult.team,
        qrPayload: employeeCode,
        latitude: body.data.latitude ?? null,
        longitude: body.data.longitude ?? null,
        address: body.data.address ?? null,
      },
      select: { id: true, scannedAt: true },
    });

    // Best-effort: ensure there is a photo request for this SiteDay
    try {
      await ensureSiteDayPhotoRequestForSiteDay(siteDay.id);
    } catch (e) {
      console.error("Failed to ensure SiteDayPhotoRequest for scan", e);
    }

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
