import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  if (user?.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("q")?.trim().toLowerCase() || "";
    const isActive = url.searchParams.get("isActive");

    const employees = await prisma.employee.findMany({
      where: {
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { qrCodeValue: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(isActive && {
          isActive: isActive === "true",
        }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        qrCodeValue: true,
        isActive: true,
        defaultDayRate: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      ok: true,
      employees: employees.map((e) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        fullName: `${e.firstName} ${e.lastName}`.trim(),
        qrCodeValue: e.qrCodeValue,
        isActive: e.isActive,
        defaultDayRate: e.defaultDayRate,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (e: any) {
    console.error("Error fetching employees:", e);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 },
    );
  }
}
