import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function getAuth(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (p && (p.role === "ADMIN" || p.role === "OFFICE"))
      return { id: p.sub, role: p.role as "ADMIN" | "OFFICE" };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE"))
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "OFFICE",
    };
  return null;
}

/**
 * GET /api/app/admin/fortnight-meetings/[id]
 * Returns full meeting with all rows and totals.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id } = await ctx.params;

    const meeting = await prisma.fortnightMeeting.findUnique({
      where: { id },
      include: {
        createdByUser: { select: { id: true, name: true } },
        totals: true,
        rows: {
          include: {
            site: { select: { id: true, name: true, code: true } },
          },
          orderBy: { projectCost: "desc" },
        },
      },
    });

    if (!meeting)
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404, headers: CORS },
      );

    const data = {
      id: meeting.id,
      startDate: meeting.startDate.toISOString().slice(0, 10),
      endDate: meeting.endDate.toISOString().slice(0, 10),
      meetingOn: meeting.meetingOn.toISOString(),
      createdAt: meeting.createdAt.toISOString(),
      createdBy: meeting.createdByUser,
      totals: meeting.totals
        ? {
            totalMaterialCost: Number(meeting.totals.totalMaterialCost),
            totalWagesCost: Number(meeting.totals.totalWagesCost),
            totalOvertimeCost: Number(meeting.totals.totalOvertimeCost),
            totalProjectCost: Number(meeting.totals.totalProjectCost),
            totalRevenueClaimed: Number(meeting.totals.totalRevenueClaimed),
            totalRevenueReceived: Number(meeting.totals.totalRevenueReceived),
            totalProfitOrLoss: Number(meeting.totals.totalProfitOrLoss),
          }
        : null,
      rows: meeting.rows.map((r) => ({
        id: r.id,
        site: r.site,
        materialCost: Number(r.materialCost),
        wagesCost: Number(r.wagesCost),
        overtimeCost: Number(r.overtimeCost),
        projectCost: Number(r.projectCost),
        revenueClaimed: Number(r.revenueClaimed),
        revenueReceived: Number(r.revenueReceived),
        profitOrLoss: Number(r.profitOrLoss),
        materialPct: r.materialPct ? Number(r.materialPct) : null,
        wagesPct: r.wagesPct ? Number(r.wagesPct) : null,
        profitPct: r.profitPct ? Number(r.profitPct) : null,
        prevMaterialCost: r.prevMaterialCost
          ? Number(r.prevMaterialCost)
          : null,
        prevWagesCost: r.prevWagesCost ? Number(r.prevWagesCost) : null,
        prevProjectCost: r.prevProjectCost ? Number(r.prevProjectCost) : null,
        materialCostDeltaPct: r.materialCostDeltaPct
          ? Number(r.materialCostDeltaPct)
          : null,
        wagesCostDeltaPct: r.wagesCostDeltaPct
          ? Number(r.wagesCostDeltaPct)
          : null,
        projectCostDeltaPct: r.projectCostDeltaPct
          ? Number(r.projectCostDeltaPct)
          : null,
      })),
    };

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET fortnight-meeting error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE /api/app/admin/fortnight-meetings/[id]
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id } = await ctx.params;

    await prisma.fortnightMeeting.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (e: any) {
    if (e?.code === "P2025")
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404, headers: CORS },
      );
    console.error("DELETE fortnight-meeting error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
