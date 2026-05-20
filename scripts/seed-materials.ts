import fs from "fs/promises";
import path from "path";
// use native numbers instead of decimal.js to avoid extra dependency
import { prisma } from "../lib/prisma";

type SeedVariant = {
  size?: string;
  color?: string;
  price?: number;
  code?: string;
};

type SeedEntry = {
  name: string;
  code?: string;
  productType?: string;
  brand?: string;
  colors?: string[];
  sizes?: string[];
  variants?: SeedVariant[];
  stockQty?: number;
  isReturnable?: boolean;
};

function normalizeSeedNameAndCode(entry: SeedEntry) {
  let name = String(entry.name ?? "").trim();
  let code = entry.code?.trim();

  if (!code) {
    const directMatch = name.match(/^\s*([A-Z]{1,4}\d[0-9A-Z]*)\s+(.+)$/);
    if (directMatch) {
      code = directMatch[1];
      name = directMatch[2].trim();
    } else {
      const splitMatch = name.match(
        /^\s*([A-Z]{2,4})\s+([0-9][0-9A-Z]*)\s+(.+)$/,
      );
      if (splitMatch) {
        code = `${splitMatch[1]}${splitMatch[2]}`;
        name = splitMatch[3].trim();
      } else {
        const hyphenMatch = name.match(/^\s*([A-Z]{2,4})\s*-\s*(.+)$/);
        if (hyphenMatch) {
          code = hyphenMatch[1];
          name = hyphenMatch[2].trim();
        }
      }
    }
  }

  if (!code) {
    for (const variant of entry.variants ?? []) {
      if (variant.code?.trim()) {
        code = variant.code.trim();
        break;
      }
    }
  }

  return { name, code: code ? code.toUpperCase() : null };
}

function normalizeUom(raw: string | null | undefined) {
  if (!raw) return null;
  const u = raw.trim().toUpperCase();
  const map: Record<string, string> = {
    LT: "L",
    LTR: "L",
    LITRE: "L",
    LITRES: "L",
    LITER: "L",
    LITERS: "L",
    KG: "KG",
    KGS: "KG",
    GRAM: "G",
    GRAMS: "G",
    ML: "ML",
    Mls: "ML",
    MLT: "ML",
    M3: "M3",
    M2: "M2",
    CM: "CM",
    MM: "MM",
    EACH: "EACH",
    UNIT: "UNIT",
    PIECE: "PIECE",
    PACK: "PACK",
    BOX: "BOX",
    BAG: "BAG",
    BUCKET: "BUCKET",
    DRUM: "DRUM",
    CAN: "CAN",
    BOTTLE: "BOTTLE",
    TUBE: "TUBE",
    BAR: "BAR",
    ROLL: "ROLL",
    SHEET: "SHEET",
    BUNDLE: "BUNDLE",
    TON: "TON",
  };
  if (map[u]) return map[u] as any;
  if (
    [
      "MM",
      "CM",
      "M",
      "M2",
      "M3",
      "G",
      "KG",
      "TON",
      "ML",
      "L",
      "UNIT",
      "PIECE",
      "PACK",
      "BOX",
      "BAG",
      "BUCKET",
      "DRUM",
      "CAN",
      "BOTTLE",
      "TUBE",
      "BAR",
      "EACH",
      "ROLL",
      "SHEET",
      "BUNDLE",
    ].includes(u)
  ) {
    return u as any;
  }
  return null;
}

function parseSize(size?: string) {
  if (!size) return { unitSize: null, uom: null };
  const m = String(size)
    .trim()
    .match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]+)$/);
  if (!m)
    return { unitSize: null as number | null, uom: null as string | null };
  return { unitSize: parseFloat(m[1]), uom: normalizeUom(m[2]) };
}

