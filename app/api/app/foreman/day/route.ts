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

export async function GET(req: Request) {
  // --- auth ---
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  // Allow FOREMAN and EMPLOYEE roles - assistants are employees who can act for foremen
  if (payload.role !== "FOREMAN" && payload.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- params ---
  const url = new URL(req.url);
  const siteId = String(url.searchParams.get("siteId") ?? "");
  const dateISO =
    String(url.searchParams.get("dateISO") ?? "") ||
    String(url.searchParams.get("workDateISO") ?? "");
  // Support both query param and header for foreman ID
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

  // --- resolve acting foreman ---
  const resolved = await resolveActingForeman(payload.sub, forForemanId);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  const actingForemanId = resolved.foremanId!;
  const actingMode = resolved.mode;

  // Validate acting foreman is assigned to the site (active ForemanSiteAssignment)
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

  // --- validate site ---
  const site = await prisma.site.findFirst({
    where: { id: siteId, isActive: true },
    select: { id: true, name: true },
  });

  if (!site)
    return NextResponse.json({ error: "Site not found" }, { status: 404 });

  // --- ensure SiteDay exists for this foreman on this site and date ---
  let siteDay = await prisma.siteDay.findFirst({
    where: { foremanId: actingForemanId, siteId, workDate },
    select: {
      id: true,
      siteId: true,
      foremanId: true,
      workDate: true,
      isLocked: true,
      readyToSubmit: true,
    },
  });

  if (!siteDay) {
    siteDay = await prisma.siteDay.create({
      data: {
        site: { connect: { id: siteId } },
        workDate,
        foreman: { connect: { id: actingForemanId } },
      },
      select: {
        id: true,
        siteId: true,
        foremanId: true,
        workDate: true,
        isLocked: true,
        readyToSubmit: true,
      },
    });
  }

  // --- scans (no employee relation in schema, so join manually) ---
  const scans = await prisma.attendanceScan.findMany({
    where: { siteDayId: siteDay.id },
    orderBy: { scannedAt: "desc" },
    select: {
      id: true,
      scannedAt: true,
      employeeId: true,
    },
  });

  const employeeIds = Array.from(new Set(scans.map((s) => s.employeeId)));

  const employees = employeeIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: {
          id: true,
          qrCodeValue: true, // this is your "code"
        },
      })
    : [];

  const byId = new Map(employees.map((e) => [e.id, e]));

  // Load any photo requests for this SiteDay so the foreman can see
  // if a group photo has been requested by admin/supervisor.
  const photoRequests = await prisma.siteDayPhotoRequest.findMany({
    where: { siteDayId: siteDay.id },
    orderBy: { requestedAt: "desc" },
    select: {
      id: true,
      status: true,
      requestedAt: true,
      dueAt: true,
      note: true,
      siteDayPhotos: { select: { id: true } },
    },
  });

  return NextResponse.json({
    day: {
      id: siteDay.id,
      dateISO,
      // these don't exist in DB yet, so return safe defaults
      status: "PENDING",
      flags: 0,
      readyToSubmit: siteDay.readyToSubmit,
      foremanFlagReason: null,
      foremanNote: null,
      site: { id: site.id, name: site.name },
      scans: scans.map((s) => {
        const emp = byId.get(s.employeeId);
        const code = emp?.qrCodeValue ?? "UNKNOWN";
        return {
          id: s.id,
          scannedAt: s.scannedAt.toISOString(),
          employee: {
            id: s.employeeId,
            code, // app expects `code`
            fullName: code, // you don't have a name field proven in schema yet
          },
        };
      }),
      photoRequests: photoRequests.map((r) => ({
        id: r.id,
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
        dueAt: r.dueAt ? r.dueAt.toISOString() : null,
        note: r.note ?? null,
        photoCount: r.siteDayPhotos.length,
      })),
    },
    ...(actingMode === "ASSISTANT" && {
      acting: {
        mode: actingMode,
        foremanId: actingForemanId,
      },
    }),
  });
}
