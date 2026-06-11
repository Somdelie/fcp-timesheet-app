import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (
      p &&
      (p.role === "ADMIN" || p.role === "OFFICE" || p.role === "SUPERVISOR")
    )
      return { id: p.sub, role: p.role as string };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (
    session?.user &&
    (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR")
  )
    return { id: (session.user as any).id as string, role };
  return null;
}

/**
 * GET /api/app/admin/sites/[id]/finishing-schedules/[scheduleId]
 * Get a single finishing schedule with all areas + items.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; scheduleId: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { scheduleId } = await ctx.params;

    const schedule = await prisma.siteFinishingSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        site: { select: { id: true, name: true, code: true } },
        areas: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            items: { orderBy: [{ sortOrder: "asc" }] },
          },
        },
      },
    });

    if (!schedule)
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404, headers: CORS },
      );

    return NextResponse.json({ data: schedule }, { headers: CORS });
  } catch (err) {
    console.error("GET finishing-schedule detail error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * PATCH /api/app/admin/sites/[id]/finishing-schedules/[scheduleId]
 * Update schedule header fields.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; scheduleId: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR")
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: CORS },
      );

    const { scheduleId } = await ctx.params;
    const body = await req.json();
    const clean = (v: unknown) => String(v ?? "").trim();

    const existing = await prisma.siteFinishingSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true },
    });
    if (!existing)
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404, headers: CORS },
      );

    const data: Record<string, unknown> = {};
    if (body.contractNo !== undefined)
      data.contractNo = body.contractNo ? clean(body.contractNo) : null;
    if (body.contractManager !== undefined)
      data.contractManager = body.contractManager
        ? clean(body.contractManager)
        : null;
    if (body.siteForeman !== undefined)
      data.siteForeman = body.siteForeman ? clean(body.siteForeman) : null;
    if (body.fcpContractManager !== undefined)
      data.fcpContractManager = body.fcpContractManager
        ? clean(body.fcpContractManager)
        : null;
    if (body.fcpQs !== undefined)
      data.fcpQs = body.fcpQs ? clean(body.fcpQs) : null;
    if (body.fcpSiteForeman !== undefined)
      data.fcpSiteForeman = body.fcpSiteForeman
        ? clean(body.fcpSiteForeman)
        : null;
    if (body.client !== undefined)
      data.client = body.client ? clean(body.client) : null;
    if (body.startDate !== undefined)
      data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.completionDate !== undefined)
      data.completionDate = body.completionDate
        ? new Date(body.completionDate)
        : null;
    if (body.drawingDetails !== undefined)
      data.drawingDetails = body.drawingDetails
        ? clean(body.drawingDetails)
        : null;
    if (body.contactInfo !== undefined)
      data.contactInfo = body.contactInfo ? clean(body.contactInfo) : null;

    const updated = await prisma.siteFinishingSchedule.update({
      where: { id: scheduleId },
      data,
      include: {
        areas: { include: { items: true } },
      },
    });

    return NextResponse.json({ data: updated }, { headers: CORS });
  } catch (err) {
    console.error("PATCH finishing-schedule error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE /api/app/admin/sites/[id]/finishing-schedules/[scheduleId]
 * Delete a finishing schedule and all its areas/items (cascade).
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; scheduleId: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR")
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: CORS },
      );

    const { scheduleId } = await ctx.params;

    const existing = await prisma.siteFinishingSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true },
    });
    if (!existing)
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404, headers: CORS },
      );

    await prisma.siteFinishingSchedule.delete({
      where: { id: scheduleId },
    });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (err) {
    console.error("DELETE finishing-schedule error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
