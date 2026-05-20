import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ColorBaseType } from "@/generated/prisma/client";
import {
  extractColorsFromOrderPdf,
  extractPricesFromPriceListPdf,
  matchPriceRowToProducts,
  normalizeSupplierName,
  TINT_CATALOGUE_PRODUCT_NAME,
  TINT_CATALOGUE_PRODUCT_SKU,
  detectUnitSizeL,
  type ExtractedColor,
  type ExtractedPriceRow,
} from "@/lib/procurement/colorPdfImporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 60;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (!session?.user || !role || !["ADMIN", "OFFICE"].includes(role))
    return null;
  return { id: (session.user as any).id as string, role };
}

type ColorKey = string; // `${colorName.toLowerCase()}||${baseType}`

type ColorBucket = {
  key: ColorKey;
  colorName: string;
  baseType: ColorBaseType;
  colorCode: string | null;
  isTinted: boolean;
  suppliers: Set<string>; // normalised supplier names
  sourceCount: number;
  examples: string[]; // raw descriptions (capped)
};

type SupplierBucket = {
  normalisedName: string;
  rawNames: Set<string>;
  vendorCode: string | null;
};

function colorKey(colorName: string, baseType: ColorBaseType): ColorKey {
  return `${colorName.trim().toLowerCase()}||${baseType}`;
}

export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (err) {
    console.error("paints-colors/seed-from-pdfs error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 },
    );
  }
}

