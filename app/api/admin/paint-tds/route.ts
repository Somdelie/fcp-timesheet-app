import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/paint-tds/require-admin";
import { serialiseTdsImport } from "@/lib/paint-tds/serialise";

export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const status = url.searchParams.get("status")?.toUpperCase() || undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") || 25)),
  );
  const where = {
    ...(status ? { status: status as any } : {}),
    ...(search
      ? {
          OR: [
            { fileName: { contains: search, mode: "insensitive" as const } },
            {
              productNameDetected: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              productCodeDetected: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              manufacturerDetected: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
  const [rows, totalItems] = await prisma.$transaction([
    prisma.paintTdsImport.findMany({
      where,
      include: { profiles: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.paintTdsImport.count({ where }),
  ]);
  return NextResponse.json({
    items: rows.map(serialiseTdsImport),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  });
}
