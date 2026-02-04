import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const token = getBearer(req);
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyApiToken(token);
  if (!payload)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "FOREMAN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const foreman = await prisma.foreman.findUnique({
    where: { userId: payload.sub },
    select: { id: true },
  });
  if (!foreman)
    return NextResponse.json({ error: "Foreman not found" }, { status: 404 });

  // Only allow deleting scans that belong to THIS foreman’s SiteDay
  const scan = await prisma.attendanceScan.findUnique({
    where: { id },
    select: { id: true, siteDay: { select: { foremanId: true } } },
  });

  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (scan.siteDay.foremanId !== foreman.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.attendanceScan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
