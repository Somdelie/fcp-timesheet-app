import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { z } from "zod";
import { ensureSiteDayPhotoRequestForSiteDay } from "@/lib/siteDayPhotoRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  siteId: z.string().min(1),
  employeeCodes: z.array(z.string().min(1)).min(1).max(500),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  address: z.string().optional().nullable(),
});

function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeCode(raw: string) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
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
    select: { id: true },
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
  let auth: { userId: string; role: "ADMIN" | "SUPERVISOR" | "FOREMAN" };
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

  // Normalize + de-dupe inside payload
  const normalized = body.data.employeeCodes.map(normalizeCode);
  const invalidCodes = normalized.filter((c) => !isValidEmployeeCode(c));

  const uniqueCodes: string[] = [];
  const seen = new Set<string>();
  for (const c of normalized) {
    if (seen.has(c)) continue;
    seen.add(c);
    uniqueCodes.push(c);
  }

  const validUniqueCodes = uniqueCodes.filter((c) => isValidEmployeeCode(c));

  if (validUniqueCodes.length === 0) {
    return NextResponse.json(
      { error: "No valid employee codes", invalidCodes },
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
    where: { qrCodeValue: { in: validUniqueCodes } },
    select: {
      id: true,
      qrCodeValue: true,
      isActive: true,
      defaultDayRate: true,
      firstName: true,
      lastName: true,
    },
  });

  const byCode = new Map<string, (typeof employees)[number]>();
  for (const e of employees) byCode.set(String(e.qrCodeValue).toUpperCase(), e);

  // Determine rejected (not found / inactive)
  const rejectedCodes: string[] = [];
  const deactivatedEmployees: Array<{
    code: string;
    name: string;
    error: string;
  }> = [];
  const candidateEmployees: Array<{
    code: string;
    empId: string;
    dayRate: any;
  }> = [];

  for (const code of validUniqueCodes) {
    const emp = byCode.get(code);
    if (!emp) {
      rejectedCodes.push(code); // not found
      continue;
    }
    if (!emp.isActive) {
      const fullName = `${emp.firstName} ${emp.lastName}`.trim();
      deactivatedEmployees.push({
        code,
        name: fullName,
        error: `This employee ${fullName} is deactivated. Please contact your supervisor.`,
      });
      continue;
    }
    candidateEmployees.push({
      code,
      empId: emp.id,
      dayRate: emp.defaultDayRate,
    });
  }

  if (candidateEmployees.length === 0) {
    return NextResponse.json({
      ok: true,
      saved: 0,
      duplicates: [],
      invalidCodes,
      rejectedCodes,
      deactivatedEmployees,
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
      duplicates,
      invalidCodes,
      rejectedCodes,
      deactivatedEmployees,
    });
  }

  // Create scans in a transaction
  let saved = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of toCreate) {
        try {
          await tx.attendanceScan.create({
            data: {
              siteDayId: siteDay.id,
              employeeId: item.empId,
              workDate,
              siteId,
              dayRateAtScan: item.dayRate,
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
    duplicates,
    invalidCodes,
    rejectedCodes,
    deactivatedEmployees,
  });
}
