import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signApiToken } from "@/lib/jwt";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders },
    );
  }

  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400, headers: corsHeaders },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, password: true, name: true, role: true },
  });

  if (!user?.password) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401, headers: corsHeaders },
    );
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401, headers: corsHeaders },
    );
  }

  const token = await signApiToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  writeAuditEvent({
    actorUserId: user.id,
    action: "LOGIN",
    entity: "User",
    entityId: user.id,
    metadata: { email: user.email, role: user.role, source: "web" },
  });

  return NextResponse.json(
    {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    },
    { headers: corsHeaders },
  );
}
