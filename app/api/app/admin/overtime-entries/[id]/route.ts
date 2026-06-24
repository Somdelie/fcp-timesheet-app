import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { decimalToNumber } from "@/lib/dateUtc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
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
 * PATCH /api/app/admin/overtime-entries/[id]
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const existing = await prisma.overtimeEntry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: CORS },
      );

    if (body.action === "MARK_PAID" || body.action === "MARK_UNPAID") {
      const updated = await prisma.overtimeEntry.update({
        where: { id },
        data:
          body.action === "MARK_PAID"
            ? { paidAt: new Date(), paidByUserId: auth.id }
            : { paidAt: null, paidByUserId: null },
        select: { id: true, paidAt: true },
      });
      return NextResponse.json({ ok: true, data: updated }, { headers: CORS });
    }

    const {
      siteId,
      foremanId,
      workDate,
      overtimePriceId,
      numberOfEmployees,
      hoursWorked,
      note,
    } = body as {
      siteId?: string;
      foremanId?: string;
      workDate?: string;
      overtimePriceId?: string;
      numberOfEmployees?: number;
      hoursWorked?: number;
      note?: string | null;
    };

    if (!siteId || !foremanId || !workDate || !overtimePriceId) {
      return NextResponse.json(
        { error: "siteId, foremanId, workDate and overtimePriceId are required" },
        { status: 400, headers: CORS },
      );
    }
    if (!numberOfEmployees || numberOfEmployees < 1)
      return NextResponse.json(
        { error: "numberOfEmployees must be at least 1" },
        { status: 400, headers: CORS },
      );
    if (!hoursWorked || Number(hoursWorked) <= 0)
      return NextResponse.json(
        { error: "hoursWorked must be greater than 0" },
        { status: 400, headers: CORS },
      );

    const [site, foreman, price] = await Promise.all([
      prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }),
      prisma.foreman.findUnique({ where: { id: foremanId }, select: { id: true } }),
      prisma.overtimePrice.findUnique({
        where: { id: overtimePriceId },
        select: { id: true, rate: true },
      }),
    ]);
    if (!site || !foreman || !price)
      return NextResponse.json(
        { error: "Invalid site, foreman or overtime price" },
        { status: 404, headers: CORS },
      );

    const rateNum = decimalToNumber(price.rate);
    const totalCost = rateNum * numberOfEmployees * Number(hoursWorked);
    const updated = await prisma.overtimeEntry.update({
      where: { id },
      data: {
        siteId,
        foremanId,
        workDate: new Date(`${workDate}T00:00:00.000Z`),
        overtimePriceId,
        rateAtCreation: rateNum,
        numberOfEmployees,
        hoursWorked: Number(hoursWorked),
        totalCost,
        note: note?.trim() || null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, data: updated }, { headers: CORS });
  } catch (e: any) {
    console.error("PATCH overtime-entry error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * DELETE /api/app/admin/overtime-entries/[id]
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const { id } = await params;

    const existing = await prisma.overtimeEntry.findUnique({ where: { id } });
    if (!existing)
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: CORS },
      );

    await prisma.overtimeEntry.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (e: any) {
    console.error("DELETE overtime-entries error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
