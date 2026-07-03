import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
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
    const supervisorId = url.searchParams.get("supervisorId");
    const paid = url.searchParams.get("paid");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const where: Record<string, unknown> = {};
    if (siteId) where.siteId = siteId;
    if (foremanId) where.foremanId = foremanId;
    if (paid === "PAID") where.paidAt = { not: null };
    if (paid === "UNPAID") where.paidAt = null;
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
        paidByUser: { select: { id: true, name: true } },
      },
    });

    const siteIds = Array.from(new Set(entries.map((e) => e.siteId)));
    const supervisorAssignments = siteIds.length
      ? await prisma.supervisorSiteAssignment.findMany({
          where: {
            siteId: { in: siteIds },
            OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
          },
          orderBy: { startsOn: "desc" },
          select: {
            siteId: true,
            supervisor: {
              select: {
                userId: true,
                user: { select: { name: true } },
              },
            },
          },
        })
      : [];
    const supervisorsBySite = new Map<string, { id: string; name: string }>();
    for (const assignment of supervisorAssignments) {
      if (!supervisorsBySite.has(assignment.siteId)) {
        supervisorsBySite.set(assignment.siteId, {
          id: assignment.supervisor.userId,
          name: assignment.supervisor.user?.name ?? "Supervisor",
        });
      }
    }

    let data = entries.map((e) => ({
      id: e.id,
      siteId: e.siteId,
      siteName: e.site.name,
      siteCode: e.site.code ?? null,
      foremanId: e.foremanId,
      foremanName: e.foreman.user.name ?? "Unknown",
      supervisorId: supervisorsBySite.get(e.siteId)?.id ?? null,
      supervisorName: supervisorsBySite.get(e.siteId)?.name ?? null,
      workDate: e.workDate.toISOString().slice(0, 10),
      overtimePriceId: e.overtimePriceId,
      overtimePriceLabel: e.overtimePrice.label,
      rateAtCreation: decimalToNumber(e.rateAtCreation),
      numberOfEmployees: e.numberOfEmployees,
      hoursWorked: decimalToNumber(e.hoursWorked),
      totalCost: decimalToNumber(e.totalCost),
      note: e.note,
      paidAt: e.paidAt?.toISOString() ?? null,
      paidBy: e.paidByUser?.name ?? null,
      createdBy: e.createdByUser?.name ?? null,
      createdAt: e.createdAt.toISOString(),
    }));
    if (supervisorId && supervisorId !== "ALL") {
      data = data.filter((entry) => entry.supervisorId === supervisorId);
    }

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
 * Body:
 *   Single: { siteId, foremanId, workDate, overtimePriceId, numberOfEmployees, hoursWorked, note? }
 *   Batch:  { siteId, foremanId, overtimePriceId, numberOfEmployees?, entries: [{ workDate, hoursWorked, numberOfEmployees }], note? }
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
      entries,
      note,
    } = body as {
      siteId?: string;
      foremanId?: string;
      workDate?: string;
      overtimePriceId?: string;
      numberOfEmployees?: number;
      hoursWorked?: number;
      entries?: Array<{
        workDate?: string;
        hoursWorked?: number;
        numberOfEmployees?: number;
      }>;
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
    if (!overtimePriceId)
      return NextResponse.json(
        { error: "overtimePriceId is required" },
        { status: 400, headers: CORS },
      );
    const entryRows =
      Array.isArray(entries) && entries.length > 0
        ? entries
        : [{ workDate, hoursWorked, numberOfEmployees }];

    for (const row of entryRows) {
      if (!row.workDate)
        return NextResponse.json(
          { error: "workDate is required" },
          { status: 400, headers: CORS },
        );
      if (!row.hoursWorked || Number(row.hoursWorked) <= 0)
        return NextResponse.json(
          { error: "hoursWorked must be greater than 0" },
          { status: 400, headers: CORS },
        );
      if (!row.numberOfEmployees || Number(row.numberOfEmployees) < 1)
        return NextResponse.json(
          { error: "numberOfEmployees must be at least 1" },
          { status: 400, headers: CORS },
        );
    }

    const uniqueDates = new Set(entryRows.map((row) => row.workDate));
    if (uniqueDates.size !== entryRows.length)
      return NextResponse.json(
        { error: "Duplicate overtime dates are not allowed in one batch" },
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

    const rowsToCreate = entryRows.map((row) => {
        const rowHours = Number(row.hoursWorked);
        const rowEmployees = Number(row.numberOfEmployees);
        const totalCost = rateNum * rowEmployees * rowHours;

        return {
          id: randomUUID(),
          siteId,
          foremanId,
          workDate: new Date(`${row.workDate}T00:00:00.000Z`),
          overtimePriceId,
          rateAtCreation: rateNum,
          numberOfEmployees: rowEmployees,
          hoursWorked: rowHours,
          totalCost,
          note: note || null,
          createdByUserId: auth.id,
        };
      });

    await prisma.overtimeEntry.createMany({ data: rowsToCreate });

    const createdEntries = await prisma.overtimeEntry.findMany({
      where: { id: { in: rowsToCreate.map((row) => row.id) } },
      orderBy: { workDate: "asc" },
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

    const data = createdEntries.map((entry) => ({
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
    }));

    return NextResponse.json(
      {
        ok: true,
        data: data.length === 1 ? data[0] : data,
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
