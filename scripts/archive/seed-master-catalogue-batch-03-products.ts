import { prisma } from "../lib/prisma";

type BrandName = "Dulux" | "Plascon" | "Versus";
type Usage = "INT" | "EXT" | "INT_EXT";

type SeedProduct = {
  brand: BrandName;
  name: string;
  normalizedName: string;
  category: string;
  usage: Usage;
  finishes?: readonly string[];
  bases?: readonly string[];
};

const P = (
  brand: BrandName,
  name: string,
  category: string,
  usage: Usage,
  finishes: readonly string[] = [],
  bases: readonly string[] = [],
): SeedProduct => ({
  brand,
  name,
  normalizedName: normalize(name),
  category,
  usage,
  finishes,
  bases,
});

const TINT_BASES = ["White", "Pastel", "Medium", "Deep", "Ultra Deep"] as const;

const PRODUCTS: readonly SeedProduct[] = [
  P("Dulux", "Acrylic PVA", "Paints", "INT_EXT", [], ["Ultra Deep"]),
  P("Dulux", "Berger Nukote", "Paints", "INT_EXT", [], ["White"]),
  P("Dulux", "Dulux Red Oxide", "Primers & Undercoats", "INT_EXT"),
  P("Dulux", "Dulux Skim Coat", "Surface Preparation", "INT_EXT"),
  P("Dulux", "Ecosure Plaster Primer", "Primers & Undercoats", "INT_EXT", [], ["White"]),
  P("Dulux", "Galvanised Iron Primer", "Primers & Undercoats", "INT_EXT"),
  P("Dulux", "High Gloss Brick Dressing", "Paints", "EXT", ["High Gloss"]),
  P("Dulux", "Pre-Paint SmoothOver Interior/Exterior", "Surface Preparation", "INT_EXT", ["Matt"], ["White"]),
  P("Dulux", "Rainshield", "Waterproofing", "EXT"),
  P("Dulux", "Solvent-Based Pearlglo", "Paints", "INT_EXT", [], TINT_BASES),
  P("Dulux", "Supergrip Primer", "Primers & Undercoats", "INT_EXT", [], ["White"]),
  P("Dulux", "Trade 100", "Paints", "INT_EXT", ["Gloss Enamel", "Low Sheen", "Matt"], TINT_BASES),
  P("Dulux", "Trade 65", "Paints", "INT_EXT", ["Matt"], ["White", "Pastel", "Medium", "Deep"]),
  P("Dulux", "Trade 70", "Paints", "INT_EXT", ["Mid Sheen"], ["White", "Pastel", "Medium", "Deep"]),
  P("Dulux", "Trade Acrylic PVA", "Paints", "INT_EXT", [], ["White"]),
  P("Dulux", "Trade Acrylic Roof Paint", "Roof Coatings", "EXT"),
  P("Dulux", "Trade Alkali Resistant Primer", "Primers & Undercoats", "INT_EXT", [], ["White"]),
  P("Dulux", "Trade Bituminous Aluminium Paint", "Industrial Coatings", "EXT"),
  P("Dulux", "Trade Bonding Liquid", "Primers & Undercoats", "INT_EXT"),
  P("Dulux", "Trade Corrocote 1 Metal Etch Primer", "Primers & Undercoats", "INT_EXT"),
  P("Dulux", "Trade Corrocote 3 Metal Primer", "Primers & Undercoats", "INT_EXT"),
  P("Dulux", "Trade Eggshell Enamel", "Paints", "INT_EXT", ["Eggshell"], ["White"]),
  P("Dulux", "Trade Fast Plaster Primer", "Primers & Undercoats", "INT_EXT", [], ["White"]),
  P("Dulux", "Trade Filler Coat", "Surface Preparation", "INT_EXT", [], ["White"]),
  P("Dulux", "Trade Floorcote", "Floor Coatings", "INT_EXT"),
  P("Dulux", "Trade Glaze Coat", "Paints", "INT_EXT", [], ["Clear"]),
  P("Dulux", "Trade Heavy Duty Thinners", "Solvents & Cleaners", "INT_EXT"),
  P("Dulux", "Trade Hi-Chem Enamel", "Industrial Coatings", "INT_EXT"),
  P("Dulux", "Trade Hi-Hiding", "Paints", "INT", [], ["White"]),
  P("Dulux", "Trade Luxurious Silk", "Paints", "INT", ["Silk"], TINT_BASES),
  P("Dulux", "Trade Smooth Ripple", "Paints", "INT_EXT", ["Sheen"], ["White"]),
  P("Dulux", "Trade Steel Primer", "Primers & Undercoats", "INT_EXT"),
  P("Dulux", "Trade Sterishield Diamond", "Paints", "INT", ["Eggshell", "Matt"], ["White", "Light", "Medium", "Extra Deep"]),
  P("Dulux", "Trade Super Acrylic PVA", "Paints", "INT_EXT", [], ["White"]),
  P("Dulux", "Trade Truck & Tractor Enamel", "Industrial Coatings", "INT_EXT"),
  P("Dulux", "Trade Tuffcote Epoxy", "Industrial Coatings", "INT_EXT"),
  P("Dulux", "Trade Universal Undercoat", "Primers & Undercoats", "INT_EXT", [], ["White"]),
  P("Dulux", "Trade Wallclad", "Paints", "EXT", [], TINT_BASES),
  P("Dulux", "Trade Weathershield", "Paints", "EXT", [], ["White", "Pastel", "Medium", "Deep"]),
  P("Dulux", "Water-Based Pearlglo", "Paints", "INT_EXT", [], TINT_BASES),
  P("Dulux", "Weatherguard", "Paints", "EXT", ["Fine Textured", "Ultra Smooth"], TINT_BASES),
  P("Dulux", "Wood Primer", "Primers & Undercoats", "INT_EXT"),
  P("Dulux", "Woodgard Rubbol", "Wood Coatings", "EXT"),
  P("Dulux", "Woodgard Timbapreservative", "Wood Coatings", "EXT"),
  P("Dulux", "Woodgard Timbavarnish", "Wood Coatings", "INT_EXT", ["High Gloss"]),
  P("Plascon", "Roofguard", "Roof Coatings", "EXT"),
  P("Versus", "Pigmented Sealer", "Primers & Undercoats", "INT_EXT"),
  P("Versus", "Satin Enamel", "Paints", "INT_EXT", ["Satin"]),
  P("Versus", "Wallsure", "Paints", "INT_EXT"),
] as const;

