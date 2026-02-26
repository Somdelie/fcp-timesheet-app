import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth, type ServerAuthUser } from "@/lib/auth-server";
import { getApiAuthContext } from "@/lib/apiAuth";
import { employeeWhereFor } from "@/lib/employee-scope";
import { randomBytes } from "crypto";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Try JWT Bearer token first (mobile app), then fallback to NextAuth session (web app).
 */
async function getAuth(request: NextRequest): Promise<ServerAuthUser | null> {
  // Try JWT Bearer token (mobile app)
  const apiCtx = await getApiAuthContext(request);
  if (apiCtx) {
    return {
      userId: apiCtx.user.sub,
      role: apiCtx.user.role as ServerAuthUser["role"],
    };
  }

  // Fallback to NextAuth session (web app)
  try {
    return await requireServerAuth();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }
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
        userId: true,
        user: {
          select: {
            role: true,
            foreman: { select: { id: true } },
          },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        employees: employees.map((e) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          code: e.qrCodeValue,
          dayRate: Number(e.defaultDayRate),
          active: e.isActive,
          fullName: `${e.firstName} ${e.lastName}`,
          createdAt: e.createdAt.toISOString(),
          photoUrl: e.faceImageUrl ?? null,
          isForeman: !!(e.user?.role === "FOREMAN" && e.user?.foreman),
        })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error("Error listing employees:", error);
    return NextResponse.json(
      { error: "Failed to list employees" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();

    const { firstName, lastName, faceImageUrl, isActive } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "firstName and lastName are required" },
        { status: 400 },
      );
    }

    // Verify the user exists before using as createdByUserId
    const userExists = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true },
    });
    const createdByUserId = userExists ? auth.userId : null;

    const qrCodeValue = randomBytes(8).toString("hex").toUpperCase();

    // Get default day rate from company settings
    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
    });
    // Convert to string for consistent Decimal handling
    const dayRate = settings?.defaultEmployeeDayRate
      ? String(settings.defaultEmployeeDayRate)
      : "0";

    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        defaultDayRate: dayRate,
        faceImageUrl: faceImageUrl ?? null,
        isActive: isActive !== false,
        qrCodeValue,
        createdByUserId,
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
    const auth = await getAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
