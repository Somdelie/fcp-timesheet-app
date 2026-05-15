import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pdf } from "@react-pdf/renderer";
import React from "react";
import {
  BatchProductOrderDocument,
  type ProductOrderVoucherData,
} from "@/components/orders/pdf/ProductOrderVoucherDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || !role || !["ADMIN", "OFFICE"].includes(role)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS },
    );
  }

  let body: { orders: ProductOrderVoucherData[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400, headers: CORS },
    );
  }

  const orders = body.orders;
  if (
    !Array.isArray(orders) ||
    orders.length === 0 ||
    !orders.every(
      (order) =>
        order.orderNumber &&
        order.recipientName &&
        Array.isArray(order.items) &&
        order.items.length > 0,
    )
  ) {
    return NextResponse.json(
      { error: "Missing required fields in orders" },
      { status: 400, headers: CORS },
    );
  }

  const pdfDoc = React.createElement(BatchProductOrderDocument, {
    orders,
  }) as React.ReactElement<any>;

  const blob = await pdf(pdfDoc as React.ReactElement<any>).toBlob();
  const buffer = Buffer.from(await blob.arrayBuffer());

  const safeRecipient = orders[0].recipientName
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 40);
  const safeOrder = orders[0].orderNumber.replace(/[^a-zA-Z0-9-]/g, "");
  const filename =
    orders.length > 1
      ? `PPE_Tools_Batch_${safeOrder}.pdf`
      : `PPE_Tools_Order_${safeRecipient}_${safeOrder}.pdf`;

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
