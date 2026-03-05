import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";
import { authOptions } from "@/lib/auth";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

const OverrideCreateSchema = z.object({
  startsOn: z.string().optional().nullable(), // ISO date (yyyy-mm-dd) – defaults to today
  endsOn: z.string().optional().nullable(), // ISO date or null
  dayRate: z.number().positive(),
  reason: z.string().optional().nullable(),
});

async function resolveForemanIdForRequest(req: NextRequest) {
  const url = new URL(req.url);
  const foremanId = url.searchParams.get("foremanId")?.trim();
  const foremanUserId = url.searchParams.get("foremanUserId")?.trim();

  if (foremanId) {
    return foremanId;
  }

  if (!foremanUserId) {
    return null;
  }

  const foreman = await prisma.foreman.findUnique({
    where: { userId: foremanUserId },
    select: { id: true },
  });

  return foreman?.id ?? null;
}

// GET /api/app/admin/sites/[id]/foreman-day-rate-overrides
// List all overrides for a site + foreman (most recent first)
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

    const { id: siteId } = await segment.params;
    if (!siteId) {
      return NextResponse.json(
        { error: "Site id is required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const foremanId = await resolveForemanIdForRequest(req);

    // If foremanId is provided, filter by foreman; otherwise return all for site
    const where: any = { siteId };
    if (foremanId) {
      where.foremanId = foremanId;
    }

    const rows = await prisma.siteForemanDayRateOverride.findMany({
      where,
      orderBy: { startsOn: "desc" },
      include: {
        foreman: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        overrides: rows.map((o) => ({
          id: o.id,
          foremanId: o.foremanId,
          foremanName: o.foreman?.user?.name ?? "Unknown",
          startsOn: o.startsOn.toISOString(),
          endsOn: o.endsOn ? o.endsOn.toISOString() : null,
          dayRate: (o.dayRate as any).toString?.() ?? String(o.dayRate ?? "0"),
          reason: o.reason ?? null,
        })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error(
      "/api/app/admin/sites/[id]/foreman-day-rate-overrides GET error",
      e,
    );
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// POST /api/app/admin/sites/[id]/foreman-day-rate-overrides
// - If body has { id, endsOn }, close an existing override by setting endsOn.
// - Otherwise, create a new override using OverrideCreateSchema.
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

    const { id: siteId } = await segment.params;
    if (!siteId) {
      return NextResponse.json(
        { error: "Site id is required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const json = await req.json().catch(() => null as any);

    // Resolve foremanId from query param OR body
    let foremanId = await resolveForemanIdForRequest(req);
    if (
      !foremanId &&
      json &&
      typeof json.foremanId === "string" &&
      json.foremanId.trim()
    ) {
      foremanId = json.foremanId.trim();
    }
    if (!foremanId) {
      return NextResponse.json(
        { error: "foremanId or foremanUserId is required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Close existing override
    if (json && typeof json.id === "string" && json.id) {
      const endsOnStr =
        typeof json.endsOn === "string" && json.endsOn.trim()
          ? json.endsOn.trim()
          : null;
      const endsOn = endsOnStr ? new Date(`${endsOnStr}T23:59:59.999Z`) : null;

      const updated = await prisma.siteForemanDayRateOverride.updateMany({
        where: { id: json.id, siteId, foremanId },
        data: { endsOn },
      });

      if (updated.count === 0) {
        return NextResponse.json(
          { error: "Override not found" },
          { status: 404, headers: CORS_HEADERS },
        );
      }

      writeAuditEvent({
        actorUserId: admin.id,
        action: "FOREMAN_DAY_RATE_CHANGE",
        entity: "Site",
        entityId: siteId,
        metadata: {
          siteId,
          foremanId,
          overrideId: json.id,
          change: "closed_override",
          endsOn: endsOnStr,
        },
      });

      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }

    const body = OverrideCreateSchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const data = body.data;

    // Default startsOn to today if not provided
    const startsOnStr =
      data.startsOn?.trim() || new Date().toISOString().slice(0, 10);
    const startsOnDate = new Date(`${startsOnStr}T00:00:00.000Z`);
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

    // Prevent overlapping overrides for the same site + foreman
    const overlapping = await prisma.siteForemanDayRateOverride.findFirst({
      where: {
        siteId,
        foremanId,
        // existing starts before new ends (or open-ended)
        startsOn: endsOnDate ? { lte: endsOnDate } : undefined,
        // existing ends after new starts (or open-ended)
        OR: [{ endsOn: null }, { endsOn: { gte: startsOnDate } }],
      },
      select: { id: true, startsOn: true, endsOn: true },
    });

    if (overlapping) {
      return NextResponse.json(
        {
          error:
            "This foreman already has an overlapping day rate override for this site. Close the existing one before adding another.",
        },
        { status: 409, headers: CORS_HEADERS },
      );
    }

    const created = await prisma.siteForemanDayRateOverride.create({
      data: {
        site: { connect: { id: siteId } },
        foreman: { connect: { id: foremanId } },
        startsOn: startsOnDate,
        endsOn: endsOnDate,
        dayRate: data.dayRate as any,
        reason: data.reason ?? null,
        createdByUserId: admin.id,
      },
      select: {
        id: true,
        startsOn: true,
        endsOn: true,
        dayRate: true,
        reason: true,
      },
    });

    writeAuditEvent({
      actorUserId: admin.id,
      action: "FOREMAN_DAY_RATE_CHANGE",
      entity: "Site",
      entityId: siteId,
      metadata: {
        siteId,
        foremanId,
        dayRate: data.dayRate,
        startsOn: startsOnStr,
        endsOn: data.endsOn ?? null,
        reason: data.reason ?? null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        override: {
          id: created.id,
          startsOn: created.startsOn.toISOString(),
          endsOn: created.endsOn ? created.endsOn.toISOString() : null,
          dayRate:
            (created.dayRate as any).toString?.() ??
            String(created.dayRate ?? "0"),
          reason: created.reason ?? null,
        },
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error(
      "/api/app/admin/sites/[id]/foreman-day-rate-overrides POST error",
      e,
    );
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// DELETE /api/app/admin/sites/[id]/foreman-day-rate-overrides
// Delete an override by id, or delete all active overrides for a foreman on this site
export async function DELETE(
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

    const { id: siteId } = await segment.params;
    if (!siteId) {
      return NextResponse.json(
        { error: "Site id is required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const json = await req.json().catch(() => null as any);

    // Delete a specific override by id
    if (json && typeof json.id === "string" && json.id) {
      const deleted = await prisma.siteForemanDayRateOverride.deleteMany({
        where: { id: json.id, siteId },
      });

      if (deleted.count === 0) {
        return NextResponse.json(
          { error: "Override not found" },
          { status: 404, headers: CORS_HEADERS },
        );
      }

      writeAuditEvent({
        actorUserId: admin.id,
        action: "FOREMAN_DAY_RATE_CHANGE",
        entity: "Site",
        entityId: siteId,
        metadata: {
          siteId,
          overrideId: json.id,
          change: "deleted_override",
        },
      });

      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }

    // Delete all active overrides for a foreman on this site
    let foremanId = await resolveForemanIdForRequest(req);
    if (
      !foremanId &&
      json &&
      typeof json.foremanId === "string" &&
      json.foremanId.trim()
    ) {
      foremanId = json.foremanId.trim();
    }

    if (!foremanId) {
      return NextResponse.json(
        { error: "id or foremanId is required" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const deleted = await prisma.siteForemanDayRateOverride.deleteMany({
      where: { siteId, foremanId, endsOn: null },
    });

    writeAuditEvent({
      actorUserId: admin.id,
      action: "FOREMAN_DAY_RATE_CHANGE",
      entity: "Site",
      entityId: siteId,
      metadata: {
        siteId,
        foremanId,
        change: "deleted_all_active_overrides",
        deletedCount: deleted.count,
      },
    });

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e: any) {
    console.error(
      "/api/app/admin/sites/[id]/foreman-day-rate-overrides DELETE error",
      e,
    );
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
