import type { Prisma } from "@/generated/prisma/client";

type MergeTx = Prisma.TransactionClient;

export async function mergeProcurementProducts(
  tx: MergeTx,
  sourceId: string,
  targetId: string,
) {
  if (sourceId === targetId) return;

  const [source, target] = await Promise.all([
    tx.procurementProduct.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        stockQty: true,
        colors: true,
        sizes: true,
        supplierId: true,
      },
    }),
    tx.procurementProduct.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        colors: true,
        sizes: true,
        supplierId: true,
      },
    }),
  ]);

  if (!source || !target) {
    throw new Error("Source or target product not found");
  }

  const sourceSiteMaterials = await tx.siteMaterial.findMany({
    where: { productId: sourceId },
    select: { id: true, siteId: true },
  });
  for (const siteMaterial of sourceSiteMaterials) {
    const existingTarget = await tx.siteMaterial.findUnique({
      where: { siteId_productId: { siteId: siteMaterial.siteId, productId: targetId } },
      select: { id: true },
    });

    if (existingTarget) {
      await tx.siteMaterialUsage.updateMany({
        where: { siteMaterialId: siteMaterial.id },
        data: { siteMaterialId: existingTarget.id },
      });
      await tx.siteFinishingScheduleItem.updateMany({
        where: { siteMaterialId: siteMaterial.id },
        data: { siteMaterialId: existingTarget.id },
      });
      await tx.siteMaterial.delete({ where: { id: siteMaterial.id } });
    } else {
      await tx.siteMaterial.update({
        where: { id: siteMaterial.id },
        data: { productId: targetId },
      });
    }
  }

  const sourceVariantStocks = await tx.productVariantStock.findMany({
    where: { productId: sourceId },
    select: { id: true, size: true, color: true, qty: true },
  });
  for (const stock of sourceVariantStocks) {
    const targetStock = await tx.productVariantStock.findFirst({
      where: {
        productId: targetId,
        size: stock.size,
        color: stock.color,
      },
      select: { id: true },
    });

    if (targetStock) {
      await tx.productVariantStock.update({
        where: { id: targetStock.id },
        data: { qty: { increment: stock.qty } },
      });
      await tx.productVariantStock.delete({ where: { id: stock.id } });
    } else {
      await tx.productVariantStock.update({
        where: { id: stock.id },
        data: { productId: targetId },
      });
    }
  }

  const sourceColorVariants = await tx.productColorVariant.findMany({
    where: { productId: sourceId },
    select: { id: true, colorName: true, baseType: true },
  });
  for (const variant of sourceColorVariants) {
    const targetVariant = await tx.productColorVariant.findFirst({
      where: {
        productId: targetId,
        colorName: { equals: variant.colorName, mode: "insensitive" },
        baseType: variant.baseType,
      },
      select: { id: true },
    });

    if (targetVariant) {
      await tx.supplierProductPrice.updateMany({
        where: { colorVariantId: variant.id },
        data: { colorVariantId: targetVariant.id },
      });
      await tx.productColorVariant.delete({ where: { id: variant.id } });
    } else {
      await tx.productColorVariant.update({
        where: { id: variant.id },
        data: { productId: targetId },
      });
    }
  }

  await tx.siteProductOrderItem.updateMany({
    where: { productId: sourceId },
    data: { productId: targetId },
  });
  await tx.sitePlantAssignment.updateMany({
    where: { productId: sourceId },
    data: { productId: targetId },
  });
  await tx.plantTransfer.updateMany({
    where: { productId: sourceId },
    data: { productId: targetId },
  });
  await tx.sitePaintPlan.updateMany({
    where: { productId: sourceId },
    data: { productId: targetId },
  });
  await tx.foremanPpeOrderItem.updateMany({
    where: { productId: sourceId },
    data: { productId: targetId },
  });
  await tx.siteFinishingScheduleItem.updateMany({
    where: { procurementProductId: sourceId },
    data: { procurementProductId: targetId },
  });
  await tx.procurementProductCoverage.updateMany({
    where: { productId: sourceId },
    data: { productId: targetId },
  });
  await tx.supplierProductPrice.updateMany({
    where: { productId: sourceId },
    data: { productId: targetId },
  });

  await tx.procurementProduct.update({
    where: { id: targetId },
    data: {
      stockQty: { increment: source.stockQty },
      colors: Array.from(new Set([...target.colors, ...source.colors])),
      sizes: Array.from(new Set([...target.sizes, ...source.sizes])),
      ...(target.supplierId || !source.supplierId
        ? {}
        : { supplierId: source.supplierId }),
    },
  });

  await tx.procurementProduct.delete({ where: { id: sourceId } });
}
