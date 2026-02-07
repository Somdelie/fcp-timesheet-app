import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { employeeWhereFor } from "@/lib/employee-scope";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireServerAuth();
    const whereScope = employeeWhereFor(auth);

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.trim() ?? "";
    const show = searchParams.get("show") ?? "active";

    const employees = await prisma.employee.findMany({
      where: {
        ...whereScope,
        ...(show !== "all" ? { isActive: true } : {}),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { qrCodeValue: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
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
      employees: employees.map((e) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        code: e.qrCodeValue,
        dayRate: Number(e.defaultDayRate),
        active: e.isActive,
        fullName: `${e.firstName} ${e.lastName}`,
      })),
    });
  } catch (error) {
    console.error("Error listing employees:", error);
    return NextResponse.json(
      { error: "Failed to list employees" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireServerAuth();
    const body = await request.json();

    const { firstName, lastName, faceImageUrl, isActive } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "firstName and lastName are required" },
        { status: 400 },
      );
    }

    const qrCodeValue = randomBytes(8).toString("hex").toUpperCase();

    // Get default day rate from company settings
    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
    });
    const dayRate = settings?.defaultEmployeeDayRate || "0";

    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        defaultDayRate: dayRate as any,
        faceImageUrl: faceImageUrl ?? null,
        isActive: isActive !== false,
        qrCodeValue,
        createdByUserId: auth.userId,
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

    return NextResponse.json(
      {
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
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating employee:", error);
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireServerAuth();

    // Only admin can edit employees
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, firstName, lastName, defaultDayRate, faceImageUrl, isActive } =
      body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Verify employee exists
    const existing = await prisma.employee.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // Check if this employee is a foreman
    const isForemanUser = existing.createdByUserId
      ? await prisma.foreman.findFirst({
          where: { userId: existing.createdByUserId },
        })
      : null;

    const updateData: any = {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(faceImageUrl !== undefined && { faceImageUrl }),
      ...(isActive !== undefined && { isActive }),
    };

    // Only allow day rate edit if it's a foreman user
    if (defaultDayRate !== undefined) {
      if (isForemanUser) {
        updateData.defaultDayRate = Number(defaultDayRate);
      } else {
        return NextResponse.json(
          {
            error:
              "Cannot edit day rate for regular employees. Use company settings to change the default day rate.",
          },
          { status: 400 },
        );
      }
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
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
    console.error("Error updating employee:", error);
    return NextResponse.json(
      { error: "Failed to update employee" },
      { status: 500 },
    );
  }
}
