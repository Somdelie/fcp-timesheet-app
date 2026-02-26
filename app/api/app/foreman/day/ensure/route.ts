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
 * POST /api/app/foreman/day/ensure
 * Ensures a SiteDay exists for the given site and date.
 * Creates one if it doesn't exist, or returns the existing one's ID.
 *
 * Body: { siteId: string, dateISO: string, forForemanId?: string }
 * Returns: { siteDayId: string }
 */
export async function POST(req: Request) {
  // --- auth ---
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const payload = await verifyApiToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Allow FOREMAN and EMPLOYEE roles - assistants are employees who can act for foremen
  if (payload.role !== "FOREMAN" && payload.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- parse body ---
  let body: { siteId?: string; dateISO?: string; forForemanId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { siteId, dateISO } = body;
  // Support both body param and header for foreman ID
  const forForemanId =
    body.forForemanId || req.headers.get("x-acting-foreman-id")?.trim() || null;

  if (!siteId || !dateISO) {
    return NextResponse.json(
      { error: "siteId and dateISO are required" },
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

  // --- validate site assignment ---
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

  // --- validate site exists and is active ---
  const site = await prisma.site.findFirst({
    where: { id: siteId, isActive: true },
    select: { id: true },
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // --- ensure SiteDay exists ---
  let siteDay = await prisma.siteDay.findFirst({
    where: { foremanId: actingForemanId, siteId, workDate },
    select: { id: true },
  });

  if (!siteDay) {
    siteDay = await prisma.siteDay.create({
      data: { siteId, workDate, foremanId: actingForemanId },
      select: { id: true },
    });
  }

  return NextResponse.json({ siteDayId: siteDay.id });
}
