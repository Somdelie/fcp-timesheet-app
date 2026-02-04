import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

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

  const foreman = await prisma.foreman.findUnique({
    where: { userId: payload.sub },
    select: { id: true },
  });
  if (!foreman) {
    return NextResponse.json({ error: "Foreman not found" }, { status: 404 });
  }

  // Must be assigned (active) to the site
  const activeAssign = await prisma.foremanSiteAssignment.findFirst({
    where: {
      foremanId: foreman.id,
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

  // 1) Try load existing day
  const existing = await prisma.siteDay.findUnique({
    where: { siteId_workDate: { siteId, workDate } },
    select: { id: true, foremanId: true },
  });

  // If day exists for that site/date but belongs to someone else, do NOT hijack it.
  if (existing && existing.foremanId !== foreman.id) {
    return NextResponse.json(
      { error: "This site day is already owned by another foreman." },
      { status: 409 },
    );
  }

  // 2) Create if missing
  if (!existing) {
    try {
      await prisma.siteDay.create({
        data: {
          siteId,
          foremanId: foreman.id,
          workDate,
        },
        select: { id: true },
      });
    } catch (e: any) {
      // Handle race: if another request created it first
      const again = await prisma.siteDay.findUnique({
        where: { siteId_workDate: { siteId, workDate } },
        select: { id: true, foremanId: true },
      });

      if (!again) throw e;

      if (again.foremanId !== foreman.id) {
        return NextResponse.json(
          { error: "This site day is already owned by another foreman." },
          { status: 409 },
        );
      }
    }
  }

  // 3) Fetch full day DTO
  const siteDay = await prisma.siteDay.findUnique({
    where: { siteId_workDate: { siteId, workDate } },
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

  if (!siteDay) {
    return NextResponse.json({ error: "Failed to load day" }, { status: 500 });
  }

  return NextResponse.json({
    day: {
      id: siteDay.id,
      dateISO,
      status: "PENDING", // until you add real status
      flags: 0,
      readyToSubmit: siteDay.readyToSubmit,
      site: siteDay.site,
      scans: siteDay.scans.map((s) => ({
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