async function seedFile(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  let entriesRaw: any = JSON.parse(raw);

  // support two formats:
  // 1) full-materials-seed-with-prices.json where each row is a variant: { brand, name, productType, variant: { size, color, price } }
  // 2) aggregated files where each row is a material with `variants` array
  const entries: SeedEntry[] = [];
  if (
    Array.isArray(entriesRaw) &&
    entriesRaw.length > 0 &&
    entriesRaw[0].variant
  ) {
    // aggregate variants by material name + brand
    const map = new Map<string, SeedEntry & { variants: SeedVariant[] }>();
    for (const r of entriesRaw) {
      const brand = (r.brand || "").trim() || "Plascon";
      const name = (r.name || "").trim();
      if (!name) continue;
      const key = `${name.toUpperCase()}|${brand}`;
      const vst: SeedVariant = {
        size: r.variant?.size,
        color: r.variant?.color,
        price: r.variant?.price,
        code: r.variant?.code,
      };
      if (!map.has(key)) {
        map.set(key, {
          name,
          brand,
          productType: r.productType,
          variants: [vst],
        } as any);
      } else {
        map.get(key)!.variants.push(vst);
      }
    }
    for (const v of map.values()) entries.push(v as any);
  } else {
    entriesRaw = entriesRaw as any[];
    for (const r of entriesRaw) entries.push(r as SeedEntry);
  }

  console.log(`Seeding ${entries.length} materials from ${filePath}`);

  const processedRows = new Set<string>();
  let created = 0;
  for (const e of entries) {
    const brandName = (e.brand || "").trim() || "Plascon";
    const { name: materialName, code: materialCode } =
      normalizeSeedNameAndCode(e);
    const rowKey = `${materialName.toUpperCase()}|${brandName}|${materialCode ?? ""}`;
    if (processedRows.has(rowKey)) continue;
    processedRows.add(rowKey);

    const variantColors = new Set<string>();
    for (const variant of e.variants ?? []) {
      if (!variant?.color) continue;
      const color = variant.color.trim();
      if (!color || color.toUpperCase() === "N/A") continue;
      variantColors.add(color);
    }
    const colors = Array.from(new Set([...(e.colors ?? []), ...variantColors]));

    // Upsert brand supplier (as BRAND type)
    const supplier = await prisma.supplier.upsert({
      where: { name: brandName },
      create: {
        name: brandName,
        supplierType: "BRAND",
        isActive: true,
      },
      update: { isActive: true },
    });

    const existingMaterial = await prisma.material.findFirst({
      where: {
        OR: [
          materialCode ? { sku: materialCode } : undefined,
          { name: materialName },
        ].filter(Boolean) as any,
      },
      select: {
        id: true,
        supplierId: true,
        colors: true,
        productType: true,
        isReturnable: true,
        sku: true,
      },
    });

    const mergedColors = Array.from(
      new Set([...(existingMaterial?.colors ?? []), ...colors]),
    );

    const material = existingMaterial
      ? await prisma.material.update({
          where: { id: existingMaterial.id },
          data: {
            name: materialName,
            sku: materialCode ?? existingMaterial.sku,
            productType: (e.productType as any) ?? existingMaterial.productType,
            isReturnable: e.isReturnable ?? existingMaterial.isReturnable,
            colors: mergedColors,
            supplierId: existingMaterial.supplierId ?? supplier.id,
          },
        })
      : await prisma.material.create({
          data: {
            name: materialName,
            sku: materialCode ?? undefined,
            productType: (e.productType as any) ?? "MATERIAL",
            isReturnable: !!e.isReturnable,
            colors: mergedColors,
            supplierId: supplier.id,
          },
        });

    for (const variant of e.variants ?? []) {
      const { unitSize, uom } = parseSize(variant.size);
      const finalUom = uom ?? (/[lL]$/.test(variant.size ?? "") ? "L" : null);
      const colorName = variant.color?.trim();
      const colorVariantId =
        colorName && colorName.toUpperCase() !== "N/A"
          ? (
              await prisma.materialColorVariant.upsert({
                where: {
                  materialId_colorName_baseType: {
                    materialId: material.id,
                    colorName,
                    baseType: "DEEP",
                  },
                },
                create: {
                  materialId: material.id,
                  colorName,
                  baseType: "DEEP",
                },
                update: {},
              })
            ).id
          : null;

      const exists = await prisma.materialPrice.findFirst({
        where: {
          materialId: material.id,
          supplierId: supplier.id,
          uom: finalUom as any,
          unitSize: unitSize != null ? unitSize : undefined,
          colorVariantId: colorVariantId ? colorVariantId : undefined,
        },
      });

      if (exists) {
        await prisma.materialPrice.update({
          where: { id: exists.id },
          data: {
            price: variant.price ?? 0,
            isActive: true,
          },
        });
      } else {
        await prisma.materialPrice.create({
          data: {
            materialId: material.id,
            supplierId: supplier.id,
            uom: finalUom as any,
            unitSize: unitSize != null ? unitSize : undefined,
            price: variant.price ?? 0,
            isActive: true,
            colorVariantId: colorVariantId ?? undefined,
          },
        });
      }
    }

    for (const size of e.sizes ?? []) {
      const { unitSize, uom } = parseSize(size);
      const finalUom = uom ?? (/[lL]$/.test(size) ? "L" : null);

      const exists = await prisma.materialPrice.findFirst({
        where: {
          materialId: material.id,
          supplierId: supplier.id,
          uom: finalUom as any,
          unitSize: unitSize != null ? unitSize : undefined,
        },
      });
      if (!exists) {
        await prisma.materialPrice.create({
          data: {
            materialId: material.id,
            supplierId: supplier.id,
            uom: finalUom as any,
            unitSize: unitSize != null ? unitSize : undefined,
            price: 0,
            isActive: true,
          },
        });
      }
    }

    created++;
    if (created % 25 === 0)
      console.log(`Processed ${created}/${entries.length}`);
  }

  console.log(`Done. Processed ${created} materials from ${filePath}.`);
  return created;
}

async function main() {
  const seedFiles = ["full-materials-seed-with-prices.json"];

  let totalCreated = 0;
  for (const fileName of seedFiles) {
    const file = path.resolve(process.cwd(), fileName);
    try {
      const count = await seedFile(file);
      totalCreated += count;
    } catch (error) {
      console.error(`Error seeding ${fileName}:`, error);
    }
  }

  console.log(
    `\n=== Total: Processed ${totalCreated} materials across all seed files ===`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
