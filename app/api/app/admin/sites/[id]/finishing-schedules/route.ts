import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

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
 * GET /api/app/admin/sites/[id]/finishing-schedules
 * List all finishing schedules for a site.
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

    const { id: siteId } = await ctx.params;

    const schedules = await prisma.siteFinishingSchedule.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      include: {
        areas: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            items: { orderBy: [{ sortOrder: "asc" }] },
          },
        },
      },
    });

    return NextResponse.json({ data: schedules }, { headers: CORS });
  } catch (err) {
    console.error("GET finishing-schedules error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/sites/[id]/finishing-schedules
 * Create a new finishing schedule (with optional nested areas/items).
 */
export async function POST(
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

    if (auth.role !== "ADMIN" && auth.role !== "SUPERVISOR")
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: CORS },
      );

    const { id: siteId } = await ctx.params;
    const body = await req.json();

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true },
    });
    if (!site)
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404, headers: CORS },
      );

    const clean = (v: unknown) => String(v ?? "").trim();

    const schedule = await prisma.siteFinishingSchedule.create({
      data: {
        site: { connect: { id: siteId } },
        contractNo: body.contractNo ? clean(body.contractNo) : null,
        contractManager: body.contractManager
          ? clean(body.contractManager)
          : null,
        siteForeman: body.siteForeman ? clean(body.siteForeman) : null,
        fcpContractManager: body.fcpContractManager
          ? clean(body.fcpContractManager)
          : null,
        fcpQs: body.fcpQs ? clean(body.fcpQs) : null,
        fcpSiteForeman: body.fcpSiteForeman
          ? clean(body.fcpSiteForeman)
          : null,
        client: body.client ? clean(body.client) : null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        completionDate: body.completionDate
          ? new Date(body.completionDate)
          : null,
        drawingDetails: body.drawingDetails ? clean(body.drawingDetails) : null,
        contactInfo: body.contactInfo ? clean(body.contactInfo) : null,
        areas: Array.isArray(body.areas)
          ? {
              create: body.areas.map(
                (area: Record<string, unknown>, ai: number) => ({
                  name: clean(area.name),
                  label: area.label ? clean(area.label) : null,
                  sortOrder:
                    typeof area.sortOrder === "number" ? area.sortOrder : ai,
                  items: Array.isArray(area.items)
                    ? {
                        create: (area.items as Record<string, unknown>[]).map(
                          (item, ii) => ({
                            zone: item.zone as string,
                            position: clean(item.position),
                            product: item.product ? clean(item.product) : null,
                            colorCode: item.colorCode
                              ? clean(item.colorCode)
                              : null,
                            supplier: item.supplier
                              ? clean(item.supplier)
                              : null,
                            sortOrder:
                              typeof item.sortOrder === "number"
                                ? item.sortOrder
                                : ii,
                            note: item.note ? clean(item.note) : null,
                          }),
                        ),
                      }
                    : undefined,
                }),
              ),
            }
          : undefined,
      },
      include: {
        areas: { include: { items: true } },
      },
    });

    return NextResponse.json(
      { data: schedule },
      { status: 201, headers: CORS },
    );
  } catch (err) {
    console.error("POST finishing-schedules error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
