import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth, type ServerAuthUser } from "@/lib/auth-server";
import { getApiAuthContext } from "@/lib/apiAuth";
import { employeeWhereFor } from "@/lib/employee-scope";
import { writeAuditEvent } from "@/lib/audit";
import { randomBytes } from "crypto";

/** Return a phone string only if it looks like a real phone number (not an email). */
function sanitizePhone(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const v of candidates) {
    const s = (v ?? "").trim();
    if (s && !s.includes("@")) return s;
  }
  return null;
}

function cleanPhotoUrl(value: unknown): string | null {
  const url = String(value ?? "").trim();
  return url || null;
}

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

    const activeFilter = show !== "all" ? { isActive: true } : {};
    const searchFilter = q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { qrCodeValue: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const sharedSelect = {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
      faceImageUrl: true,
      isActive: true,
      createdAt: true,
      phone: true,
      userId: true,
      user: {
        select: {
          role: true,
          phone: true,
          foreman: { select: { id: true } },
        },
      },
    } as const;

    // Always fetch ALL foremen employees — older foremen fall off the 500-item page otherwise.
    const [foremenEmployees, regularEmployees] = await Promise.all([
      prisma.employee.findMany({
        where: {
          ...whereScope,
          ...activeFilter,
          ...searchFilter,
          user: { role: "FOREMAN", foreman: { isNot: null } },
        },
        orderBy: { firstName: "asc" },
        select: sharedSelect,
      }),
      prisma.employee.findMany({
        where: {
          ...whereScope,
          ...activeFilter,
          ...searchFilter,
          NOT: { user: { role: "FOREMAN" } },
        },
        orderBy: { createdAt: "desc" },
        take: 1500,
        select: sharedSelect,
      }),
    ]);

    const foremanIds = new Set(foremenEmployees.map((e) => e.id));
    const employees = [
      ...foremenEmployees,
      ...regularEmployees.filter((e) => !foremanIds.has(e.id)),
    ];

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
          phone: sanitizePhone(e.phone, e.user?.phone),
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

    const { firstName, lastName, faceImageUrl, isActive, phone } = body;
    const photoUrl = cleanPhotoUrl(faceImageUrl);

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "firstName and lastName are required" },
        { status: 400 },
      );
    }

    if ((auth.role === "FOREMAN" || auth.role === "SUPERVISOR") && !photoUrl) {
      return NextResponse.json(
        { error: "Employee photo is required." },
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
        phone: phone || null,
        defaultDayRate: dayRate,
        faceImageUrl: photoUrl,
        isActive: isActive !== false,
        qrCodeValue,
        createdByUser: createdByUserId
          ? { connect: { id: createdByUserId } }
          : undefined,
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
    const {
      id,
      firstName,
      lastName,
      defaultDayRate,
      faceImageUrl,
      isActive,
      phone,
    } = body;

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
      ...(phone !== undefined && { phone: (phone ?? "").trim() || null }),
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
        phone: true,
        isActive: true,
        createdAt: true,
        user: { select: { phone: true } },
      },
    });

    if (defaultDayRate !== undefined && isForemanUser) {
      writeAuditEvent({
        actorUserId: auth.userId,
        action: "FOREMAN_DAY_RATE_CHANGE",
        entity: "Employee",
        entityId: id,
        metadata: {
          employeeId: id,
          employeeName: `${existing.firstName} ${existing.lastName}`,
          previousDayRate: Number(existing.defaultDayRate),
          newDayRate: Number(defaultDayRate),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        code: employee.qrCodeValue,
        phone: sanitizePhone(employee.phone, employee.user?.phone),
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
