import { NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** All ProductUom values from the Prisma enum (keep in sync with schema). */
const PRODUCT_UOM = [
  // Length
  { value: "MM", label: "mm", group: "Length" },
  { value: "CM", label: "cm", group: "Length" },
  { value: "M", label: "m", group: "Length" },
  { value: "M2", label: "m²", group: "Length" },
  { value: "M3", label: "m³", group: "Length" },
  // Weight
  { value: "G", label: "g", group: "Weight" },
  { value: "KG", label: "kg", group: "Weight" },
  { value: "TON", label: "ton", group: "Weight" },
  // Volume
  { value: "ML", label: "ml", group: "Volume" },
  { value: "L", label: "L", group: "Volume" },
  // Packaging
  { value: "UNIT", label: "unit", group: "Packaging" },
  { value: "PIECE", label: "piece", group: "Packaging" },
  { value: "PACK", label: "pack", group: "Packaging" },
  { value: "BOX", label: "box", group: "Packaging" },
  { value: "BAG", label: "bag", group: "Packaging" },
  { value: "BUCKET", label: "bucket", group: "Packaging" },
  { value: "DRUM", label: "drum", group: "Packaging" },
  { value: "CAN", label: "can", group: "Packaging" },
  { value: "BOTTLE", label: "bottle", group: "Packaging" },
  { value: "TUBE", label: "tube", group: "Packaging" },
  { value: "BAR", label: "bar", group: "Packaging" },
  // Sheet / Roll / Bulk
  { value: "ROLL", label: "roll", group: "Bulk" },
  { value: "SHEET", label: "sheet", group: "Bulk" },
  { value: "BUNDLE", label: "bundle", group: "Bulk" },
  { value: "PALLET", label: "pallet", group: "Bulk" },
  // Time-based
  { value: "HOUR", label: "hour", group: "Time" },
  { value: "DAY", label: "day", group: "Time" },
];

/**
 * GET /api/app/admin/product-uoms
 * Returns the list of available product UOM values for dropdowns.
 */
export async function GET(req: Request) {
  // Quick auth check (any logged-in ADMIN or OFFICE)
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  let authed = false;
  if (token) {
    const p = await verifyApiToken(token);
    if (p && (p.role === "ADMIN" || p.role === "OFFICE")) authed = true;
  }
  if (!authed) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role as string | undefined;
    if (session?.user && (role === "ADMIN" || role === "OFFICE")) authed = true;
  }
  if (!authed)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS },
    );

  return NextResponse.json({ ok: true, data: PRODUCT_UOM }, { headers: CORS });
}
