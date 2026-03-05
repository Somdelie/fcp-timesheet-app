import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

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

async function getAuthFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (
      payload &&
      (payload.role === "ADMIN" || payload.role === "SUPERVISOR")
    ) {
      return { id: payload.sub, role: payload.role as "ADMIN" | "SUPERVISOR" };
    }
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && (role === "ADMIN" || role === "SUPERVISOR")) {
    return {
      id: (session.user as any).id as string,
      role: role as "ADMIN" | "SUPERVISOR",
    };
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const url = new URL(req.url);
    const role = url.searchParams.get("role");
    const search = url.searchParams.get("q")?.trim().toLowerCase() || "";

    const users = await prisma.user.findMany({
      where: {
        ...(role && { role: role as any }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
      take: 100,
    });

    return NextResponse.json(
      {
        ok: true,
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
        })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Error listing users:", e);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// POST /api/app/admin/users — Create a new FOREMAN user
export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized – admin only" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const { name, email, password, dayRate, supervisorId } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters." },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    if (
      !email ||
      typeof email !== "string" ||
      !email.includes("@") ||
      email.trim().length < 3
    ) {
      return NextResponse.json(
        { error: "Please enter a valid email." },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    if (!dayRate || Number(dayRate) <= 0) {
      return NextResponse.json(
        { error: "Day rate must be greater than 0." },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    if (!supervisorId || typeof supervisorId !== "string") {
      return NextResponse.json(
        { error: "Supervisor is required." },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const emailNorm = email.trim().toLowerCase();
    const nameNorm = name.trim();
    const passwordHash = await bcrypt.hash(password, 12);
    const dayRateDecimal = parseFloat(String(dayRate));

    // Create user
    const created = await prisma.user.create({
      data: {
        email: emailNorm,
        name: nameNorm,
        role: "FOREMAN",
        password: passwordHash,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // Create foreman record
    try {
      const foreman = await prisma.foreman.create({
        data: {
          user: { connect: { id: created.id } },
          defaultDayRate: dayRateDecimal > 0 ? dayRateDecimal : null,
        },
      });

      // Link to supervisor
      try {
        await prisma.supervisorForeman.create({
          data: {
            supervisor: { connect: { id: supervisorId } },
            foreman: { connect: { id: foreman.id } },
            startsOn: new Date(),
          },
        });
      } catch (err) {
        console.error("[create-foreman] Failed to link supervisor:", err);
      }

      // Create employee profile
      const token = randomBytes(8).toString("hex").toUpperCase();
      const qrCodeValue = `EMP-${token}`;
      try {
        await prisma.employee.create({
          data: {
            firstName: nameNorm.split(" ")[0] || nameNorm,
            lastName: nameNorm.split(" ").slice(1).join(" ") || "",
            defaultDayRate: dayRateDecimal > 0 ? dayRateDecimal : null,
            qrCodeValue,
            createdByUser: { connect: { id: created.id } },
            user: { connect: { id: created.id } },
            isActive: true,
          },
        });
      } catch (err) {
        console.error("[create-foreman] Failed to create employee:", err);
      }
    } catch (err) {
      console.error("[create-foreman] Failed to create foreman record:", err);
    }

    return NextResponse.json(
      { ok: true, user: created },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error("Create foreman error:", e);
    if (String(e?.code) === "P2002") {
      return NextResponse.json(
        { error: "Email already exists." },
        { status: 409, headers: CORS_HEADERS },
      );
    }
    return NextResponse.json(
      { error: e.message || "Failed to create user." },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
