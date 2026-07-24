import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import type { PlantStatus } from "@/generated/prisma/client";

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
    if (p && (p.role === "ADMIN" || p.role === "OFFICE"))
      return { id: p.sub, role: p.role as string };
  }
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
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        transfersIn: {
          include: {
            fromSite: { select: { id: true, name: true, code: true } },
            transferredByUser: { select: { id: true, name: true } },
          },
          orderBy: { transferredOn: "desc" },
          take: 1,
        },
        transfersOut: {
          include: {
            toSite: { select: { id: true, name: true, code: true } },
            transferredByUser: { select: { id: true, name: true } },
          },
          orderBy: { transferredOn: "desc" },
        },
      },
    });

    return NextResponse.json({ ok: true, data: rows }, { headers: CORS });
  } catch (e: any) {
    console.error("GET plant-assignments error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST /api/app/admin/plant-assignments */
export async function POST(req: Request) {
  try {
    const auth = await getAuth(req);
    if (!auth)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      siteId,
      productId,
      quantity,
      note,
      deployedOn,
      unitPrice,
      chargeToSite,
      chargeQuantity,
      reference,
      supervisorName,
      size,
    } = body as {
      siteId: string;
      productId: string;
      quantity?: number;
      note?: string;
      deployedOn?: string;
      unitPrice?: number | null;
      chargeToSite?: boolean;
      chargeQuantity?: number | null;
      reference?: string | null;
      supervisorName?: string | null;
      size?: string | null;
    };

    if (!siteId || !productId)
      return NextResponse.json(
        { error: "siteId and productId are required" },
        { status: 400 },
      );

    // Duplicate reference check — block if any assignment with this reference already exists
    if (reference?.trim()) {
      const existing = await prisma.sitePlantAssignment.findFirst({
        where: { reference: reference.trim() },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Deployment "${reference.trim()}" already exists` },
          { status: 409, headers: CORS },
        );
      }
    }

    const row = await prisma.sitePlantAssignment.create({
      data: {
        reference: reference?.trim() || null,
        siteId,
        productId,
        quantity: quantity ?? 1,
        size: size?.trim() || null,
        note: note?.trim() || null,
        supervisorName: supervisorName?.trim() || null,
        deployedOn: deployedOn ? new Date(deployedOn) : new Date(),
        status: "DEPLOYED",
        assignedByUserId: auth.id,
        unitPrice: unitPrice != null ? unitPrice : null,
        chargeToSite: chargeToSite ?? false,
        chargeQuantity: chargeQuantity != null ? chargeQuantity : null,
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
