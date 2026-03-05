import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmail(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

/**
 * POST /api/app/admin/foremen/:foremanId/assistant
 * Create a foreman assistant from an existing employee
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ foremanId: string }> },
) {
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

  const { foremanId } = await params;
  const body = await req.json();
  const { employeeId, assistantName, assistantEmail, assistantPassword } = body;

  // Validate inputs
  if (!employeeId) {
    return NextResponse.json(
      { error: "employeeId is required" },
      { status: 400 },
    );
  }
  if (!assistantName) {
    return NextResponse.json(
      { error: "assistantName is required" },
      { status: 400 },
    );
  }
  if (!assistantEmail) {
    return NextResponse.json(
      { error: "assistantEmail is required" },
      { status: 400 },
    );
  }
  if (!assistantPassword || assistantPassword.length < 8) {
    return NextResponse.json(
      { error: "assistantPassword must be at least 8 characters" },
      { status: 400 },
    );
  }

  const email = normalizeEmail(assistantEmail);

  try {
    // Check foreman exists
    const foreman = await prisma.foreman.findUnique({
      where: { id: foremanId },
    });
    if (!foreman) {
      return NextResponse.json({ error: "Foreman not found" }, { status: 404 });
    }

    // Check employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          select: { id: true, role: true, name: true, email: true },
        },
      },
    });
    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // If employee already has a user account, we just need to link them
    // If not, we need to create a user account
    let assistantUserId: string;
    let assistantForemanId: string;
    let createdUserName: string | null = null;
    let createdUserEmail: string | null = null;

    if (employee.userId) {
      // Employee already has a user account - just link them
      assistantUserId = employee.userId;
      const existingForeman = await prisma.foreman.findUnique({
        where: { userId: employee.userId },
      });
      if (!existingForeman) {
        return NextResponse.json(
          { error: "Employee user exists but is not a foreman" },
          { status: 400 },
        );
      }
      assistantForemanId = existingForeman.id;
      createdUserName = employee.user?.name ?? null;
      createdUserEmail = employee.user?.email ?? null;
    } else {
      // No user account yet - create one
      // Validate password for new users
      if (!assistantPassword || assistantPassword.length < 8) {
        return NextResponse.json(
          { error: "assistantPassword must be at least 8 characters" },
          { status: 400 },
        );
      }

      const hashedPassword = await bcrypt.hash(assistantPassword, 12);
      const result = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name: assistantName,
            role: "FOREMAN",
          },
        });

        const newForeman = await tx.foreman.create({
          data: {
            user: { connect: { id: newUser.id } },
          },
        });

        await tx.employee.update({
          where: { id: employeeId },
          data: { userId: newUser.id },
        });

        return { userId: newUser.id, foremanId: newForeman.id, newUser };
      });

      assistantUserId = result.userId;
      assistantForemanId = result.foremanId;
      createdUserName = result.newUser.name;
      createdUserEmail = result.newUser.email;
    }

    // Now create the ForemanAssistant link
    await prisma.foremanAssistant.create({
      data: {
        foreman: { connect: { id: foremanId } },
        employee: { connect: { id: employeeId } },
        startsOn: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      assistant: {
        assistantUserId,
        assistantForemanId,
        employeeId,
        linkedToForemanId: foremanId,
        assistantEmail: createdUserEmail,
        assistantName: createdUserName,
      },
    });
  } catch (e: any) {
    // Handle unique constraint violation (duplicate email)
    if (e?.code === "P2002") {
      const field = e?.meta?.target?.[0] ?? "email";
      return NextResponse.json(
        { error: `${field} already exists` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
