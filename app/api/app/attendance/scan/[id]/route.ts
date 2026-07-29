import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isoFromDateUTC } from "@/lib/dateUtc";
import { verifyApiToken } from "@/lib/jwt";
import { validateSupervisorScanDate } from "@/lib/supervisorScanPeriod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const token = getBearer(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    payload.role !== "FOREMAN" &&
    payload.role !== "SUPERVISOR" &&
    payload.role !== "ADMIN"
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scan = await prisma.attendanceScan.findUnique({
    where: { id },
    select: {
      id: true,
      siteId: true,
      workDate: true,
      siteDay: { select: { foremanId: true, isLocked: true } },
    },
  });

  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (payload.role === "FOREMAN") {
    const foreman = await prisma.foreman.findUnique({
      where: { userId: payload.sub },
      select: { id: true },
    });
    if (!foreman)
      return NextResponse.json({ error: "Foreman not found" }, { status: 404 });
    if (scan.siteDay.foremanId !== foreman.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (payload.role === "SUPERVISOR") {
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: payload.sub },
      select: { id: true },
    });
    if (!supervisor) {
      return NextResponse.json(
        { error: "Supervisor not found" },
        { status: 404 },
      );
    }

    const dateCheck = await validateSupervisorScanDate(
      isoFromDateUTC(scan.workDate),
    );
    if (!dateCheck.ok) {
      return NextResponse.json({ error: dateCheck.error }, { status: 400 });
    }

    const access = await prisma.supervisorSiteAssignment.findFirst({
      where: {
        supervisorId: supervisor.id,
        siteId: scan.siteId,
        startsOn: { lte: new Date() },
        OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (scan.siteDay.isLocked) {
      return NextResponse.json(
        { error: "This attendance day is locked and cannot be deleted." },
        { status: 409 },
      );
    }
  }

  await prisma.attendanceScan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
