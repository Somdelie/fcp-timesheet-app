import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getAuth(req: Request) {
  let userId: string | null = null;
  let role: string | null = null;

  const token = getBearer(req);
  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return { userId: null, role: null };
    userId = payload.sub;
    role = payload.role;
  } else {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    userId = user?.id ?? null;
    role = user?.role ?? null;
  }

  return { userId, role };
}

function startOfDayUTC(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid dateISO");
  return d;
}

/**
 * GET /api/app/supervisor/scan-out-pending?dateISO=
 *
 * Employees scanned IN today across every site this supervisor is assigned
 * to, who haven't been scanned out yet - feeds the supervisor face
 * scan-out scanner's team table before any match happens. Cross-site
 * counterpart of GET /api/app/foreman/day/scan-out-pending, scoped by
 * SupervisorSiteAssignment instead of one site/foreman.
 */
export async function GET(req: Request) {
  const { userId, role } = await getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "SUPERVISOR")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!supervisor)
    return NextResponse.json(
      { error: "Supervisor not found" },
      { status: 404 },
    );

  const url = new URL(req.url);
  const dateISO = String(url.searchParams.get("dateISO") ?? "");
  if (!dateISO) {
    return NextResponse.json({ error: "dateISO required" }, { status: 400 });
  }

  let workDate: Date;
  try {
    workDate = startOfDayUTC(dateISO);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Invalid dateISO" },
      { status: 400 },
    );
  }

  const now = new Date();
  const assignments = await prisma.supervisorSiteAssignment.findMany({
    where: {
      supervisorId: supervisor.id,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: { siteId: true },
  });

  const siteIds = Array.from(new Set(assignments.map((a) => a.siteId)));
  if (siteIds.length === 0) {
    return NextResponse.json({ employees: [], totalScannedInToday: 0 });
  }

  const totalScannedInToday = await prisma.attendanceScan.count({
    where: { siteId: { in: siteIds }, workDate, direction: "IN" },
  });

  const scans = await prisma.attendanceScan.findMany({
    where: {
      siteId: { in: siteIds },
      workDate,
      direction: "IN",
      scannedOutAt: null,
    },
    orderBy: { scannedAt: "asc" },
    select: { employeeId: true, scannedAt: true },
  });

  const employeeIds = Array.from(new Set(scans.map((s) => s.employeeId)));
  const employees = employeeIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, firstName: true, lastName: true, faceImageUrl: true },
      })
    : [];
  const byId = new Map(employees.map((e) => [e.id, e]));

  const result = scans
    .map((s) => {
      const emp = byId.get(s.employeeId);
      if (!emp) return null;
      return {
        id: s.employeeId,
        fullName: `${emp.firstName} ${emp.lastName}`.trim(),
        faceImageUrl: emp.faceImageUrl ?? null,
        scannedInAtISO: s.scannedAt.toISOString(),
      };
    })
    .filter(
      (e): e is { id: string; fullName: string; faceImageUrl: string | null; scannedInAtISO: string } =>
        e !== null,
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return NextResponse.json({ employees: result, totalScannedInToday });
}
