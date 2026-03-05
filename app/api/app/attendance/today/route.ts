import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { resolveActingForeman } from "@/lib/resolveActingForeman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function isoDateJoburg(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }); // YYYY-MM-DD
}

function joburgMidnightDate(iso: string) {
  // YYYY-MM-DD -> local midnight (+02:00)
  return new Date(`${iso}T00:00:00+02:00`);
}

export async function GET(req: Request) {
  const token = getBearer(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (payload.role !== "FOREMAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const siteId = url.searchParams.get("siteId")?.trim();
  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }

  // x-acting-foreman-id is always Foreman.id (used by assistants)
  const actingForemanId =
    req.headers.get("x-acting-foreman-id")?.trim() || null;

  // Resolve whether user is a real foreman or an assistant acting on behalf of a foreman
  const resolved = await resolveActingForeman(payload.sub, actingForemanId);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status },
    );
  }

  const effectiveForemanId = resolved.foremanId!;

  // Must be assigned (active) to the site
  const activeAssign = await prisma.foremanSiteAssignment.findFirst({
    where: {
      foremanId: effectiveForemanId,
      siteId,
      OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
    },
    select: { id: true },
  });

  if (!activeAssign) {
    return NextResponse.json(
      { error: "You are not assigned to this site." },
      { status: 403 },
    );
  }

  const dateISO = isoDateJoburg();
  const workDate = joburgMidnightDate(dateISO);

  // 1) Try load existing day for THIS foreman
  const existing = await prisma.siteDay.findFirst({
    where: { foremanId: effectiveForemanId, workDate },
    select: { id: true, foremanId: true, siteId: true },
  });

  // 2) Create if missing
  let siteDay;
  if (!existing) {
    try {
      siteDay = await prisma.siteDay.create({
        data: {
          site: { connect: { id: siteId } },
          foreman: { connect: { id: effectiveForemanId } },
          workDate,
        },
        select: { id: true, siteId: true, foremanId: true },
      });
    } catch (e: any) {
      // Handle race: if another request created it first
      const again = await prisma.siteDay.findFirst({
        where: { foremanId: effectiveForemanId, workDate },
        select: { id: true, foremanId: true, siteId: true },
      });

      if (!again) throw e;
      siteDay = again;
    }
  } else {
    siteDay = existing;
  }

  // 3) Fetch full day DTO
  const siteDayFull = await prisma.siteDay.findUnique({
    where: { id: siteDay.id },
    select: {
      id: true,
      readyToSubmit: true,
      isLocked: true,
      site: { select: { id: true, name: true } },
      scans: {
        orderBy: { scannedAt: "desc" },
        select: {
          id: true,
          scannedAt: true,
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              qrCodeValue: true,
            },
          },
        },
      },
    },
  });

  // console.log(siteDay);

  if (!siteDayFull) {
    return NextResponse.json({ error: "Failed to load day" }, { status: 500 });
  }

  return NextResponse.json({
    day: {
      id: siteDayFull.id,
      dateISO,
      status: "PENDING", // until you add real status
      flags: 0,
      readyToSubmit: siteDayFull.readyToSubmit,
      site: siteDayFull.site,
      scans: siteDayFull.scans.map((s) => ({
        id: s.id,
        scannedAt: s.scannedAt.toISOString(),
        employee: {
          id: s.employee.id,
          fullName: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
          code: s.employee.qrCodeValue,
        },
      })),
    },
  });
}
