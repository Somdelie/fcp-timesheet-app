import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { logApiRequest } from "@/lib/apiRequestLogger";

export const runtime = "nodejs";
export const revalidate = 1800;

/**
 * GET /api/app/admin/employees
 * List all employees (optionally filtered to unlinked only, or by search)
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const payload = await verifyApiToken(token);
  if (!payload) {
    const res = NextResponse.json({ error: "Invalid token" }, { status: 401 });
    logApiRequest("/api/app/admin/employees", req.method, res.status);
    return res;
  }

  if (payload.role !== "ADMIN") {
    const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    logApiRequest("/api/app/admin/employees", req.method, res.status);
    return res;
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() || "";
    const unlinked = url.searchParams.get("unlinked") === "true";

    const employees = await prisma.employee.findMany({
      where: {
        ...(q && {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { qrCodeValue: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const res = NextResponse.json(
      {
        ok: true,
        employees: employees.map((emp) => ({
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          qrCodeValue: emp.qrCodeValue,
          userId: emp.user?.id ?? null,
          userName: emp.user?.name ?? null,
          userEmail: emp.user?.email ?? null,
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
    logApiRequest("/api/app/admin/employees", req.method, res.status);
    return res;
  } catch (e: any) {
    const res = NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 },
    );
    logApiRequest("/api/app/admin/employees", req.method, res.status);
    return res;
  }
}
