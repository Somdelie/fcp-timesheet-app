import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  normalizeProductName,
  parseBuildSmartProduct,
} from "@/lib/product-color-parser";
import {
  isNumericCostCode,
  normalizeBuildSmartProductCode,
  normalizeSkuKey,
} from "@/lib/procurement/buildsmartProductCodes";
import { mergeProcurementProducts } from "@/lib/procurement/mergeProcurementProducts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CleanupProduct = {
  id: string;
  name: string;
  sku: string | null;
  productType: string;
  normalizedName: string | null;
  _count: {
    orderItems: number;
    supplierPrices: number;
    plantAssignments: number;
    ppeOrderItems: number;
  };
};

type CleanupSummary = {
  scanned: number;
  nameUpdated: number;
  skuSet: number;
  skuCleared: number;
  variantsCreated: number;
  merged: number;
  skipped: number;
  changes: {
    id: string;
    before: string;
    after: string;
    sku: string | null;
    colorVariant: { colorName: string; baseType: string } | null;
  }[];
};

type ProgressEvent = {
  phase: string;
  done: number;
  total: number;
  message: string;
};

function cleanupScore(product: CleanupProduct) {
  return (
    (product.sku && !isNumericCostCode(product.sku) ? 1000 : 0) +
    product._count.orderItems * 10 +
    product._count.plantAssignments * 10 +
    product._count.ppeOrderItems * 10 +
    product._count.supplierPrices * 4 -
    product.name.length / 100
  );
}

async function loadProducts() {
  return prisma.procurementProduct.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      productType: true,
      normalizedName: true,
      _count: {
        select: {
          orderItems: true,
          supplierPrices: true,
          plantAssignments: true,
          ppeOrderItems: true,
        },
      },
    },
  });
}

