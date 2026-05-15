import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pdf } from "@react-pdf/renderer";
import React from "react";
import {
  PpeIssueVoucherDocument,
  type PpeIssueVoucherData,
  type PpeMultiOrderData,
} from "@/components/orders/pdf/PpeIssueOrderDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "OFFICE", "SUPERVISOR"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function normalizeVoucherData(
  body: PpeIssueVoucherData | PpeMultiOrderData,
): PpeIssueVoucherData | null {
  const withForemen = body as PpeIssueVoucherData;
  if (Array.isArray(withForemen.foremen) && withForemen.foremen.length > 0) {
    return withForemen;
  }
  const legacy = body as PpeMultiOrderData;
  if (!Array.isArray(legacy.orders) || legacy.orders.length === 0) {
    return null;
  }
  return {
    orderNumber: legacy.orderNumber,
    issuedDate: legacy.issuedDate,
    supervisorName: legacy.supervisorName,
    foremen: legacy.orders,
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  let raw: PpeIssueVoucherData | PpeMultiOrderData;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: CORS });
  }

  const data = normalizeVoucherData(raw);
  if (
    !data ||
    !data.orderNumber ||
    !data.supervisorName ||
    data.foremen.every((f) => !f.items || f.items.length === 0)
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: CORS });
  }

  const pdfDoc = React.createElement(PpeIssueVoucherDocument, { data }) as React.ReactElement<any>;
  const blob = await pdf(pdfDoc as React.ReactElement<any>).toBlob();
  const buffer = Buffer.from(await blob.arrayBuffer());

  const safeForeman = (data.foremen[0]?.foremanName ?? "Multi-Foreman")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 40);
  const safeOrder = data.orderNumber.replace(/[^a-zA-Z0-9-]/g, "");
  const filename = `PPE_Issue_Voucher_${safeForeman}_${safeOrder}.pdf`;

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
