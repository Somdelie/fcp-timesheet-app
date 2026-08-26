import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { resolveActingForeman } from "@/lib/resolveActingForeman";
import { resolveForemanSiteDays } from "@/lib/resolveForemanSiteDays";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDayUTC(dateISO: string) {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid dateISO");
  return d;
}

/**
 * GET /api/app/foreman/day/scan-out-pending?dateISO=&siteId=
 *
 * Employees scanned IN today who haven't been scanned out yet — feeds the
 * "Scan Out (Face)" screen's employee list. Same auth/site-day resolution
 * as GET /api/app/foreman/day, but scoped to direction: IN, scannedOutAt:
 * null, and returns real names (that route's `scans` still fakes
 * `fullName` from the QR code — left alone here, out of scope).
 *
 * siteId is optional: a real foreman scanning out from one site passes it
 * as before. An assistant scanning out on a foreman's behalf (see
 * resolveActingForeman) omits it, and the pending list spans every site
 * that foreman is currently assigned to instead — same auto-detect trade
 * as scan-out-identify below.
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
  const siteIdParam = url.searchParams.get("siteId");
  const siteId = siteIdParam && siteIdParam.trim() ? siteIdParam.trim() : null;
  const dateISO = String(url.searchParams.get("dateISO") ?? "");
  const forForemanId =
    url.searchParams.get("forForemanId") ||
    req.headers.get("x-acting-foreman-id")?.trim() ||
    null;

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

  const resolved = await resolveActingForeman(payload.sub, forForemanId);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }
  const actingForemanId = resolved.foremanId!;

  const siteDays = await resolveForemanSiteDays(actingForemanId, siteId, workDate);
  if ("error" in siteDays) {
    return NextResponse.json({ error: siteDays.error }, { status: siteDays.status });
  }
  if (siteDays.length === 0) {
    return NextResponse.json({ employees: [], totalScannedInToday: 0 });
  }

  const siteDayIds = siteDays.map((d) => d.id);
  const siteNameBySiteDayId = new Map(siteDays.map((d) => [d.id, d.site.name]));

  const totalScannedInToday = await prisma.attendanceScan.count({
    where: { siteDayId: { in: siteDayIds }, direction: "IN" },
  });

  const scans = await prisma.attendanceScan.findMany({
    where: { siteDayId: { in: siteDayIds }, direction: "IN", scannedOutAt: null },
    orderBy: { scannedAt: "asc" },
    select: { employeeId: true, scannedAt: true, siteDayId: true },
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
        siteName: siteNameBySiteDayId.get(s.siteDayId) ?? null,
      };
    })
    .filter(
      (
        e,
      ): e is {
        id: string;
        fullName: string;
        faceImageUrl: string | null;
        scannedInAtISO: string;
        siteName: string | null;
      } => e !== null,
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return NextResponse.json({ employees: result, totalScannedInToday });
}
