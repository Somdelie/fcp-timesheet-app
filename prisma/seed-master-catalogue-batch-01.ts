import { prisma } from "../lib/prisma";

type SeedProduct = {
  supplier: "Dulux" | "Marmoran" | "Plascon" | "UROCHEM";
  name: string;
  normalizedName: string;
  finish?: string;
};

const PRODUCTS: SeedProduct[] = [
  { supplier: "Dulux", name: "Berger Nukote", normalizedName: "BERGER NUKOTE" },
  { supplier: "Dulux", name: "Ecosure Plaster Primer", normalizedName: "ECOSURE PLASTER PRIMER" },
  { supplier: "Dulux", name: "Kitchens & Bathrooms", normalizedName: "KITCHENS BATHROOMS" },
  { supplier: "Dulux", name: "Polycell Polyfilla Exterior", normalizedName: "POLYCELL POLYFILLA EXTERIOR" },
  { supplier: "Dulux", name: "Polycell Polyfilla Interior", normalizedName: "POLYCELL POLYFILLA INTERIOR" },
  { supplier: "Dulux", name: "Polycell Sugar Soap Cleaner", normalizedName: "POLYCELL SUGAR SOAP CLEANER" },
  { supplier: "Dulux", name: "Rainshield", normalizedName: "RAINSHIELD" },
  { supplier: "Dulux", name: "Trade 100", finish: "Low Sheen", normalizedName: "TRADE 100" },
  { supplier: "Dulux", name: "Trade 65", normalizedName: "TRADE 65" },
  { supplier: "Dulux", name: "Trade Alkali Resistant Primer", normalizedName: "TRADE ALKALI RESISTANT PRIMER" },
  { supplier: "Dulux", name: "Water-Based Pearlglo", normalizedName: "WATER BASED PEARLGLO" },
  { supplier: "Dulux", name: "Weatherguard", normalizedName: "WEATHERGUARD" },

  { supplier: "Marmoran", name: "Penetrating Primer", normalizedName: "PENETRATING PRIMER" },

  { supplier: "Plascon", name: "Cashmere", normalizedName: "CASHMERE" },
  { supplier: "Plascon", name: "Coastcote Etch Primer", normalizedName: "COASTCOTE ETCH PRIMER" },
  { supplier: "Plascon", name: "Double Velvet", normalizedName: "DOUBLE VELVET" },
  { supplier: "Plascon", name: "Dual Plascoguard Gehopon 3000 WB", normalizedName: "DUAL PLASCOGUARD GEHOPON 3000 WB" },
  { supplier: "Plascon", name: "Dual Plascoguard Gehopon Sealer", normalizedName: "DUAL PLASCOGUARD GEHOPON SEALER" },
  { supplier: "Plascon", name: "Metalcare Galvanised Iron Primer", normalizedName: "METALCARE GALVANISED IRON PRIMER" },
  { supplier: "Plascon", name: "Micatex", normalizedName: "MICATEX" },
  { supplier: "Plascon", name: "Multi-Surface Primer", normalizedName: "MULTI SURFACE PRIMER" },
  { supplier: "Plascon", name: "Plascoprime Red Oxide Primer", normalizedName: "PLASCOPRIME RED OXIDE PRIMER" },
  { supplier: "Plascon", name: "Plascosafe 18 Primer", normalizedName: "PLASCOSAFE 18 PRIMER" },
  { supplier: "Plascon", name: "Plastertex", normalizedName: "PLASTERTEX" },
  { supplier: "Plascon", name: "Plastertex Primer", normalizedName: "PLASTERTEX PRIMER" },
  { supplier: "Plascon", name: "Polvin Super Acrylic", normalizedName: "POLVIN SUPER ACRYLIC" },
  { supplier: "Plascon", name: "Professional Contractors Matt", normalizedName: "PROFESSIONAL CONTRACTORS MATT" },
  { supplier: "Plascon", name: "Professional Elastoshield", normalizedName: "PROFESSIONAL ELASTOSHIELD" },
  { supplier: "Plascon", name: "Professional General Purpose Undercoat", normalizedName: "PROFESSIONAL GENERAL PURPOSE UNDERCOAT" },
  { supplier: "Plascon", name: "Professional Gloss Enamel", normalizedName: "PROFESSIONAL GLOSS ENAMEL" },
  { supplier: "Plascon", name: "Professional Gypsum and Plaster Primer", normalizedName: "PROFESSIONAL GYPSUM AND PLASTER PRIMER" },
  { supplier: "Plascon", name: "Professional Plaster Primer", normalizedName: "PROFESSIONAL PLASTER PRIMER" },
  { supplier: "Plascon", name: "Professional Super Matt", normalizedName: "PROFESSIONAL SUPER MATT" },
  { supplier: "Plascon", name: "Professional Superior Low Sheen", normalizedName: "PROFESSIONAL SUPERIOR LOW SHEEN" },
  { supplier: "Plascon", name: "Road Marking Paint", normalizedName: "ROAD MARKING PAINT" },
  { supplier: "Plascon", name: "Roofguard", normalizedName: "ROOFGUARD" },
  { supplier: "Plascon", name: "Skim Coat Exterior", normalizedName: "SKIM COAT EXTERIOR" },
  { supplier: "Plascon", name: "Super Universal Enamel", normalizedName: "SUPER UNIVERSAL ENAMEL" },
  { supplier: "Plascon", name: "TradePro Roof & More", normalizedName: "TRADEPRO ROOF MORE" },
  { supplier: "Plascon", name: "True Colour Roof Paint", normalizedName: "TRUE COLOUR ROOF PAINT" },
  { supplier: "Plascon", name: "Universal Undercoat", normalizedName: "UNIVERSAL UNDERCOAT" },
  { supplier: "Plascon", name: "Velvaglo Satin", normalizedName: "TVG VELVAGLO SATIN" },
  { supplier: "Plascon", name: "Velvaglo Water-Based", normalizedName: "VELVAGLO WATER BASED" },
  { supplier: "Plascon", name: "Wall & All", normalizedName: "WALL ALL" },
  { supplier: "Plascon", name: "Wood Primer", normalizedName: "WOOD PRIMER" },
  { supplier: "Plascon", name: "Woodguard Timber Preservative", normalizedName: "WOODGUARD TIMBER PRESERVATIVE" },
  { supplier: "Plascon", name: "Woodguard Timber Varnish", normalizedName: "WOODGUARD TIMBER VARNISH" },
  { supplier: "Plascon", name: "Waterproofing Compound", normalizedName: "PWC WATERPROOFING COMPOUND" },

  { supplier: "UROCHEM", name: "Hypercrete", normalizedName: "HYPERCRETE" },
  { supplier: "UROCHEM", name: "Urochem 525 Waterproofing Compound", normalizedName: "UROCHEM 525 SILICON" },
];

