import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const importJobTypes = ["BUILDSMART_PDF_ORDER", "BUILDSMART_HISTORICAL_COST"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (!session || !role || !["ADMIN", "OFFICE"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ids = req.nextUrl.searchParams
    .get("ids")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const jobs = await prisma.importJob.findMany({
    where: ids?.length
      ? {
          id: { in: ids },
          type: { in: importJobTypes },
        }
      : {
          type: { in: importJobTypes },
        },
    orderBy: {
      createdAt: "desc",
    },
    take: ids?.length ? undefined : 100,
    select: {
      id: true,
      fileName: true,
      status: true,
      error: true,
      resultJson: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  return NextResponse.json({ jobs });
}
