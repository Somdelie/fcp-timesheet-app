import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth, type ServerAuthUser } from "@/lib/auth-server";
import { getApiAuthContext } from "@/lib/apiAuth";
import { employeeWhereFor } from "@/lib/employee-scope";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

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

export async function POST(
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
      select: { id: true, isActive: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Toggle active status
    const updated = await prisma.employee.update({
      where: { id },
      data: { isActive: !employee.isActive },
      select: { id: true, isActive: true },
    });

    return NextResponse.json(
      { ok: true, active: updated.isActive },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error("Error toggling employee active status:", error);
    return NextResponse.json(
      { error: "Failed to toggle employee status" },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
