import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

async function getAdminFromRequest(req: NextRequest) {
  const apiCtx = await requireApiAuth(req, ["ADMIN"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role as string } as const;
  }

  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const role = (session.user as any).role as string | undefined;
      if (role === "ADMIN") {
        return {
          id: (session.user as any).id as string,
          role,
        } as const;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

const OverrideSchema = z.object({
  siteId: z.string().min(1).nullable().optional(),
  startsOn: z.string().min(1), // ISO date (yyyy-mm-dd)
  endsOn: z.string().optional().nullable(), // ISO date or null
  dayRate: z.number().positive(),
});

// GET /api/app/admin/employees/[id]/day-rate-overrides
// List all overrides for an employee (most recent first)
export async function GET(
  req: NextRequest,
  segment: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { id: employeeId } = await segment.params;
    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee id is required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const rows = await prisma.employeeDayRateOverride.findMany({
      where: { employeeId },
      orderBy: { startsOn: "desc" },
      select: {
        id: true,
        siteId: true,
        startsOn: true,
        endsOn: true,
        dayRate: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        overrides: rows.map((o) => ({
          id: o.id,
          siteId: o.siteId,
          startsOn: o.startsOn.toISOString(),
          endsOn: o.endsOn ? o.endsOn.toISOString() : null,
          dayRate: (o.dayRate as any).toString?.() ?? String(o.dayRate ?? "0"),
        })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error(
      "/api/app/admin/employees/[id]/day-rate-overrides GET error",
      e,
    );
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// POST /api/app/admin/employees/[id]/day-rate-overrides
// - If body has { id, endsOn }, close an existing override by setting endsOn.
// - Otherwise, create a new override using OverrideSchema.
export async function POST(
  req: NextRequest,
  segment: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const { id: employeeId } = await segment.params;
    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee id is required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const json = await req.json().catch(() => null as any);

    // Close existing override
    if (json && typeof json.id === "string" && json.id) {
      const endsOnStr =
        typeof json.endsOn === "string" && json.endsOn.trim()
          ? json.endsOn.trim()
          : null;
      const endsOn = endsOnStr ? new Date(`${endsOnStr}T00:00:00.000Z`) : null;

      const updated = await prisma.employeeDayRateOverride.updateMany({
        where: { id: json.id, employeeId },
        data: { endsOn },
      });

      if (updated.count === 0) {
        return NextResponse.json(
          { error: "Override not found" },
          { status: 404, headers: CORS_HEADERS },
        );
      }

      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }

    const body = OverrideSchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const data = body.data;

    const startsOnDate = new Date(`${data.startsOn}T00:00:00.000Z`);
    if (Number.isNaN(startsOnDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid startsOn date" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    let endsOnDate: Date | null = null;
    if (data.endsOn) {
      const d = new Date(`${data.endsOn}T23:59:59.999Z`);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "Invalid endsOn date" },
          { status: 400, headers: CORS_HEADERS },
        );
      }
      endsOnDate = d;
    }

    const created = await prisma.employeeDayRateOverride.create({
      data: {
        employeeId,
        siteId: data.siteId ?? null,
        startsOn: startsOnDate,
        endsOn: endsOnDate,
        dayRate: data.dayRate as any,
        createdByUserId: admin.id,
      },
      select: {
        id: true,
        siteId: true,
        startsOn: true,
        endsOn: true,
        dayRate: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        override: {
          id: created.id,
          siteId: created.siteId,
          startsOn: created.startsOn.toISOString(),
          endsOn: created.endsOn ? created.endsOn.toISOString() : null,
          dayRate:
            (created.dayRate as any).toString?.() ??
            String(created.dayRate ?? "0"),
        },
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error(
      "/api/app/admin/employees/[id]/day-rate-overrides POST error",
      e,
    );
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