function normalize(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveSupplier(name: SeedProduct["supplier"]) {
  const normalizedName = normalize(name);

  const supplier = await prisma.supplier.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        { normalizedName: { equals: normalizedName, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!supplier) {
    throw new Error(`Required supplier not found: ${name}`);
  }

  return supplier;
}

async function main() {
  const duplicates = PRODUCTS.filter(
    (product, index, all) =>
      all.findIndex(
        candidate =>
          candidate.supplier === product.supplier &&
          candidate.normalizedName === product.normalizedName,
      ) !== index,
  );

  if (duplicates.length) {
    throw new Error(
      `Duplicate Batch 01 catalogue keys: ${duplicates
        .map(product => `${product.supplier}:${product.normalizedName}`)
        .join(", ")}`,
    );
  }

  const supplierNames = [...new Set(PRODUCTS.map(product => product.supplier))];
  const suppliers = new Map(
    await Promise.all(
      supplierNames.map(async name => {
        const supplier = await resolveSupplier(name);
        return [name, supplier] as const;
      }),
    ),
  );

  let created = 0;
  let updated = 0;

  for (const product of PRODUCTS) {
    const supplier = suppliers.get(product.supplier);
    if (!supplier) throw new Error(`Supplier resolution failed: ${product.supplier}`);

    const existing = await prisma.masterCatalogueProduct.findUnique({
      where: {
        supplierId_normalizedName: {
          supplierId: supplier.id,
          normalizedName: product.normalizedName,
        },
      },
      select: { id: true },
    });

    const saved = await prisma.masterCatalogueProduct.upsert({
      where: {
        supplierId_normalizedName: {
          supplierId: supplier.id,
          normalizedName: product.normalizedName,
        },
      },
      create: {
        supplierId: supplier.id,
        name: product.name,
        normalizedName: product.normalizedName,
        isActive: true,
      },
      update: {
        name: product.name,
        isActive: true,
      },
      select: { id: true },
    });

    if (existing) updated += 1;
    else created += 1;

    if (product.finish) {
      const normalizedFinish = normalize(product.finish);

      await prisma.masterProductFinish.upsert({
        where: {
          productId_normalizedName: {
            productId: saved.id,
            normalizedName: normalizedFinish,
          },
        },
        create: {
          productId: saved.id,
          name: product.finish,
          normalizedName: normalizedFinish,
        },
        update: {
          name: product.finish,
        },
      });
    }
  }

  console.log(
    `Batch 01 complete: ${PRODUCTS.length} products processed (${created} created, ${updated} updated).`,
  );
}

main()
  .catch(error => {
    console.error("Batch 01 master catalogue seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

