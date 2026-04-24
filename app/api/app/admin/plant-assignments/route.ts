import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PlantStatus } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuth(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && (role === "ADMIN" || role === "OFFICE"))
    return { id: (session.user as any).id as string, role };
  return null;
}

/** GET /api/app/admin/plant-assignments?siteId=&status= */
export async function GET(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const siteId = url.searchParams.get("siteId");
    const status = url.searchParams.get("status") as PlantStatus | null;

    const where: Record<string, unknown> = {};
    if (siteId) where.siteId = siteId;
    if (status) where.status = status;

    const rows = await prisma.sitePlantAssignment.findMany({
      where,
      orderBy: { deployedOn: "desc" },
      include: {
        product: { select: { id: true, name: true, thumbnailUrl: true } },
        site: { select: { id: true, name: true, code: true } },
        assignedByUser: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true, data: rows });
  } catch (e: any) {
    console.error("GET plant-assignments error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST /api/app/admin/plant-assignments */
export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { siteId, productId, quantity, note, deployedOn } = body as {
      siteId: string;
      productId: string;
      quantity?: number;
      note?: string;
      deployedOn?: string;
    };

    if (!siteId || !productId)
      return NextResponse.json({ error: "siteId and productId are required" }, { status: 400 });

    const row = await prisma.sitePlantAssignment.create({
      data: {
        siteId,
        productId,
        quantity: quantity ?? 1,
        note: note?.trim() || null,
        deployedOn: deployedOn ? new Date(deployedOn) : new Date(),
        status: "DEPLOYED",
        assignedByUserId: auth.id,
      },
      include: {
        product: { select: { id: true, name: true, thumbnailUrl: true } },
        site: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json({ ok: true, data: row }, { status: 201 });
  } catch (e: any) {
    console.error("POST plant-assignments error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
