import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { resolveActingForeman } from "@/lib/resolveActingForeman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDayUTC(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid dateISO");
  return d;
}

/**
 * GET /api/app/foreman/day/scan-out-pending?siteId=&dateISO=
 *
 * Employees scanned IN today at this site who haven't been scanned out yet
 * — feeds the "Scan Out (Face)" screen's employee list. Same auth/site-day
 * resolution as GET /api/app/foreman/day, but scoped to direction: IN,
 * scannedOutAt: null, and returns real names (that route's `scans` still
 * fakes `fullName` from the QR code — left alone here, out of scope).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  if (payload.role !== "FOREMAN" && payload.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const siteId = String(url.searchParams.get("siteId") ?? "");
  const dateISO = String(url.searchParams.get("dateISO") ?? "");
  const forForemanId =
    url.searchParams.get("forForemanId") ||
    req.headers.get("x-acting-foreman-id")?.trim() ||
    null;

  if (!siteId || !dateISO) {
    return NextResponse.json(
      { error: "siteId and dateISO required" },
      { status: 400 },
    );
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

  const resolved = await resolveActingForeman(payload.sub, forForemanId);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }
  const actingForemanId = resolved.foremanId!;

  const siteAssignment = await prisma.foremanSiteAssignment.findFirst({
    where: {
      foremanId: actingForemanId,
      siteId,
      startsOn: { lte: new Date() },
      OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (!siteAssignment) {
    return NextResponse.json(
      { error: "You are not assigned to this site." },
      { status: 403 },
    );
  }

  const siteDay = await prisma.siteDay.findFirst({
    where: { foremanId: actingForemanId, siteId, workDate },
    select: { id: true },
  });

  // No SiteDay yet for this foreman/site/date means no one has scanned in —
  // nothing pending, not an error.
  if (!siteDay) {
    return NextResponse.json({ employees: [], totalScannedInToday: 0 });
  }

  const totalScannedInToday = await prisma.attendanceScan.count({
    where: { siteDayId: siteDay.id, direction: "IN" },
  });

  const scans = await prisma.attendanceScan.findMany({
    where: { siteDayId: siteDay.id, direction: "IN", scannedOutAt: null },
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
