import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth, type ServerAuthUser } from "@/lib/auth-server";
import { getApiAuthContext } from "@/lib/apiAuth";
import { employeeWhereFor } from "@/lib/employee-scope";
import { deleteImage } from "@/lib/cloudinary";

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

// Force recompile - supports Bearer token auth for desktop app
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }
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
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        user: {
          select: {
            phone: true,
            role: true,
            foreman: { select: { id: true } },
          },
        },
        foremanLinks: {
          select: {
            foremanId: true,
            reason: true,
            foreman: {
              select: {
                id: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    const isForeman = !!(
      employee.user?.role === "FOREMAN" && employee.user?.foreman
    );

    return NextResponse.json(
      {
        ok: true,
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          code: employee.qrCodeValue,
          phone: sanitizePhone(employee.phone, employee.user?.phone),
          dayRate: Number(employee.defaultDayRate),
          faceImageUrl: employee.faceImageUrl,
          active: employee.isActive,
          fullName: `${employee.firstName} ${employee.lastName}`,
          createdAt: employee.createdAt.toISOString(),
          updatedAt: employee.updatedAt.toISOString(),
          isForeman,
          foremanLinks: employee.foremanLinks,
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error("Error fetching employee:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }
    const whereScope = employeeWhereFor(auth);
    const { id } = await params;

    // Verify employee exists and user has access
    const employee = await prisma.employee.findFirst({
      where: {
        id,
        ...whereScope,
      },
      select: { id: true, faceImageUrl: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Delete face image from Cloudinary if present
    if (employee.faceImageUrl) {
      const match = employee.faceImageUrl.match(
        /\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/,
      );
      const publicId = match?.[1] ?? null;
      if (publicId) await deleteImage(publicId).catch(() => {});
    }

    // Soft delete by marking as inactive
    await prisma.employee.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