function normalize(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveBrand(name: BrandName) {
  const normalizedName = normalize(name);
  const candidates = await prisma.supplier.findMany({
    where: {
      supplierType: "BRAND",
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        { normalizedName: { equals: normalizedName, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      _count: { select: { masterCatalogueProducts: true } },
    },
  });

  const exact = candidates.find(candidate => candidate.name === name);
  const brand = exact ?? candidates.sort(
    (a, b) => b._count.masterCatalogueProducts - a._count.masterCatalogueProducts,
  )[0];

  if (!brand) {
    throw new Error(
      `Brand supplier not found: ${name}. Run seed-master-catalogue-supplier-brands.ts first.`,
    );
  }

  if (!brand.isActive) throw new Error(`Brand supplier is inactive: ${brand.name}`);
  if (candidates.length > 1) {
    console.warn(`Multiple BRAND suppliers match ${name}; using ${brand.name} (${brand.id}).`);
  }
  return brand;
}

async function main() {
  const duplicateKeys = PRODUCTS.filter(
    (product, index, all) =>
      all.findIndex(candidate =>
        candidate.brand === product.brand && candidate.normalizedName === product.normalizedName,
      ) !== index,
  );
  if (duplicateKeys.length) {
    throw new Error(
      `Duplicate Batch 03 keys: ${duplicateKeys.map(product => `${product.brand}:${product.normalizedName}`).join(", ")}`,
    );
  }

  const brands = new Map(
    await Promise.all(
      [...new Set(PRODUCTS.map(product => product.brand))].map(async name => [name, await resolveBrand(name)] as const),
    ),
  );

  let productsCreated = 0;
  let productsUpdated = 0;
  let finishesCreated = 0;
  let basesCreated = 0;

  for (const row of PRODUCTS) {
    const brand = brands.get(row.brand);
    if (!brand) throw new Error(`Brand resolution failed: ${row.brand}`);

    const key = {
      supplierId: brand.id,
      normalizedName: row.normalizedName,
    };
    const existing = await prisma.masterCatalogueProduct.findUnique({
      where: { supplierId_normalizedName: key },
      select: { id: true },
    });

    const product = await prisma.masterCatalogueProduct.upsert({
      where: { supplierId_normalizedName: key },
      create: {
        supplierId: brand.id,
        name: row.name,
        normalizedName: row.normalizedName,
        category: row.category,
        usage: row.usage,
        isActive: true,
      },
      update: {
        name: row.name,
        category: row.category,
        usage: row.usage,
        isActive: true,
      },
      select: { id: true },
    });

    if (existing) productsUpdated += 1;
    else productsCreated += 1;

    for (const finishName of row.finishes ?? []) {
      const normalizedName = normalize(finishName);
      const existingFinish = await prisma.masterProductFinish.findUnique({
        where: { productId_normalizedName: { productId: product.id, normalizedName } },
        select: { id: true },
      });
      await prisma.masterProductFinish.upsert({
        where: { productId_normalizedName: { productId: product.id, normalizedName } },
        create: { productId: product.id, name: finishName, normalizedName },
        update: { name: finishName },
      });
      if (!existingFinish) finishesCreated += 1;
    }

    for (const baseName of row.bases ?? []) {
      const normalizedName = normalize(baseName);
      const existingBase = await prisma.masterProductBase.findUnique({
        where: { productId_normalizedName: { productId: product.id, normalizedName } },
        select: { id: true },
      });
      await prisma.masterProductBase.upsert({
        where: { productId_normalizedName: { productId: product.id, normalizedName } },
        create: { productId: product.id, name: baseName, normalizedName },
        update: { name: baseName },
      });
      if (!existingBase) basesCreated += 1;
    }
  }

  console.log(
    `Batch 03 complete: ${PRODUCTS.length} product families processed ` +
      `(${productsCreated} created, ${productsUpdated} updated), ` +
      `${finishesCreated} finishes created, ${basesCreated} bases created.`,
  );
}

main()
  .catch(error => {
    console.error("Batch 03 master catalogue seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

