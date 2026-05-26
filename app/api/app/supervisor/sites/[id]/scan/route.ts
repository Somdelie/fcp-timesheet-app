import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { computeDayRateAtScan } from "@/lib/employeeDayRate";
import { ensureSiteDayPhotoRequestForSiteDay } from "@/lib/siteDayPhotoRequest";
import { validateSupervisorScanDate } from "@/lib/supervisorScanPeriod";
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
  employeeCode: z.string().min(1),
  workDateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

  const { foremanId, employeeCode, workDateISO, latitude, longitude, address } =
    body.data;

  if (role === "SUPERVISOR") {
    const selectedDate = await validateSupervisorScanDate(workDateISO);
    if (!selectedDate.ok) {
      return NextResponse.json({ error: selectedDate.error }, { status: 400 });
    }
  }

  const normalizedCode = normalizeEmployeeCode(employeeCode);
  if (!normalizedCode) {
    return NextResponse.json(
      { error: "Invalid employee QR value" },
      { status: 400 },
    );
  }

  // Validate supervisor access to site (if SUPERVISOR)
  if (role === "SUPERVISOR") {
    const sup = await prisma.supervisor.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!sup)
      return NextResponse.json(
        { error: "Supervisor not found" },
        { status: 404 },
      );

    const access = await prisma.supervisorSiteAssignment.findFirst({
      where: {
        supervisorId: sup.id,
        siteId,
        startsOn: { lte: new Date() },
        OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
      },
      select: { id: true },
    });

    if (!access)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Validate selected foreman is linked to this supervisor
    const supForeman = await prisma.supervisorForeman.findFirst({
      where: {
        supervisorId: sup.id,
        foremanId,
        startsOn: { lte: new Date() },
        OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
      },
      select: { foremanId: true },
    });

    if (!supForeman) {
      return NextResponse.json(
        { error: "Selected foreman is not under this supervisor" },
        { status: 403 },
      );
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
  const now = new Date();

  const employee = await prisma.employee.findFirst({
    where: { qrCodeValue: normalizedCode },
    select: {
      id: true,
      isActive: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
    },
  });

  if (!employee)
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (!employee.isActive) {
    return NextResponse.json(
      {
        error: `This employee ${employee.firstName} ${employee.lastName} is deactivated.`,
      },
      { status: 409 },
    );
  }

  const rateResult = await computeDayRateAtScan({
    employeeId: employee.id,
    foremanId,
    siteId,
    workDate,
  });

  let siteDay: { id: string; isLocked: boolean };
  try {
    siteDay = await getOrCreateSiteDay({ siteId, foremanId, workDate });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to open site day" },
      { status: 409 },
    );
  }
  if (siteDay.isLocked) {
    return NextResponse.json(
      { error: "This site day is locked. No more scans can be added." },
      { status: 409 },
    );
  }

  try {
    const scan = await prisma.attendanceScan.create({
      data: {
        siteDay: { connect: { id: siteDay.id } },
        employee: { connect: { id: employee.id } },
        workDate,
        site: { connect: { id: siteId } },
        dayRateAtScan: rateResult.dayRate,
        team: rateResult.team,
        qrPayload: normalizedCode,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        address: address ?? null,
        scanType: "MANUAL",
        manualReason: "SUPERVISOR",
        // direction defaults to IN
      },
      select: {
        id: true,
        scannedAt: true,
      },
    });

    // Ensure there is a photo request for this site day (best-effort)
    try {
      await ensureSiteDayPhotoRequestForSiteDay(siteDay.id);
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      scan: {
        id: scan.id,
        scannedAtISO: scan.scannedAt.toISOString(),
        employee: {
          id: employee.id,
          fullName: `${employee.firstName} ${employee.lastName}`.trim(),
          code: normalizedCode,
        },
        siteDayId: siteDay.id,
        workDateISO,
      },
      meta: {
        createdAt: now.toISOString(),
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
