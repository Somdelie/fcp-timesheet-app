import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { employeeWhereFor } from "@/lib/employee-scope";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireServerAuth();
    const whereScope = employeeWhereFor(auth);
    const { id } = await params;

    const employee = await prisma.employee.findFirst({
      where: {
        id,
        ...whereScope,
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

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        code: employee.qrCodeValue,
        phone: null, // Add phone field if it exists in your schema
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireServerAuth();
    const whereScope = employeeWhereFor(auth);
    const { id } = await params;

    // Verify employee exists and user has access
    const employee = await prisma.employee.findFirst({
      where: {
        id,
        ...whereScope,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // Soft delete by marking as inactive
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
