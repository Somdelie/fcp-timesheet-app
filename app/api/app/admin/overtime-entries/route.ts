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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
      return { id: p.sub, role: p.role as "ADMIN" | "OFFICE" | "SUPERVISOR" };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (
    session?.user &&
    (role === "ADMIN" || role === "OFFICE" || role === "SUPERVISOR")
  )
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "OFFICE" | "SUPERVISOR",
    };
  return null;
}

/**
 * GET /api/app/admin/overtime-entries
 * List overtime entries with optional filters: ?siteId=, ?foremanId=, ?from=, ?to=
 */
export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const url = new URL(req.url);
    const siteId = url.searchParams.get("siteId");
    const foremanId = url.searchParams.get("foremanId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: Record<string, unknown> = {};
    if (siteId) where.siteId = siteId;
    if (foremanId) where.foremanId = foremanId;
    if (from || to) {
      const workDate: Record<string, unknown> = {};
      if (from) workDate.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) workDate.lte = new Date(`${to}T23:59:59.999Z`);
      where.workDate = workDate;
    }

    const entries = await prisma.overtimeEntry.findMany({
      where,
      orderBy: { workDate: "desc" },
      include: {
        site: { select: { id: true, name: true, code: true } },
        foreman: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
        overtimePrice: { select: { id: true, label: true, rate: true } },
        createdByUser: { select: { id: true, name: true } },
      },
    });

    const data = entries.map((e) => ({
      id: e.id,
      siteId: e.siteId,
      siteName: e.site.name,
      siteCode: e.site.code ?? null,
      foremanId: e.foremanId,
      foremanName: e.foreman.user.name ?? "Unknown",
      workDate: e.workDate.toISOString().slice(0, 10),
      overtimePriceId: e.overtimePriceId,
      overtimePriceLabel: e.overtimePrice.label,
      rateAtCreation: decimalToNumber(e.rateAtCreation),
      numberOfEmployees: e.numberOfEmployees,
      hoursWorked: decimalToNumber(e.hoursWorked),
      totalCost: decimalToNumber(e.totalCost),
      note: e.note,
      createdBy: e.createdByUser?.name ?? null,
      createdAt: e.createdAt.toISOString(),
    }));

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET overtime-entries error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/overtime-entries
 * Create a new overtime entry
 * Body: { siteId, foremanId, workDate, overtimePriceId, numberOfEmployees, hoursWorked, note? }
 */
export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS },
      );

    const body = await req.json();
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
      note?: string;
    };

    if (!siteId)
      return NextResponse.json(
        { error: "siteId is required" },
        { status: 400, headers: CORS },
      );
    if (!foremanId)
      return NextResponse.json(
        { error: "foremanId is required" },
        { status: 400, headers: CORS },
      );
    if (!workDate)
      return NextResponse.json(
        { error: "workDate is required" },
        { status: 400, headers: CORS },
      );
    if (!overtimePriceId)
      return NextResponse.json(
        { error: "overtimePriceId is required" },
        { status: 400, headers: CORS },
      );
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

    // Validate relations
    const [site, foreman, price] = await Promise.all([
      prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }),
      prisma.foreman.findUnique({
        where: { id: foremanId },
        select: { id: true },
      }),
      prisma.overtimePrice.findUnique({
        where: { id: overtimePriceId },
        select: { id: true, rate: true },
      }),
    ]);

    if (!site)
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404, headers: CORS },
      );
    if (!foreman)
      return NextResponse.json(
        { error: "Foreman not found" },
        { status: 404, headers: CORS },
      );
    if (!price)
      return NextResponse.json(
        { error: "Overtime price not found" },
        { status: 404, headers: CORS },
      );

    const rateNum = decimalToNumber(price.rate);
    const totalCost = rateNum * numberOfEmployees * Number(hoursWorked);

    const entry = await prisma.overtimeEntry.create({
      data: {
        site: { connect: { id: siteId } },
        foreman: { connect: { id: foremanId } },
        workDate: new Date(`${workDate}T00:00:00.000Z`),
        overtimePrice: { connect: { id: overtimePriceId } },
        rateAtCreation: rateNum,
        numberOfEmployees,
        hoursWorked: Number(hoursWorked),
        totalCost,
        note: note || null,
        createdByUser: { connect: { id: auth.id } },
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
        foreman: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
        overtimePrice: { select: { id: true, label: true } },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: entry.id,
          siteId: entry.siteId,
          siteName: entry.site.name,
          siteCode: entry.site.code ?? null,
          foremanId: entry.foremanId,
          foremanName: entry.foreman.user.name ?? "Unknown",
          workDate: entry.workDate.toISOString().slice(0, 10),
          overtimePriceLabel: entry.overtimePrice.label,
          rateAtCreation: rateNum,
          numberOfEmployees: entry.numberOfEmployees,
          hoursWorked: decimalToNumber(entry.hoursWorked),
          totalCost: decimalToNumber(entry.totalCost),
          note: entry.note,
          createdAt: entry.createdAt.toISOString(),
        },
      },
      { status: 201, headers: CORS },
    );
  } catch (e: any) {
    console.error("POST overtime-entries error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
