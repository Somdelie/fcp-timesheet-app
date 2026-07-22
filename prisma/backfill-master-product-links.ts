import { prisma } from "@/lib/prisma";

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function main() {
  const products = await prisma.procurementProduct.findMany({
    where: {
      masterCatalogueProductId: null,
    },
    include: {
      supplier: true,
      category: true,
    },
    orderBy: [
      {
        createdAt: "asc",
      },
      {
        id: "asc",
      },
    ],
  });

  let linked = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let duplicateMatches = 0;
  let failed = 0;

  for (const product of products) {
    const normalizedName =
      normalize(product.normalizedName) || normalize(product.name);

    if (!normalizedName) {
      skipped += 1;

      console.warn(`Skipped product ${product.id}: product has no usable name`);

      continue;
    }

    if (!product.supplierId) {
      skipped += 1;

      console.warn(
        `Skipped "${product.name}" (${product.id}): no supplier or brand is assigned`,
      );

      continue;
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existingMaster = await tx.masterCatalogueProduct.findUnique({
          where: {
            supplierId_normalizedName: {
              supplierId: product.supplierId!,
              normalizedName,
            },
          },
          select: {
            id: true,
          },
        });

        /*
         * Because ProcurementProduct.masterCatalogueProductId is unique,
         * only one ProcurementProduct may point to each master product.
         *
         * Check whether the matching master product has already been claimed
         * before updating it.
         */
        if (existingMaster) {
          const existingLink = await tx.procurementProduct.findFirst({
            where: {
              masterCatalogueProductId: existingMaster.id,
            },
            select: {
              id: true,
              name: true,
            },
          });

          if (existingLink && existingLink.id !== product.id) {
            return {
              status: "duplicate" as const,
              masterId: existingMaster.id,
              linkedProcurementProductId: existingLink.id,
              linkedProcurementProductName: existingLink.name,
            };
          }

          await tx.masterCatalogueProduct.update({
            where: {
              id: existingMaster.id,
            },
            data: {
              name: product.name,
              normalizedName,
              description: product.description,
              sku: product.sku,
              thumbnailUrl: product.thumbnailUrl,
              categoryId: product.categoryId,
              category: product.category?.name ?? "Paints",
              productType: product.productType,
              isReturnable: product.isReturnable,
              colors: product.colors,
              sizes: product.sizes,
              stockQty: product.stockQty,
              uom: product.uom,
              unitSize: product.unitSize,
              isDeductible: product.isDeductible,
              deductionSplits: product.deductionSplits,
              isActive: product.isActive,
            },
          });

          await tx.procurementProduct.update({
            where: {
              id: product.id,
            },
            data: {
              masterCatalogueProductId: existingMaster.id,
            },
          });

          return {
            status: "updated" as const,
            masterId: existingMaster.id,
          };
        }

        const newMaster = await tx.masterCatalogueProduct.create({
          data: {
            supplierId: product.supplierId!,
            name: product.name,
            normalizedName,
            description: product.description,
            sku: product.sku,
            thumbnailUrl: product.thumbnailUrl,
            categoryId: product.categoryId,
            category: product.category?.name ?? "Paints",
            productType: product.productType,
            isReturnable: product.isReturnable,
            colors: product.colors,
            sizes: product.sizes,
            stockQty: product.stockQty,
            uom: product.uom,
            unitSize: product.unitSize,
            isDeductible: product.isDeductible,
            deductionSplits: product.deductionSplits,
            isActive: product.isActive,
          },
          select: {
            id: true,
          },
        });

        await tx.procurementProduct.update({
          where: {
            id: product.id,
          },
          data: {
            masterCatalogueProductId: newMaster.id,
          },
        });

        return {
          status: "created" as const,
          masterId: newMaster.id,
        };
      });

      if (result.status === "duplicate") {
        duplicateMatches += 1;

        console.warn(
          [
            `Duplicate match skipped: "${product.name}" (${product.id})`,
            `Master product: ${result.masterId}`,
            `Already linked to: "${result.linkedProcurementProductName}"`,
            `(${result.linkedProcurementProductId})`,
          ].join(" "),
        );

        continue;
      }

      linked += 1;

      if (result.status === "created") {
        created += 1;
      } else {
        updated += 1;
      }

      console.log(
        `Linked "${product.name}" (${product.id}) -> ${result.masterId}`,
      );
    } catch (error) {
      failed += 1;

      console.error(
        `Failed to process "${product.name}" (${product.id})`,
        error,
      );
    }
  }

  const remainingUnlinked = await prisma.procurementProduct.count({
    where: {
      masterCatalogueProductId: null,
    },
  });

  const totalLinked = await prisma.procurementProduct.count({
    where: {
      masterCatalogueProductId: {
        not: null,
      },
    },
  });

  console.log("\nMaster catalogue backfill completed");
  console.table({
    inspectedThisRun: products.length,
    linkedThisRun: linked,
    masterProductsCreated: created,
    existingMasterProductsUpdated: updated,
    duplicateMatchesSkipped: duplicateMatches,
    skippedMissingInformation: skipped,
    failed,
    totalCurrentlyLinked: totalLinked,
    remainingUnlinked,
  });
}

main()
  .catch((error) => {
    console.error("Master product consolidation backfill failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
