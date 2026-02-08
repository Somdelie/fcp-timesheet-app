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

    const sites = await prisma.site.findMany({
      where: {
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
            { location: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(isActive && {
          isActive: isActive === "true",
        }),
      },
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      ok: true,
      sites: sites.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        location: s.location,
        isActive: s.isActive,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (e: any) {
    console.error("Error fetching sites:", e);
    return NextResponse.json(
      { error: "Failed to fetch sites" },
      { status: 500 },
    );
  }
}
