import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, requireRole } from "@/lib/api-auth";
import { isUserRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!requireRole(auth, ["ADMIN", "SUPERVISOR"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(auth, ["ADMIN"]))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const data: any = {};

  if (body.name !== undefined)
    data.name = body.name ? String(body.name).trim() : null;

  if (body.phone !== undefined)
    data.phone = body.phone ? String(body.phone).trim() : null;

  if (body.role !== undefined) {
    const roleRaw = String(body.role).trim().toUpperCase();
    if (!isUserRole(roleRaw))
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    data.role = roleRaw;
  }

  if (body.password !== undefined) {
    const password = String(body.password ?? "");
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
    data.password = await bcrypt.hash(password, 12);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id },
        select: { role: true },
      });
      if (!existing) return null;

      const user = await tx.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          updatedAt: true,
        },
      });

      // keep profile tables consistent if role changes
      if (data.role && data.role !== existing.role) {
        if (data.role === "SUPERVISOR") {
          await tx.supervisor.upsert({
            where: { userId: id },
            update: {},
            create: { userId: id },
          });
          await tx.foreman.deleteMany({ where: { userId: id } });
        } else if (data.role === "FOREMAN") {
          await tx.foreman.upsert({
            where: { userId: id },
            update: {},
            create: { userId: id },
          });
          await tx.supervisor.deleteMany({ where: { userId: id } });
        } else if (data.role === "ADMIN") {
          await tx.supervisor.deleteMany({ where: { userId: id } });
          await tx.foreman.deleteMany({ where: { userId: id } });
        }
      }

      return user;
    });

    if (!updated)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!requireRole(auth, ["ADMIN"]))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
