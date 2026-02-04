import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

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

  if (payload.role !== "FOREMAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- params ---
  const url = new URL(req.url);
  const siteId = String(url.searchParams.get("siteId") ?? "");
  const dateISO =
    String(url.searchParams.get("dateISO") ?? "") ||
    String(url.searchParams.get("workDateISO") ?? "");

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

  // --- resolve foreman ---
  const foreman = await prisma.foreman.findUnique({
    where: { userId: payload.sub },
    select: { id: true },
  });

  if (!foreman) {
    return NextResponse.json(
      { error: "Foreman profile missing" },
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

  // --- ensure SiteDay exists (unique on [siteId, workDate]) ---
  const siteDay = await prisma.siteDay.upsert({
    where: { siteId_workDate: { siteId, workDate } },
    update: {},
    create: { siteId, workDate, foremanId: foreman.id },
    select: {
      id: true,
      siteId: true,
      foremanId: true,
      workDate: true,
      isLocked: true,
      readyToSubmit: true,
    },
  });

  // prevent other foreman from viewing/editing this site day
  if (siteDay.foremanId !== foreman.id) {
    return NextResponse.json(
      { error: "This site/day belongs to another foreman" },
      { status: 403 },
    );
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
    },
  });
}
