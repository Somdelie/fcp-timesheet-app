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
 * GET /api/app/admin/overtime-prices
 * List all overtime prices
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
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const where = includeInactive ? {} : { isActive: true };

    const prices = await prisma.overtimePrice.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const data = prices.map((p) => ({
      id: p.id,
      label: p.label,
      rate: decimalToNumber(p.rate),
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({ ok: true, data }, { headers: CORS });
  } catch (e: any) {
    console.error("GET overtime-prices error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}

/**
 * POST /api/app/admin/overtime-prices
 * Create a new overtime price
 * Body: { label, rate }
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
    const { label, rate } = body as { label?: string; rate?: number };

    if (!label || typeof label !== "string" || !label.trim()) {
      return NextResponse.json(
        { error: "label is required" },
        { status: 400, headers: CORS },
      );
    }
    if (rate == null || isNaN(Number(rate)) || Number(rate) < 0) {
      return NextResponse.json(
        { error: "rate must be a non-negative number" },
        { status: 400, headers: CORS },
      );
    }

    const price = await prisma.overtimePrice.create({
      data: {
        label: label.trim(),
        rate: Number(rate),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: price.id,
          label: price.label,
          rate: decimalToNumber(price.rate),
          isActive: price.isActive,
          createdAt: price.createdAt.toISOString(),
        },
      },
      { status: 201, headers: CORS },
    );
  } catch (e: any) {
    console.error("POST overtime-prices error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: CORS },
    );
  }
}
