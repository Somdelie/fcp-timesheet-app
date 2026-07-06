import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (!session || !role || !["ADMIN", "OFFICE"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.importJob.findMany({
    where: {
      type: "BUILDSMART_PDF_ORDER",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
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
