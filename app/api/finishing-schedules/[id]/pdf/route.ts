import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { pdf } from "@react-pdf/renderer";
import React from "react";
import { getFinishingSchedulePdfData } from "@/lib/finishing-schedules/getFinishingSchedulePdfData";
import { mapFinishingScheduleToPdfDto } from "@/lib/finishing-schedules/mapFinishingScheduleToPdfDto";
import { FinishingSchedulePdfDocument } from "@/components/finishing-schedules/pdf/FinishingSchedulePdfDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "OFFICE", "SUPERVISOR"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Dual auth: Bearer token (desktop/mobile) or cookie session (web) */
async function getAuth(req: NextRequest) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (token) {
    const p = await verifyApiToken(token);
    if (p && ALLOWED_ROLES.includes(p.role)) return { id: p.sub, role: p.role };
  }
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (session?.user && role && ALLOWED_ROLES.includes(role))
    return { id: (session.user as any).id as string, role };
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuth(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS },
    );
  }

  const { id } = await params;

  const schedule = await getFinishingSchedulePdfData(id);
  if (!schedule) {
    return NextResponse.json(
      { error: "Finishing schedule not found" },
      { status: 404 },
    );
  }

  const dto = mapFinishingScheduleToPdfDto(schedule);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDoc = React.createElement(FinishingSchedulePdfDocument, {
    data: dto,
  }) as any;

  const blob = await pdf(pdfDoc).toBlob();
  const buffer = Buffer.from(await blob.arrayBuffer());

  const safeSiteName = dto.siteName
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 60);

  const filename = `Finishing_Schedule_${safeSiteName}_${dto.contractNo.replace(/[^a-zA-Z0-9-]/g, "")}.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