async function handle(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const action = (formData.get("action") ?? "parse").toString();
  if (action !== "parse" && action !== "import") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const orderFiles = formData.getAll("pdfs");
  const priceListFiles = formData.getAll("priceList");

  if (!orderFiles.length && !priceListFiles.length) {
    return NextResponse.json(
      { error: "No PDFs provided" },
      { status: 400 },
    );
  }
  if (orderFiles.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too many order PDFs (max ${MAX_FILES})` },
      { status: 400 },
    );
  }

  // ── Parse all order PDFs ────────────────────────────────────────────────
  const extractedColors: ExtractedColor[] = [];
  const parseFailures: { fileName: string; reason: string }[] = [];

  for (const entry of orderFiles) {
    if (!(entry instanceof File)) continue;
    if (entry.size > MAX_FILE_SIZE) {
      parseFailures.push({ fileName: entry.name, reason: "File exceeds 10 MB" });
      continue;
    }
    if (
      entry.type !== "application/pdf" &&
      !entry.name.toLowerCase().endsWith(".pdf")
    ) {
      continue;
    }
    const buffer = Buffer.from(await entry.arrayBuffer());
    try {
      const colors = await extractColorsFromOrderPdf(buffer, entry.name);
      if (colors.length === 0) {
        parseFailures.push({
          fileName: entry.name,
          reason: "No colours detected in PDF",
        });
      } else {
        extractedColors.push(...colors);
      }
    } catch (e) {
      parseFailures.push({
        fileName: entry.name,
        reason: e instanceof Error ? e.message : "Parse error",
      });
    }
  }

  // ── Parse price list PDFs ───────────────────────────────────────────────
  const extractedPrices: ExtractedPriceRow[] = [];
  for (const entry of priceListFiles) {
    if (!(entry instanceof File)) continue;
    if (entry.size > MAX_FILE_SIZE) {
      parseFailures.push({ fileName: entry.name, reason: "Price list > 10 MB" });
      continue;
    }
    const buffer = Buffer.from(await entry.arrayBuffer());
    try {
      const rows = await extractPricesFromPriceListPdf(buffer, entry.name);
      extractedPrices.push(...rows);
    } catch (e) {
      parseFailures.push({
        fileName: entry.name,
        reason: e instanceof Error ? e.message : "Price-list parse error",
      });
    }
  }

  // ── Bucket: dedupe colours, gather suppliers ────────────────────────────
  const colorBuckets = new Map<ColorKey, ColorBucket>();
  const supplierBuckets = new Map<string, SupplierBucket>();

  for (const c of extractedColors) {
    if (!c.colorName) continue;
    const key = colorKey(c.colorName, c.baseType);
    let bucket = colorBuckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        colorName: c.colorName,
        baseType: c.baseType,
        colorCode: c.colorCode,
        isTinted: c.isTinted,
        suppliers: new Set(),
        sourceCount: 0,
        examples: [],
      };
      colorBuckets.set(key, bucket);
    }
    if (c.colorCode && !bucket.colorCode) bucket.colorCode = c.colorCode;
    if (c.isTinted) bucket.isTinted = true;
    bucket.sourceCount += 1;
    if (bucket.examples.length < 3) bucket.examples.push(c.rawDescription);

    if (c.vendorName) {
      const norm = normalizeSupplierName(c.vendorName);
      bucket.suppliers.add(norm);
      let sup = supplierBuckets.get(norm);
      if (!sup) {
        sup = {
          normalisedName: norm,
          rawNames: new Set(),
          vendorCode: c.vendorCode ?? null,
        };
        supplierBuckets.set(norm, sup);
      }
      sup.rawNames.add(c.vendorName);
      if (!sup.vendorCode && c.vendorCode) sup.vendorCode = c.vendorCode;
    }
  }

  const colorsPreview = Array.from(colorBuckets.values()).map((b) => ({
    colorName: b.colorName,
    baseType: b.baseType,
    colorCode: b.colorCode,
    isTinted: b.isTinted,
    suppliers: Array.from(b.suppliers),
    sourceCount: b.sourceCount,
    examples: b.examples,
  }));

  const suppliersPreview = Array.from(supplierBuckets.values()).map((s) => ({
    normalisedName: s.normalisedName,
    rawNames: Array.from(s.rawNames),
    vendorCode: s.vendorCode,
  }));

  const pricesPreview = extractedPrices.map((p) => ({
    brand: p.brand,
    productCode: p.productCode,
    productLabel: p.productLabel,
    baseType: p.baseType,
    unitSizeL: p.unitSizeL,
    priceZar: p.priceZar,
    sourceFile: p.sourceFile,
  }));

  // ── PARSE ACTION: return preview only ───────────────────────────────────
  if (action === "parse") {
    return NextResponse.json({
      action: "parse",
      summary: {
        orderPdfs: orderFiles.length,
        priceListPdfs: priceListFiles.length,
        extractedColors: extractedColors.length,
        uniqueColors: colorBuckets.size,
        suppliersDetected: supplierBuckets.size,
        priceRows: extractedPrices.length,
        parseFailures: parseFailures.length,
      },
      colors: colorsPreview,
      suppliers: suppliersPreview,
      prices: pricesPreview,
      parseFailures,
    });
  }

  // ── IMPORT ACTION: stream NDJSON progress while writing to DB ───────────

  const totalUnits =
    supplierBuckets.size +
    1 + // placeholder product
    colorBuckets.size +
    extractedColors.length +
    extractedPrices.length;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let done = 0;

      const emit = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const tick = (phase: string, message: string) => {
        done += 1;
        emit({
          type: "progress",
          phase,
          done,
          total: totalUnits,
          message,
        });
      };

      try {
        emit({
          type: "start",
          total: totalUnits,
          phases: {
            suppliers: supplierBuckets.size,
            placeholderProduct: 1,
            variants: colorBuckets.size,
            orderPriceLinks: extractedColors.length,
            priceListRows: extractedPrices.length,
          },
        });

        // 1. Ensure suppliers exist
        const supplierIdByName = new Map<string, string>();
        for (const s of supplierBuckets.values()) {
          const found = await prisma.supplier.findFirst({
            where: { name: { equals: s.normalisedName, mode: "insensitive" } },
            select: { id: true },
          });
          if (found) {
            supplierIdByName.set(s.normalisedName, found.id);
            tick("suppliers", `Matched supplier ${s.normalisedName}`);
          } else {
            const created = await prisma.supplier.create({
              data: { name: s.normalisedName },
              select: { id: true },
            });
            supplierIdByName.set(s.normalisedName, created.id);
            tick("suppliers", `Created supplier ${s.normalisedName}`);
          }
        }

        // 2. Ensure placeholder Tint Catalogue product
        let tintProduct = await prisma.procurementProduct.findFirst({
          where: { sku: TINT_CATALOGUE_PRODUCT_SKU },
          select: { id: true },
        });
        if (!tintProduct) {
          tintProduct = await prisma.procurementProduct.create({
            data: {
              name: TINT_CATALOGUE_PRODUCT_NAME,
              sku: TINT_CATALOGUE_PRODUCT_SKU,
              normalizedName: TINT_CATALOGUE_PRODUCT_NAME.toLowerCase(),
              description:
                "System placeholder for standalone paint colour variants seeded from order PDFs.",
              productType: "MATERIAL",
              isActive: true,
            },
            select: { id: true },
          });
          tick("placeholderProduct", "Created Paint Tint Catalogue placeholder");
        } else {
          tick("placeholderProduct", "Found existing Tint Catalogue placeholder");
        }

        // 3. Upsert color variants
        const createdVariants: { colorName: string; baseType: ColorBaseType; id: string }[] = [];
        const skippedVariants: { colorName: string; baseType: ColorBaseType; reason: string }[] = [];
        const variantIdByKey = new Map<ColorKey, string>();

        for (const b of colorBuckets.values()) {
          try {
            const existing = await prisma.productColorVariant.findFirst({
              where: {
                productId: tintProduct.id,
                colorName: { equals: b.colorName, mode: "insensitive" },
                baseType: b.baseType,
              },
              select: { id: true, colorCode: true, isTinted: true },
            });
            let id: string;
            if (existing) {
              if (
                (b.colorCode && existing.colorCode !== b.colorCode) ||
                (b.isTinted && !existing.isTinted)
              ) {
                await prisma.productColorVariant.update({
                  where: { id: existing.id },
                  data: {
                    colorCode: existing.colorCode ?? b.colorCode,
                    isTinted: existing.isTinted || b.isTinted,
                  },
                });
              }
              id = existing.id;
              skippedVariants.push({
                colorName: b.colorName,
                baseType: b.baseType,
                reason: "already exists",
              });
              tick("variants", `Skipped existing ${b.colorName} (${b.baseType})`);
            } else {
              const created = await prisma.productColorVariant.create({
                data: {
                  productId: tintProduct.id,
                  colorName: b.colorName,
                  colorCode: b.colorCode,
                  baseType: b.baseType,
                  isTinted: b.isTinted,
                },
                select: { id: true },
              });
              id = created.id;
              createdVariants.push({
                colorName: b.colorName,
                baseType: b.baseType,
                id,
              });
              tick("variants", `Created ${b.colorName} (${b.baseType})`);
            }
            variantIdByKey.set(b.key, id);
          } catch (e) {
            skippedVariants.push({
              colorName: b.colorName,
              baseType: b.baseType,
              reason: e instanceof Error ? e.message : "Insert failed",
            });
            tick("variants", `Error on ${b.colorName}: ${e instanceof Error ? e.message : "failed"}`);
          }
        }

        // 4. Per-color supplier price links from order PDFs
        let createdPriceRows = 0;
        for (const c of extractedColors) {
          if (!c.colorName || !c.vendorName) {
            tick("orderPriceLinks", "(skipped: no vendor/colour)");
            continue;
          }
          const variantId = variantIdByKey.get(colorKey(c.colorName, c.baseType));
          if (!variantId) {
            tick("orderPriceLinks", "(skipped: no variant)");
            continue;
          }
          const norm = normalizeSupplierName(c.vendorName);
          const supplierId = supplierIdByName.get(norm);
          if (!supplierId) {
            tick("orderPriceLinks", "(skipped: no supplier)");
            continue;
          }

          const unitSize = detectUnitSizeL(c.rawDescription);
          const existing = await prisma.supplierProductPrice.findFirst({
            where: {
              supplierId,
              productId: tintProduct.id,
              colorVariantId: variantId,
              unitSize: unitSize ?? undefined,
              uom: unitSize ? "L" : undefined,
            },
            select: { id: true },
          });
          if (existing) {
            tick("orderPriceLinks", `Already linked ${c.colorName} → ${norm}`);
            continue;
          }
          await prisma.supplierProductPrice.create({
            data: {
              supplierId,
              productId: tintProduct.id,
              colorVariantId: variantId,
              uom: unitSize ? "L" : null,
              unitSize: unitSize ?? null,
              price: 0,
              isActive: true,
            },
          });
          createdPriceRows += 1;
          tick("orderPriceLinks", `Linked ${c.colorName} → ${norm}`);
        }

        // 5. Price-list rows → supplier prices for matching products
        const allProducts = extractedPrices.length
          ? await prisma.procurementProduct.findMany({
              where: { isActive: true },
              select: { id: true, name: true, sku: true, normalizedName: true },
            })
          : [];

        let priceListImported = 0;
        let priceListUnmatched = 0;
        let priceListDuplicateMatches = 0;
        const unmatchedPriceLabels: string[] = [];

        for (const p of extractedPrices) {
          if (p.priceZar == null || p.priceZar <= 0) {
            tick("priceListRows", "(skipped: no price)");
            continue;
          }
          const supplierName = p.brand === "PLASCON" ? "Plascon" : "Dulux";
          let supplier = await prisma.supplier.findFirst({
            where: { name: { equals: supplierName, mode: "insensitive" } },
            select: { id: true },
          });
          if (!supplier) {
            supplier = await prisma.supplier.create({
              data: { name: supplierName },
              select: { id: true },
            });
          }

          const matched = matchPriceRowToProducts(p, allProducts);
          if (matched.length === 0) {
            priceListUnmatched += 1;
            if (unmatchedPriceLabels.length < 25)
              unmatchedPriceLabels.push(p.productLabel);
            tick("priceListRows", `Unmatched ${p.productLabel.slice(0, 40)}`);
            continue;
          }
          if (matched.length > 1) priceListDuplicateMatches += 1;

          let perRowImported = 0;
          for (const product of matched) {
            const existing = await prisma.supplierProductPrice.findFirst({
              where: {
                supplierId: supplier.id,
                productId: product.id,
                colorVariantId: null,
                unitSize: p.unitSizeL ?? undefined,
                uom: p.unitSizeL ? "L" : undefined,
              },
              select: { id: true, price: true },
            });
            if (existing) {
              if (Number(existing.price) !== p.priceZar) {
                await prisma.supplierProductPrice.update({
                  where: { id: existing.id },
                  data: { price: p.priceZar },
                });
              }
              continue;
            }
            await prisma.supplierProductPrice.create({
              data: {
                supplierId: supplier.id,
                productId: product.id,
                uom: p.unitSizeL ? "L" : null,
                unitSize: p.unitSizeL ?? null,
                price: p.priceZar,
                isActive: true,
              },
            });
            perRowImported += 1;
          }
          priceListImported += perRowImported;
          const sizeLabel = p.unitSizeL ? `${p.unitSizeL}L ` : "";
          tick(
            "priceListRows",
            `Matched ${matched.length} product${matched.length > 1 ? "s" : ""} for ${p.productCode ?? p.productLabel.slice(0, 30)}: ${sizeLabel}R ${p.priceZar.toFixed(2)}`,
          );
        }

        emit({
          type: "done",
          action: "import",
          summary: {
            orderPdfs: orderFiles.length,
            priceListPdfs: priceListFiles.length,
            uniqueColors: colorBuckets.size,
            variantsCreated: createdVariants.length,
            variantsSkipped: skippedVariants.length,
            suppliersTouched: supplierBuckets.size,
            orderPriceLinksCreated: createdPriceRows,
            priceListRows: extractedPrices.length,
            priceListImported,
            priceListUnmatched,
            priceListDuplicateMatches,
            parseFailures: parseFailures.length,
          },
          createdVariants,
          skippedVariants,
          parseFailures,
          unmatchedPriceLabels,
        });
      } catch (err) {
        emit({
          type: "error",
          error: err instanceof Error ? err.message : "Import failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
