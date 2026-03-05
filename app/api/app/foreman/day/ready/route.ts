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

export async function POST(req: Request) {
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

  // --- body ---
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const siteId = String(body?.siteId ?? "");
  const dateISO = String(body?.dateISO ?? "");
  const readyToSubmit = Boolean(body?.readyToSubmit);
  // Support both body param and header for foreman ID
  const forForemanId =
    body?.forForemanId ||
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

  // --- ensure day exists for this foreman on this site and date ---
  let siteDay = await prisma.siteDay.findFirst({
    where: { foremanId: actingForemanId, siteId, workDate },
    select: { id: true, foremanId: true, isLocked: true, siteId: true },
  });

  if (!siteDay) {
    siteDay = await prisma.siteDay.create({
      data: {
        site: { connect: { id: siteId } },
        workDate,
        foreman: { connect: { id: actingForemanId } },
      },
      select: { id: true, foremanId: true, isLocked: true, siteId: true },
    });
  }

  if (siteDay.isLocked) {
    return NextResponse.json({ error: "Day is locked" }, { status: 409 });
  }

  // if marking ready=true, require at least 1 scan
  if (readyToSubmit) {
    const scanCount = await prisma.attendanceScan.count({
      where: { siteDayId: siteDay.id },
    });
    if (scanCount === 0) {
      return NextResponse.json(
        { error: "Scan at least one worker before marking ready" },
        { status: 400 },
      );
    }
  }

  await prisma.siteDay.update({
    where: { id: siteDay.id },
    data: { readyToSubmit },
  });

  return NextResponse.json({ ok: true });
}
