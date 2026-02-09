import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, password: true, name: true, role: true },
  });

  if (!user?.password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Fetch foremen this user can act for as an assistant
  const assistantLinks = await prisma.foremanAssistant.findMany({
    where: {
      employee: {
        userId: user.id,
      },
      OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
    },
    select: {
      foreman: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  const availableForemen = assistantLinks.map((x) => ({
    foremanId: x.foreman.id,
    name: x.foreman.user.name ?? "Foreman",
  }));

  const token = await signApiToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      availableForemen,
      actingForeman: null,
    },
  });
}
