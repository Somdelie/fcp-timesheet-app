import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { computeDayRateAtScan } from "@/lib/employeeDayRate";
import { z } from "zod";
import { ensureSiteDayPhotoRequestForSiteDay } from "@/lib/siteDayPhotoRequest";
import { getBlockedAttendanceScanEmployeeIds } from "@/lib/attendanceScanBlocks";
import { joburgTodayISO, startOfDayUTC } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ScanPayloadItem = z.object({
  cardNumber: z.string().min(1),
  rawName: z.string().optional().nullable(),
  scanTime: z.string().optional().nullable(),
});

const BodySchema = z
  .object({
    siteId: z.string().min(1),
    employeeCodes: z.array(z.string().min(1)).optional(),
    scans: z.array(ScanPayloadItem).optional(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    address: z.string().optional().nullable(),
  })
  .refine(
    (data) =>
      (data.employeeCodes?.length ?? 0) > 0 || (data.scans?.length ?? 0) > 0,
    { message: "No scans submitted", path: ["employeeCodes"] },
  );

function normalizeCode(raw: string) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
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
    select: { id: true },
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
      select: { id: true },
    });
  } catch (e: any) {
    // if race condition, fetch again
    if (e?.code === "P2002") {
      const again = await prisma.siteDay.findFirst({
        where: {
          foremanId: opts.foremanId,
          workDate: opts.workDate,
        },
        select: { id: true },
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
  let auth: {
    userId: string;
    role: "ADMIN" | "OFFICE" | "SUPERVISOR" | "FOREMAN";
  };
  try {
    auth = await requireServerAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.role !== "FOREMAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const siteId = body.data.siteId;

  const scanItems = [
    ...(body.data.employeeCodes ?? []).map((code) => ({
      cardNumber: code,
      rawName: null as string | null,
      scanTime: null as string | null,
    })),
    ...(body.data.scans ?? []),
  ]
    .map((item) => ({
      cardNumber: normalizeCode(item.cardNumber),
      rawName: item.rawName?.trim() || null,
      scanTime: item.scanTime ? new Date(item.scanTime) : new Date(),
    }))
    .filter((item) => item.cardNumber.length > 0);

  if (scanItems.length === 0) {
    return NextResponse.json(
      { error: "No valid scan codes submitted" },
      { status: 400 },
    );
  }

  const uniqueCodes = Array.from(
    new Set(scanItems.map((item) => item.cardNumber)),
  );

  const assigned = await ensureForemanAssignedToSite({
    userId: auth.userId,
    siteId,
  });

  if (!assigned.ok) {
    return NextResponse.json({ error: assigned.error }, { status: 403 });
  }

  const workDate = startOfDayUTC(joburgTodayISO());

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

  // Fetch employees for these QR codes in one query
  const employees = await prisma.employee.findMany({
    where: { qrCodeValue: { in: uniqueCodes } },
    select: {
      id: true,
      qrCodeValue: true,
      isActive: true,
      firstName: true,
      lastName: true,
      userId: true,
    },
  });

  const byCode = new Map<string, (typeof employees)[number]>();
  for (const e of employees) byCode.set(String(e.qrCodeValue).toUpperCase(), e);

  const blockedEmployees = await getBlockedAttendanceScanEmployeeIds({
    siteId,
    employeeIds: employees.map((employee) => employee.id),
  });

  // Determine rejected (not found / inactive) and save unmatched scans
  const rejectedCodes: string[] = [];
  const blockedEmployeeScans: Array<{
    code: string;
    name: string;
    error: string;
  }> = [];
  const deactivatedEmployees: Array<{
    code: string;
    name: string;
    error: string;
  }> = [];
  const candidateEmployees: Array<{
    code: string;
    empId: string;
  }> = [];
  const unmatchedItems: Array<{
    cardNumber: string;
    rawName: string | null;
    scanTime: Date;
  }> = [];

  for (const scan of scanItems) {
    const emp = byCode.get(scan.cardNumber);
    if (!emp) {
      rejectedCodes.push(scan.cardNumber);
      unmatchedItems.push({
        cardNumber: scan.cardNumber,
        rawName: scan.rawName,
        scanTime: scan.scanTime,
      });
      continue;
    }
    if (!emp.isActive) {
      const fullName = `${emp.firstName} ${emp.lastName}`.trim();
      deactivatedEmployees.push({
        code: scan.cardNumber,
        name: fullName,
        error: `${fullName} is deactivated. Please contact your supervisor.`,
      });
      continue;
    }
    const scanBlock = blockedEmployees.get(emp.id);
    if (scanBlock) {
      blockedEmployeeScans.push({
        code: scan.cardNumber,
        name: scanBlock.employeeName,
        error: scanBlock.message,
      });
      continue;
    }

    if (!candidateEmployees.some((item) => item.empId === emp.id)) {
      candidateEmployees.push({
        code: scan.cardNumber,
        empId: emp.id,
      });
    }
  }

  if (candidateEmployees.length === 0) {
    return NextResponse.json({
      ok: true,
      saved: 0,
      unmatchedSaved: unmatchedItems.length,
      duplicates: [],
      rejectedCodes,
      unmatchedCodes: unmatchedItems.map((item) => item.cardNumber),
      deactivatedEmployees,
      blockedEmployeeScans,
    });
  }

  // Pre-check duplicates (already scanned today anywhere)
  const existing = await prisma.attendanceScan.findMany({
    where: {
      workDate,
      employeeId: { in: candidateEmployees.map((x) => x.empId) },
    },
    select: { employeeId: true },
  });

  const already = new Set(existing.map((x) => x.employeeId));
  const duplicates: string[] = [];
  const toCreate = candidateEmployees.filter((x) => {
    if (already.has(x.empId)) {
      duplicates.push(x.code);
      return false;
    }
    return true;
  });

  if (toCreate.length === 0) {
    return NextResponse.json({
      ok: true,
      saved: 0,
      unmatchedSaved: unmatchedItems.length,
      duplicates,
      rejectedCodes,
      unmatchedCodes: unmatchedItems.map((item) => item.cardNumber),
      deactivatedEmployees,
      blockedEmployeeScans,
    });
  }

  // Resolve effective day rates for all employees in parallel using the full
  // priority chain (includes team-based rates like Cape Town).
  const rateResults = await Promise.all(
    toCreate.map((item) =>
      computeDayRateAtScan({
        employeeId: item.empId,
        foremanId: assigned.foremanId,
        siteId,
        workDate,
      }),
    ),
  );

  // Create scans and unmatched card records in a transaction
  let saved = 0;
  let unmatchedSaved = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of unmatchedItems) {
        await tx.attendanceCardScan.create({
          data: {
            cardNumber: item.cardNumber,
            status: "UNMATCHED",
            rawName: item.rawName,
            scanTime: item.scanTime,
            site: { connect: { id: siteId } },
          },
        });
        unmatchedSaved += 1;
      }

      for (let i = 0; i < toCreate.length; i++) {
        const item = toCreate[i];
        const rateResult = rateResults[i];
        try {
          await tx.attendanceScan.create({
            data: {
              siteDay: { connect: { id: siteDay.id } },
              employee: { connect: { id: item.empId } },
              workDate,
              site: { connect: { id: siteId } },
              dayRateAtScan: rateResult.dayRate,
              team: rateResult.team,
              qrPayload: item.code,
              latitude: body.data.latitude ?? null,
              longitude: body.data.longitude ?? null,
              address: body.data.address ?? null,
            },
          });
          saved += 1;
        } catch (e: any) {
          // safety net: if something raced in, treat as duplicate
          if (e?.code === "P2002") {
            duplicates.push(item.code);
            continue;
          }
          throw e;
        }
      }
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to save batch" },
      { status: 500 },
    );
  }

  // If any scans were created, best-effort ensure a photo request exists
  if (saved > 0) {
    try {
      await ensureSiteDayPhotoRequestForSiteDay(siteDay.id);
    } catch (e) {
      console.error(
        "Failed to ensure SiteDayPhotoRequest for scan-bulk attendance",
        e,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    saved,
    unmatchedSaved,
    duplicates,
    rejectedCodes,
    unmatchedCodes: unmatchedItems.map((item) => item.cardNumber),
    deactivatedEmployees,
    blockedEmployeeScans,
  });
}
