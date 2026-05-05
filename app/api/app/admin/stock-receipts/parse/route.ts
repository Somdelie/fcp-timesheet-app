import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parsePdfBuffer } from "@/lib/buildsmart-parser";
import { prisma } from "@/lib/prisma";
import { matchStockProduct } from "@/lib/stock/stockProductMatcher";

function normalizeForMatch(s: string) {
  return s.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenOverlap(a: string[], b: string[]) {
  const setB = new Set(b);
  const common = a.filter((t) => setB.has(t));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : common.length / union.size;
}

async function suggestForeman(nameHint: string | null): Promise<string | null> {
  if (!nameHint) return null;

  const foremen = await prisma.foreman.findMany({
    include: { user: { select: { id: true, name: true } } },
  });

  const hint = normalizeForMatch(nameHint);
  const hintTokens = hint.split(" ").filter((t) => t.length > 1);

  let best: { id: string; score: number } | null = null;

  for (const f of foremen) {
    const name = normalizeForMatch(f.user?.name ?? "");
    if (!name) continue;

    if (name === hint) return f.id;

    const nameTokens = name.split(" ").filter((t) => t.length > 1);
    const overlap = tokenOverlap(hintTokens, nameTokens);
    if (overlap > 0 && (!best || overlap > best.score)) {
      best = { id: f.id, score: overlap };
    }
  }

  return best && best.score >= 0.4 ? best.id : null;
}

export async function POST(req: NextRequest) {
  await requireAuth({ roles: ["ADMIN"] });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("pdf") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parsePdfBuffer(buffer);
  if (!parsed) {
    return NextResponse.json(
      { error: "Could not parse PDF — ensure it is a valid BuildSmart PO" },
      { status: 422 },
    );
  }

  const [products, suggestedForemanId] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, normalizedName: true, sku: true, category: true },
    }),
    suggestForeman(parsed.foremanNameHint),
  ]);

  const items = parsed.items.map((item) => {
    const match = matchStockProduct(item.rawDescription, products);
    return {
      rawDescription: item.rawDescription,
      productCode: item.productCode,
      quantity: item.quantity,
      unit: item.unit,
      matched: match.matched,
      confidence: match.confidence,
      reason: match.reason,
      productId: match.product?.id ?? null,
      productName: match.product?.name ?? null,
      productCategory: match.product?.category ?? null,
    };
  });

  return NextResponse.json({
    orderNumber: parsed.orderNumber,
    vendorName: parsed.vendorName,
    foremanNameHint: parsed.foremanNameHint,
    suggestedForemanId,
    items,
    rawText: parsed.rawText,
  });
}
