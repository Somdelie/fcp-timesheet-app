import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getForemanAccess(userId: string, employeeId: string) {
  const foreman = await prisma.foreman.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!foreman) return null;

  // Check if foreman has access to this employee
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, createdByUserId: true },
  });

  if (!employee) return null;

  // Foreman can access if they created it, have explicit link, or booked them
  const hasAccess =
    employee.createdByUserId === userId ||
    (await prisma.foremanEmployee.findFirst({
      where: { foremanId: foreman.id, employeeId },
    })) ||
    (await prisma.attendanceScan.findFirst({
      where: {
        employeeId,
        siteDay: { foremanId: foreman.id },
      },
    }));

  return hasAccess ? employee : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = getBearer(req);
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyApiToken(token);
    if (!payload || payload.role !== "FOREMAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        qrCodeValue: true,
        defaultDayRate: true,
        faceImageUrl: true,
        isActive: true,
        createdByUserId: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // Verify foreman has access
    const hasAccess = await getForemanAccess(payload.sub, id);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        code: employee.qrCodeValue,
        dayRate: Number(employee.defaultDayRate),
        active: employee.isActive,
        fullName: `${employee.firstName} ${employee.lastName}`,
      },
    });
  } catch (error) {
    console.error("Error fetching employee:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = getBearer(req);
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyApiToken(token);
    if (!payload || !["FOREMAN", "ADMIN"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { createdByUserId: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // Admin can always delete, foreman can only delete their own
    if (
      payload.role === "FOREMAN" &&
      employee.createdByUserId !== payload.sub
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 },
    );
  }
}

// update employee info
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = getBearer(req);
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = await verifyApiToken(token);
    if (!payload || !["FOREMAN", "ADMIN"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const { firstName, lastName, defaultDayRate, faceImageUrl, isActive } =
      body;
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { createdByUserId: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }
    // Admin can always update, foreman can only update their own
    if (
      payload.role === "FOREMAN" &&
      employee.createdByUserId !== payload.sub
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(defaultDayRate !== undefined && {
          defaultDayRate: Number(defaultDayRate),
        }),
        ...(faceImageUrl !== undefined && { faceImageUrl }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        qrCodeValue: true,
        defaultDayRate: true,
        faceImageUrl: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      employee: {
        id: updatedEmployee.id,
        firstName: updatedEmployee.firstName,
        lastName: updatedEmployee.lastName,
        code: updatedEmployee.qrCodeValue,
        dayRate: Number(updatedEmployee.defaultDayRate),
        active: updatedEmployee.isActive,
        fullName: `${updatedEmployee.firstName} ${updatedEmployee.lastName}`,
      },
    });
  } catch (error) {
    console.error("Error updating employee:", error);
    return NextResponse.json(
      { error: "Failed to update employee" },
      { status: 500 },
    );
  }
}
