import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { computeDayRateAtScan } from "@/lib/employeeDayRate";
import { ensureSiteDayPhotoRequestForSiteDay } from "@/lib/siteDayPhotoRequest";
import { validateSupervisorScanDate } from "@/lib/supervisorScanPeriod";
import { getBlockedAttendanceScanEmployeeIds } from "@/lib/attendanceScanBlocks";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuth(req: Request) {
  const token = getBearer(req);
  if (!token) return { userId: null, role: null as string | null };
  const payload = await verifyApiToken(token);
  if (!payload) return { userId: null, role: null as string | null };
  return { userId: payload.sub as string, role: payload.role as string };
}

function startOfDayUTCFromISO(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid workDateISO: ${iso}`);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function normalizeEmployeeCode(raw: string) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

async function getOrCreateSiteDay(opts: {
  siteId: string;
  foremanId: string;
  workDate: Date;
}) {
  const existing = await prisma.siteDay.findFirst({
    where: {
      foremanId: opts.foremanId,
      siteId: opts.siteId,
      workDate: opts.workDate,
    },
    select: { id: true, isLocked: true },
  });

  if (existing) return existing;

  try {
    return await prisma.siteDay.create({
      data: {
        site: { connect: { id: opts.siteId } },
        foreman: { connect: { id: opts.foremanId } },
        workDate: opts.workDate,
      },
      select: { id: true, isLocked: true },
    });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e && "code" in e
        ? String((e as any).code)
        : null;
    if (code === "P2002") {
      const again = await prisma.siteDay.findFirst({
        where: {
          foremanId: opts.foremanId,
          siteId: opts.siteId,
          workDate: opts.workDate,
        },
        select: { id: true, isLocked: true },
      });
      if (again) return again;
    }
    throw e;
  }
}

const BodySchema = z.object({
  foremanId: z.string().min(1),
  workDateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeCodes: z.array(z.string().min(1)).min(1).max(500),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  address: z.string().optional().nullable(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId, role } = await getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (role !== "SUPERVISOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: siteId } = await ctx.params;
  if (!siteId)
    return NextResponse.json({ error: "Missing siteId" }, { status: 400 });

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const {
    foremanId,
    workDateISO,
    employeeCodes,
    latitude,
    longitude,
    address,
  } = body.data;

  const selectedDate = await validateSupervisorScanDate(workDateISO);
  if (!selectedDate.ok) {
    return NextResponse.json({ error: selectedDate.error }, { status: 400 });
  }

  const normalizedCodes = employeeCodes.map(normalizeEmployeeCode);
  const invalidCodes = normalizedCodes.filter((c) => !c);
  if (invalidCodes.length > 0) {
    return NextResponse.json(
      { error: "Invalid employee QR value(s)" },
      { status: 400 },
    );
  }

  // De-dupe locally to reduce DB churn
  const uniqueCodes = Array.from(new Set(normalizedCodes));

  // Validate supervisor access to site + foreman
  if (role === "SUPERVISOR") {
    const sup = await prisma.supervisor.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!sup) {
      return NextResponse.json(
        { error: "Supervisor not found" },
        { status: 404 },
      );
    }

    const access = await prisma.supervisorSiteAssignment.findFirst({
      where: {
        supervisorId: sup.id,
        siteId,
        startsOn: { lte: new Date() },
        OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
      },
      select: { id: true },
    });

    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Validate foreman is assigned to the site
  const foremanAssignment = await prisma.foremanSiteAssignment.findFirst({
    where: {
      foremanId,
      siteId,
      startsOn: { lte: new Date() },
      OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
    },
    select: { id: true },
  });

  if (!foremanAssignment) {
    return NextResponse.json(
      { error: "Selected foreman is not assigned to this site" },
      { status: 409 },
    );
  }

  const workDate = startOfDayUTCFromISO(workDateISO);

  const siteDay = await getOrCreateSiteDay({ siteId, foremanId, workDate });
  if (siteDay.isLocked) {
    return NextResponse.json(
      { error: "This site day is locked. No more scans can be added." },
      { status: 409 },
    );
  }

  const employees = await prisma.employee.findMany({
    where: { qrCodeValue: { in: uniqueCodes } },
    select: {
      id: true,
      qrCodeValue: true,
      isActive: true,
      firstName: true,
      lastName: true,
    },
  });

  const byCode = new Map(
    employees.map((e) => [String(e.qrCodeValue).toUpperCase(), e]),
  );

  const blockedEmployees = await getBlockedAttendanceScanEmployeeIds({
    siteId,
    employeeIds: employees.map((employee) => employee.id),
  });

  type ResultStatus =
    | "CREATED"
    | "ALREADY_SCANNED"
    | "UNKNOWN"
    | "INACTIVE"
    | "BLOCKED";
  const results: Array<{
    qrCodeValue: string;
    status: ResultStatus;
    error?: string;
  }> = [];

  // Create scans one-by-one to reuse computeDayRateAtScan
  for (const code of uniqueCodes) {
    const emp = byCode.get(code);
    if (!emp) {
      results.push({ qrCodeValue: code, status: "UNKNOWN" });
      continue;
    }
    if (!emp.isActive) {
      results.push({ qrCodeValue: code, status: "INACTIVE" });
      continue;
    }
    const scanBlock = blockedEmployees.get(emp.id);
    if (scanBlock) {
      results.push({
        qrCodeValue: code,
        status: "BLOCKED",
        error: scanBlock.message,
      });
      continue;
    }

    try {
      const rateResult = await computeDayRateAtScan({
        employeeId: emp.id,
        foremanId,
        siteId,
        workDate,
      });

      await prisma.attendanceScan.create({
        data: {
          siteDay: { connect: { id: siteDay.id } },
          employee: { connect: { id: emp.id } },
          workDate,
          site: { connect: { id: siteId } },
          dayRateAtScan: rateResult.dayRate,
          team: rateResult.team,
          qrPayload: code,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          address: address ?? null,
          scanType: "MANUAL",
          manualReason: "SUPERVISOR",
        },
      });

      results.push({ qrCodeValue: code, status: "CREATED" });
    } catch (e: any) {
      if (e?.code === "P2002") {
        results.push({ qrCodeValue: code, status: "ALREADY_SCANNED" });
        continue;
      }
      return NextResponse.json(
        { error: "Failed to create scans" },
        { status: 500 },
      );
    }
  }

  // Ensure there is a photo request for this SiteDay if any scans were created
  if (results.some((r) => r.status === "CREATED")) {
    try {
      await ensureSiteDayPhotoRequestForSiteDay(siteDay.id);
    } catch (e) {
      console.error(
        "Failed to ensure SiteDayPhotoRequest for supervisor scan-bulk",
        e,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    siteDayId: siteDay.id,
    results,
  });
}
