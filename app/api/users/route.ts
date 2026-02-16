import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, requireRole } from "@/lib/api-auth";
import { isUserRole } from "@/lib/roles";

export const runtime = "nodejs";

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

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );

  if (!requireRole(auth, ["ADMIN", "SUPERVISOR"])) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ users }, { headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  if (!requireRole(auth, ["ADMIN"]))
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: CORS_HEADERS },
    );

  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: CORS_HEADERS },
    );

  const email = normalizeEmail(body.email);
  const name = body.name != null ? String(body.name).trim() : null;
  const phone = body.phone != null ? String(body.phone).trim() || null : null;
  const roleRaw = String(body.role ?? "")
    .trim()
    .toUpperCase();
  const password = String(body.password ?? "");

  if (!email.includes("@"))
    return NextResponse.json(
      { error: "Invalid email" },
      { status: 400, headers: CORS_HEADERS },
    );
  if (!isUserRole(roleRaw))
    return NextResponse.json(
      { error: "Invalid role" },
      { status: 400, headers: CORS_HEADERS },
    );

  // basic password policy
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name,
          phone,
          role: roleRaw, // your schema uses string enum; this is fine
          password: passwordHash,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });

      if (roleRaw === "SUPERVISOR")
        await tx.supervisor.create({ data: { userId: created.id } });
      if (roleRaw === "FOREMAN")
        await tx.foreman.create({ data: { userId: created.id } });

      return created;
    });

    return NextResponse.json({ user }, { status: 201, headers: CORS_HEADERS });
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409, headers: CORS_HEADERS },
      );
    }
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
