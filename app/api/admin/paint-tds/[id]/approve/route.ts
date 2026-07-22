import { NextResponse } from "next/server";
import type { ProductUom } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/paint-tds/require-admin";

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const cleanNullable = (value: string | null | undefined) => {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
};

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();

  const { id } = await params;

  const imported = await prisma.paintTdsImport.findUnique({
    where: { id },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
      profiles: {
        where: {
          isSelected: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!imported) {
    return NextResponse.json(
      {
        error: "Import not found.",
      },
      {
        status: 404,
      },
    );
  }

  if (!imported.supplierId || !imported.supplier) {
    return NextResponse.json(
      {
        error: "Select a supplier or brand before approving this Paint TDS.",
      },
      {
        status: 400,
      },
    );
  }

  if (!imported.supplier.isActive) {
    return NextResponse.json(
      {
        error: "The selected supplier is inactive.",
      },
      {
        status: 400,
      },
    );
  }

  const productName = imported.productNameDetected?.trim();

  if (!productName) {
    return NextResponse.json(
      {
        error: "Product name is required.",
      },
      {
        status: 400,
      },
    );
  }

  const normalizedName = normalize(productName);

  if (!normalizedName) {
    return NextResponse.json(
      {
        error: "The product name could not be normalised.",
      },
      {
        status: 400,
      },
    );
  }

  const validProfiles = imported.profiles.filter(
    (profile) =>
      profile.rateUnit !== null &&
      profile.rateMin !== null &&
      profile.rateMax !== null &&
      Number(profile.rateMin) > 0 &&
      Number(profile.rateMax) >= Number(profile.rateMin),
  );

  if (!validProfiles.length) {
    return NextResponse.json(
      {
        error: "Select at least one complete rate profile.",
      },
      {
        status: 400,
      },
    );
  }

  const productCode = cleanNullable(imported.productCodeDetected);
  const description = cleanNullable(imported.descriptionDetected);

  const legacyPackSizes = Array.from(
    new Set(
      imported.packSizesLitres.filter(
        (size) => Number.isFinite(size) && size > 0,
      ),
    ),
  ).sort((a, b) => a - b);

  const detectedPackSizes = Array.isArray(imported.packSizes)
    ? imported.packSizes
        .map((value) => {
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            return null;
          }
          const quantity = Number(value.quantity);
          const uom: ProductUom | null =
            value.uom === "KG" ? "KG" : value.uom === "L" ? "L" : null;
          if (!Number.isFinite(quantity) || quantity <= 0 || !uom) return null;
          return {
            quantity,
            uom,
            label:
              typeof value.label === "string" && value.label.trim()
                ? value.label.trim()
                : `${quantity} ${uom === "KG" ? "kg" : "L"}`,
          };
        })
        .filter((value) => value !== null)
    : [];

  const packSizes = detectedPackSizes.length
    ? detectedPackSizes
    : legacyPackSizes.map((quantity) => ({
        quantity,
        uom: "L" as ProductUom,
        label: `${quantity} L`,
      }));
  const firstPack = packSizes[0] ?? null;
  const sizeLabels = packSizes.map((packSize) => packSize.label);

  try {
    const result = await prisma.$transaction(async (tx) => {
      /*
       * 1. Resolve the canonical MasterCatalogueProduct.
       *
       * The schema guarantees uniqueness by:
       * supplierId + normalizedName
       */
      let masterProduct = await tx.masterCatalogueProduct.findUnique({
        where: {
          supplierId_normalizedName: {
            supplierId: imported.supplierId!,
            normalizedName,
          },
        },
      });

      /*
       * A SKU is not globally unique on MasterCatalogueProduct, so only use it
       * as a supplier-scoped fallback.
       */
      if (!masterProduct && productCode) {
        masterProduct = await tx.masterCatalogueProduct.findFirst({
          where: {
            supplierId: imported.supplierId!,
            sku: productCode,
          },
        });
      }

      if (masterProduct) {
        masterProduct = await tx.masterCatalogueProduct.update({
          where: {
            id: masterProduct.id,
          },
          data: {
            name: productName,
            normalizedName,
            description,
            sku: productCode ?? masterProduct.sku,

            category: "Paints",
            productType: "MATERIAL",

            sizes: sizeLabels.length > 0 ? sizeLabels : masterProduct.sizes,

            uom: firstPack?.uom ?? masterProduct.uom,
            unitSize: firstPack?.quantity ?? masterProduct.unitSize,

            isActive: true,
          },
        });
      } else {
        masterProduct = await tx.masterCatalogueProduct.create({
          data: {
            supplierId: imported.supplierId!,
            name: productName,
            normalizedName,
            description,
            sku: productCode,

            category: "Paints",
            productType: "MATERIAL",
            isReturnable: false,

            colors: [],
            sizes: sizeLabels,
            stockQty: 0,

            uom: firstPack?.uom ?? null,
            unitSize: firstPack?.quantity ?? null,

            isDeductible: true,
            deductionSplits: 1,

            usage: "INT_EXT",
            isActive: true,
          },
        });
      }

      /*
       * 2. Resolve the compatibility ProcurementProduct.
       *
       * It must link to the canonical master record through
       * masterCatalogueProductId.
       */
      let procurementProduct = await tx.procurementProduct.findUnique({
        where: {
          masterCatalogueProductId: masterProduct.id,
        },
      });

      /*
       * During migration there may be an older ProcurementProduct that has not
       * yet been linked. Try to reuse it rather than creating a duplicate.
       */
      if (!procurementProduct && productCode) {
        procurementProduct = await tx.procurementProduct.findUnique({
          where: {
            sku: productCode,
          },
        });
      }

      if (!procurementProduct) {
        procurementProduct = await tx.procurementProduct.findFirst({
          where: {
            supplierId: imported.supplierId!,
            normalizedName,
          },
        });
      }

      if (procurementProduct) {
        /*
         * Prevent linking a bridge record that already belongs to another
         * master product.
         */
        if (
          procurementProduct.masterCatalogueProductId &&
          procurementProduct.masterCatalogueProductId !== masterProduct.id
        ) {
          throw new Error(
            `The existing procurement product "${procurementProduct.name}" is already linked to a different master catalogue product.`,
          );
        }

        procurementProduct = await tx.procurementProduct.update({
          where: {
            id: procurementProduct.id,
          },
          data: {
            masterCatalogueProductId: masterProduct.id,

            supplierId: imported.supplierId!,
            name: productName,
            normalizedName,
            description,
            sku: productCode ?? procurementProduct.sku,

            productType: "MATERIAL",

            sizes:
              sizeLabels.length > 0 ? sizeLabels : procurementProduct.sizes,

            uom: firstPack?.uom ?? procurementProduct.uom,

            unitSize:
              firstPack?.quantity ?? procurementProduct.unitSize,

            isActive: true,
          },
        });
      } else {
        procurementProduct = await tx.procurementProduct.create({
          data: {
            masterCatalogueProductId: masterProduct.id,

            supplierId: imported.supplierId!,
            name: productName,
            normalizedName,
            sku: productCode,
            description,

            productType: "MATERIAL",
            isReturnable: false,

            colors: [],
            sizes: sizeLabels,
            stockQty: 0,

            uom: firstPack?.uom ?? null,
            unitSize: firstPack?.quantity ?? null,

            isDeductible: true,
            deductionSplits: 1,
            isActive: true,
          },
        });
      }

      for (const packSize of packSizes) {
        await tx.procurementProductPackSize.upsert({
          where: {
            productId_quantity_uom: {
              productId: procurementProduct.id,
              quantity: packSize.quantity,
              uom: packSize.uom,
            },
          },
          create: {
            productId: procurementProduct.id,
            quantity: packSize.quantity,
            uom: packSize.uom,
            label: packSize.label,
          },
          update: {
            label: packSize.label,
            isActive: true,
          },
        });
      }

      /*
       * 3. Reset the current default coverage profile.
       */
      await tx.procurementProductCoverage.updateMany({
        where: {
          productId: procurementProduct.id,
        },
        data: {
          isDefault: false,
        },
      });

      const preferredDefaultId = validProfiles[0].id;

      /*
       * 4. Create or update the selected coverage profiles.
       */
      for (const profile of validProfiles) {
        const rateMin = Number(profile.rateMin);
        const rateMax = Number(profile.rateMax);
        const rateMode =
          profile.rateUnit === "M2_PER_CONTAINER"
            ? "CONTAINER_COVERAGE"
            : profile.rateUnit === "L_PER_M2" ||
                profile.rateUnit === "KG_PER_M2"
              ? "CONSUMPTION"
              : "COVERAGE";
        const coverageM2PerLitre =
          profile.rateUnit === "M2_PER_L"
            ? Math.round(((rateMin + rateMax) / 2) * 1000) / 1000
            : null;
        const applicationMethods = Array.isArray(profile.applicationMethods)
          ? profile.applicationMethods.map(String)
          : profile.applicationMethod
            ? [profile.applicationMethod]
            : [];

        await tx.procurementProductCoverage.upsert({
          where: {
            productId_name: {
              productId: procurementProduct.id,
              name: profile.name.trim(),
            },
          },
          create: {
            productId: procurementProduct.id,
            name: profile.name.trim(),

            applicationMethod: cleanNullable(profile.applicationMethod),
            applicationMethods,

            rateMode,
            rateUnit: profile.rateUnit!,
            rateMin,
            rateMax,

            /*
             * coverageM2 remains required in your generated client as a
             * legacy compatibility field.
             */
            coverageM2: coverageM2PerLitre,
            coverageM2PerLitre,

            coverageBasis: profile.coverageBasis,
            coverageType: profile.coverageType,
            recommendedCoats: profile.recommendedCoats,
            recommendedCoatsMin: profile.recommendedCoatsMin,
            recommendedCoatsMax: profile.recommendedCoatsMax,

            uom: firstPack?.uom ?? null,
            unitSize: firstPack?.quantity ?? null,

            thicknessMin: profile.thicknessMin,
            thicknessMax: profile.thicknessMax,
            thicknessUnit: profile.thicknessUnit,

            recommendedDftMicrons: profile.recommendedDftMicrons,

            recommendedWftMicrons: profile.recommendedWftMicrons,

            sourceDocument: imported.fileName,
            sourceRevision: cleanNullable(imported.revisionDetected),

            sourceRevisionDate: imported.revisionDateDetected,

            sourcePage: profile.sourcePage,
            manufacturerRateLabel: cleanNullable(
              profile.manufacturerRateLabel,
            ),
            sourceSnippet: cleanNullable(profile.sourceSnippet),
            note: cleanNullable(profile.note),

            isDefault: profile.id === preferredDefaultId,

            isActive: true,
          },
          update: {
            applicationMethod: cleanNullable(profile.applicationMethod),
            applicationMethods,

            rateMode,
            rateUnit: profile.rateUnit!,
            rateMin,
            rateMax,

            coverageM2: coverageM2PerLitre,
            coverageM2PerLitre,

            coverageBasis: profile.coverageBasis,
            coverageType: profile.coverageType,
            recommendedCoats: profile.recommendedCoats,
            recommendedCoatsMin: profile.recommendedCoatsMin,
            recommendedCoatsMax: profile.recommendedCoatsMax,

            uom: firstPack?.uom ?? null,
            unitSize: firstPack?.quantity ?? null,

            thicknessMin: profile.thicknessMin,
            thicknessMax: profile.thicknessMax,
            thicknessUnit: profile.thicknessUnit,

            recommendedDftMicrons: profile.recommendedDftMicrons,

            recommendedWftMicrons: profile.recommendedWftMicrons,

            sourceDocument: imported.fileName,
            sourceRevision: cleanNullable(imported.revisionDetected),

            sourceRevisionDate: imported.revisionDateDetected,

            sourcePage: profile.sourcePage,
            manufacturerRateLabel: cleanNullable(
              profile.manufacturerRateLabel,
            ),
            sourceSnippet: cleanNullable(profile.sourceSnippet),
            note: cleanNullable(profile.note),

            isDefault: profile.id === preferredDefaultId,

            isActive: true,
          },
        });
      }

      /*
       * 5. Mark the TDS import as complete.
       */
      await tx.paintTdsImport.update({
        where: {
          id: imported.id,
        },
        data: {
          status: "IMPORTED",
        },
      });

      return {
        masterCatalogueProductId: masterProduct.id,
        procurementProductId: procurementProduct.id,
      };
    });

    return NextResponse.json({
      success: true,
      productId: result.procurementProductId,
      procurementProductId: result.procurementProductId,
      masterCatalogueProductId: result.masterCatalogueProductId,
    });
  } catch (error) {
    console.error("Paint TDS approval failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to approve and import the Paint TDS.",
      },
      {
        status: 500,
      },
    );
  }
}
