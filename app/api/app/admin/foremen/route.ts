import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function normalizeEmail(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

/**
 * GET /api/app/admin/foremen
 * List all foremen (admin-only)
 */
export async function GET(req: Request) {
  // 1) Try Bearer token (mobile / desktop)
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  let authed = false;

  if (token) {
    const payload = await verifyApiToken(token);
    if (
      payload &&
      (payload.role === "ADMIN" ||
        payload.role === "SUPERVISOR" ||
        payload.role === "OFFICE")
    ) {
      authed = true;
    }
  }

  // 2) Fallback to NextAuth web session
  if (!authed) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role as string | undefined;
    if (
      session?.user &&
      (role === "ADMIN" || role === "SUPERVISOR" || role === "OFFICE")
    ) {
      authed = true;
    }
  }

  if (!authed) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";

  try {
    const foremen = await prisma.foreman.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Apply search filter if q is provided
    const filtered = q
      ? foremen.filter(
          (f) =>
            f.user.name?.toLowerCase().includes(q.toLowerCase()) ||
            f.user.email?.toLowerCase().includes(q.toLowerCase()),
        )
      : foremen;

    return NextResponse.json(
      {
        ok: true,
        foremen: filtered.map((f) => ({
          foremanId: f.id,
          userId: f.user.id,
          name: f.user.name,
          email: f.user.email,
          createdAt: f.user.createdAt?.toISOString(),
        })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

/**
 * POST /api/app/admin/foremen
 * Create a new foreman account
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const payload = await verifyApiToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (payload.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const name = body.name != null ? String(body.name).trim() : null;
  const password = String(body.password ?? "");

  // Validation
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check if email already exists
      const existing = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existing) {
        throw new Error("EMAIL_EXISTS");
      }

      // Create user with FOREMAN role
      const user = await tx.user.create({
        data: {
          email,
          name,
          role: "FOREMAN",
          password: passwordHash,
        },
        select: { id: true, email: true, name: true },
      });

      // Create foreman record
      const foreman = await tx.foreman.create({
        data: { user: { connect: { id: user.id } } },
        select: { id: true },
      });

      // Create linked Employee record
      const nameParts = (name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "Foreman";
      const lastName = nameParts.slice(1).join(" ") || "";
      const qrCodeValue = randomBytes(8).toString("hex").toUpperCase();

      await tx.employee.create({
        data: {
          firstName,
          lastName,
          qrCodeValue,
          user: { connect: { id: user.id } },
          createdByUser: { connect: { id: user.id } },
          isActive: true,
        },
      });

      return { user, foreman };
    });

    return NextResponse.json(
      {
        ok: true,
        foreman: {
          foremanId: result.foreman.id,
          userId: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
      },
      { status: 201 },
    );
  } catch (e: any) {
    if (e.message === "EMAIL_EXISTS") {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 },
      );
    }

    if (String(e?.code) === "P2002") {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: e?.message ?? "Failed to create foreman" },
      { status: 500 },
    );
  }
}