async function runCleanup(onProgress?: (event: ProgressEvent) => void) {
  const progress = (event: ProgressEvent) => onProgress?.(event);

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (!session || !["ADMIN", "OFFICE"].includes(role ?? "")) {
    throw new Error("Unauthorized");
  }

  progress({
    phase: "load",
    done: 0,
    total: 1,
    message: "Loading products...",
  });
  const products = await loadProducts();
  progress({
    phase: "load",
    done: 1,
    total: 1,
    message: `Loaded ${products.length} products`,
  });

  const skuOwner = new Map<string, string>();
  for (const product of products) {
    if (product.sku && !isNumericCostCode(product.sku)) {
      const skuKey = normalizeSkuKey(product.sku);
      if (!skuOwner.has(skuKey)) {
        skuOwner.set(skuKey, product.id);
      }
    }
  }

  let nameUpdated = 0;
  let skuSet = 0;
  let skuCleared = 0;
  let variantsCreated = 0;
  let skipped = 0;

  const changes: CleanupSummary["changes"] = [];

  let cleaned = 0;
  for (const product of products) {
    const {
      cleanName,
      sku: parsedSku,
      colorName,
      baseType,
      isTinted,
    } = parseBuildSmartProduct(product.name);
    const safeName = cleanName.length > 0 ? cleanName : product.name.trim();
    const normalizedName = normalizeProductName(safeName);

    let newSku = product.sku;
    if (newSku && isNumericCostCode(newSku)) {
      newSku = null;
    } else if (newSku) {
      const normalizedSku =
        normalizeBuildSmartProductCode(newSku) ?? newSku.trim();
      const owner = skuOwner.get(normalizeSkuKey(normalizedSku));
      newSku = !owner || owner === product.id ? normalizedSku : null;
    }

    const candidateSku =
      parsedSku && !isNumericCostCode(parsedSku)
        ? (normalizeBuildSmartProductCode(parsedSku) ?? parsedSku)
        : null;

    if (!newSku && candidateSku) {
      const owner = skuOwner.get(normalizeSkuKey(candidateSku));
      if (!owner || owner === product.id) {
        newSku = candidateSku;
        skuOwner.set(normalizeSkuKey(candidateSku), product.id);
      }
    }

    const nameChanged = safeName !== product.name;
    const skuChanged = newSku !== product.sku;
    const normalizedNameChanged = normalizedName !== product.normalizedName;

    if (nameChanged || skuChanged || normalizedNameChanged) {
      await prisma.procurementProduct.update({
        where: { id: product.id },
        data: {
          ...(nameChanged ? { name: safeName } : {}),
          ...(skuChanged ? { sku: newSku } : {}),
          ...(normalizedNameChanged ? { normalizedName } : {}),
        },
      });
      if (skuChanged && newSku) {
        skuOwner.set(normalizeSkuKey(newSku), product.id);
      }
      if (nameChanged) nameUpdated++;
      if (skuChanged && newSku) skuSet++;
      if (skuChanged && !newSku) skuCleared++;
    }

    let variantCreated: { colorName: string; baseType: string } | null = null;
    if (colorName) {
      const exists = await prisma.productColorVariant.findFirst({
        where: {
          productId: product.id,
          colorName: { equals: colorName, mode: "insensitive" },
          baseType,
        },
        select: { id: true },
      });

      if (!exists) {
        try {
          await prisma.productColorVariant.create({
            data: {
              productId: product.id,
              colorName,
              baseType,
              isTinted,
            },
          });
          variantsCreated++;
          variantCreated = { colorName, baseType };
        } catch {
          // Unique race: another request created it.
        }
      }
    }

    if (
      !nameChanged &&
      !skuChanged &&
      !normalizedNameChanged &&
      !variantCreated
    ) {
      skipped++;
    } else {
      changes.push({
        id: product.id,
        before: product.name,
        after: nameChanged ? safeName : product.name,
        sku: newSku,
        colorVariant: variantCreated,
      });
    }

    cleaned++;
    if (cleaned === products.length || cleaned % 25 === 0) {
      progress({
        phase: "clean",
        done: cleaned,
        total: products.length,
        message: `Cleaning products ${cleaned}/${products.length}`,
      });
    }
  }
  if (products.length === 0) {
    progress({
      phase: "clean",
      done: 0,
      total: 0,
      message: "No products to clean",
    });
  }

  progress({
    phase: "group",
    done: 0,
    total: 1,
    message: "Finding duplicate groups...",
  });
  const cleanedProducts = await loadProducts();
  const groups = new Map<string, CleanupProduct[]>();
  for (const product of cleanedProducts) {
    const skuKey =
      product.sku && !isNumericCostCode(product.sku)
        ? normalizeSkuKey(product.sku)
        : null;
    const key = skuKey
      ? `${product.productType}:sku:${skuKey}`
      : `${product.productType}:name:${normalizeProductName(product.name)}`;
    const group = groups.get(key) ?? [];
    group.push(product);
    groups.set(key, group);
  }

  const duplicateGroups = Array.from(groups.values()).filter(
    (group) => group.length > 1,
  );
  const totalMergeCandidates = duplicateGroups.reduce(
    (sum, group) => sum + group.length - 1,
    0,
  );
  progress({
    phase: "merge",
    done: 0,
    total: totalMergeCandidates,
    message:
      totalMergeCandidates > 0
        ? `Merging ${totalMergeCandidates} duplicate products...`
        : "No duplicates to merge",
  });

  let merged = 0;
  for (const group of duplicateGroups) {
    const sorted = [...group].sort((a, b) => {
      const diff = cleanupScore(b) - cleanupScore(a);
      return diff || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });
    const target = sorted[0];

    for (const source of sorted.slice(1)) {
      try {
        await prisma.$transaction(
          async (tx) => {
            if (!target.sku && source.sku && !isNumericCostCode(source.sku)) {
              await tx.procurementProduct.update({
                where: { id: source.id },
                data: { sku: null },
              });
              await tx.procurementProduct.update({
                where: { id: target.id },
                data: { sku: source.sku },
              });
            } else if (
              target.sku &&
              source.sku &&
              normalizeSkuKey(target.sku) === normalizeSkuKey(source.sku)
            ) {
              await tx.procurementProduct.update({
                where: { id: source.id },
                data: { sku: null },
              });
            }

            await mergeProcurementProducts(tx, source.id, target.id);
          },
          { maxWait: 10000, timeout: 30000 },
        );
        merged++;
        progress({
          phase: "merge",
          done: merged,
          total: totalMergeCandidates,
          message: `Merged ${merged}/${totalMergeCandidates} duplicates`,
        });
      } catch (error) {
        console.error("cleanup-product-names merge skipped:", error);
        progress({
          phase: "merge",
          done: Math.min(merged + 1, totalMergeCandidates),
          total: totalMergeCandidates,
          message: "Skipped a duplicate that could not be merged",
        });
      }
    }
  }

  return {
    scanned: products.length,
    nameUpdated,
    skuSet,
    skuCleared,
    variantsCreated,
    merged,
    skipped,
    changes,
  } satisfies CleanupSummary;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const streamProgress = url.searchParams.get("stream") === "true";

  if (!streamProgress) {
    try {
      const summary = await runCleanup();
      return NextResponse.json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cleanup failed";
      return NextResponse.json(
        { error: message },
        { status: message === "Unauthorized" ? 401 : 500 },
      );
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const summary = await runCleanup((event) => {
          write({ type: "progress", ...event });
        });
        write({ type: "done", summary });
      } catch (error) {
        write({
          type: "error",
          error: error instanceof Error ? error.message : "Cleanup failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
