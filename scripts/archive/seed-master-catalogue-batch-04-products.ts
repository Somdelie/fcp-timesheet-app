import { prisma } from "../lib/prisma";

type BrandName = "Plascon" | "Dulux" | "Versus" | "Midas" | "Earthcote" | "Marmoran" | "RBP";
type Usage = "INT" | "EXT" | "INT_EXT";
type SeedProduct = {
  brand: BrandName;
  name: string;
  identity: string;
  category: string;
  usage: Usage;
  finishes?: readonly string[];
  bases?: readonly string[];
};

const P = (
  brand: BrandName,
  name: string,
  identity: string,
  category: string,
  usage: Usage,
  finishes: readonly string[] = [],
  bases: readonly string[] = [],
): SeedProduct => ({ brand, name, identity, category, usage, finishes, bases });

// `identity` intentionally keeps the existing normalized key when a display
// name gains a verified range code. This preserves Batch 02 price lookups and
// prevents a code suffix from creating a duplicate product.
const PRODUCTS: readonly SeedProduct[] = [
  P("Plascon", "Professional Contractors Matt - PEM600", "PROFESSIONAL CONTRACTORS MATT", "Paints", "INT_EXT"),
  P("Plascon", "Professional Superior Low Sheen - TLS", "PROFESSIONAL SUPERIOR LOW SHEEN", "Paints", "INT_EXT", ["Low Sheen"]),
  P("Plascon", "Professional Super Matt - TSA", "PROFESSIONAL SUPER MATT", "Paints", "INT_EXT", ["Matt"]),
  P("Plascon", "Professional General Purpose Undercoat - PU800", "PROFESSIONAL GENERAL PURPOSE UNDERCOAT", "Primers & Undercoats", "INT_EXT"),
  P("Plascon", "Gypsum and Plaster Primer - PP700", "PROFESSIONAL GYPSUM AND PLASTER PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Plascon", "Professional Gloss Enamel - TGE", "PROFESSIONAL GLOSS ENAMEL", "Paints", "INT_EXT", ["Gloss Enamel"]),
  P("Plascon", "Professional Elastoshield - TED", "PROFESSIONAL ELASTOSHIELD", "Paints", "EXT"),
  P("Plascon", "Velvaglo Non-Drip Water-Based - TVW", "VELVAGLO WATER BASED", "Paints", "INT_EXT"),
  P("Plascon", "Velvaglo Satin - TVG", "TVG VELVAGLO SATIN", "Paints", "INT_EXT", ["Satin"]),
  P("Plascon", "Double Velvet - TDV", "DOUBLE VELVET", "Paints", "INT_EXT"),
  P("Plascon", "Cashmere - TCA/CAS", "CASHMERE", "Paints", "INT"),
  P("Plascon", "Wall & All - TWA", "WALL ALL", "Paints", "INT_EXT"),
  P("Plascon", "Polvin Super Acrylic - TAP", "POLVIN SUPER ACRYLIC", "Paints", "INT_EXT"),
  P("Plascon", "Micatex - TMX", "MICATEX", "Paints", "EXT"),
  P("Plascon", "True Colour Roof Paint - TCR", "TRUE COLOUR ROOF PAINT", "Roof Coatings", "EXT"),
  P("Plascon", "TradePro Roof & More - URP", "TRADEPRO ROOF MORE", "Roof Coatings", "EXT"),
  P("Plascon", "Road Marking Paint - TP", "ROAD MARKING PAINT", "Floor Coatings", "EXT"),
  P("Plascon", "Plascoprime Red Oxide Primer - UC170", "PLASCOPRIME RED OXIDE PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Plascon", "Plascosafe 18 Primer - EMS18", "PLASCOSAFE 18 PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Plascon", "Coastcote Etch Primer - SNK10", "COASTCOTE ETCH PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Plascon", "Dual Plascoguard Gehopon 3000 WB - GW", "DUAL PLASCOGUARD GEHOPON 3000 WB", "Industrial Coatings", "INT_EXT"),
  P("Plascon", "Dual Plascoguard Gehopon Sealer - GW", "DUAL PLASCOGUARD GEHOPON SEALER", "Industrial Coatings", "INT_EXT"),
  P("Plascon", "Waterproofing Compound - PWC520", "PWC WATERPROOFING COMPOUND", "Waterproofing", "EXT"),
  P("Plascon", "Multi-Surface Primer - WUP1", "MULTI SURFACE PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Plascon", "Wood Preservative - FPR", "WOODGUARD TIMBER PRESERVATIVE", "Wood Coatings", "EXT"),

  P("Plascon", "Waterbase Gypsum Sealer - PGS1", "WATERBASE GYPSUM SEALER", "Primers & Undercoats", "INT_EXT", [], ["White"]),
  P("Plascon", "Professional Aquarista - PHB800", "PROFESSIONAL AQUARISTA", "Paints", "INT_EXT", [], ["White"]),
  P("Plascon", "Professional Marroca Rippled Low Sheen - PTX1400", "PROFESSIONAL MARROCA RIPPLED LOW SHEEN", "Paints", "INT_EXT", ["Rippled Low Sheen"], ["White"]),
  P("Plascon", "Professional Hygiene Low Sheen - PH1", "PROFESSIONAL HYGIENE LOW SHEEN", "Paints", "INT", ["Low Sheen"], ["White"]),
  P("Plascon", "Professional Damp Plaster Paint - PSB600", "PROFESSIONAL DAMP PLASTER PAINT", "Paints", "INT_EXT", [], ["White"]),
  P("Plascon", "Nuroof Cool Acrylic Roof Paint - TRP", "NUROOF COOL ACRYLIC ROOF PAINT", "Roof Coatings", "EXT"),
  P("Plascon", "Metalcare Galvanised Iron Cleaner - GIC1", "METALCARE GALVANISED IRON CLEANER", "Surface Preparation", "EXT"),
  P("Plascon", "Metalcare Silvershine Aluminium - ASS1", "METALCARE SILVERSHINE ALUMINIUM", "Industrial Coatings", "INT_EXT"),
  P("Plascon", "Plascothane 9000 - PRU/PRT", "PLASCOTHANE 9000", "Industrial Coatings", "INT_EXT"),
  P("Plascon", "Hardener for Plascothane 9000 - PRH9", "HARDENER FOR PLASCOTHANE 9000", "Industrial Coatings", "INT_EXT"),
  P("Plascon", "Plascotuff 3500 - PEX3500", "PLASCOTUFF 3500", "Industrial Coatings", "INT_EXT"),
  P("Plascon", "Hardener for Plascotuff 3500 - PEH3", "HARDENER FOR PLASCOTUFF 3500", "Industrial Coatings", "INT_EXT"),
  P("Plascon", "Epiwash Strontium Chromate Primer - AW255", "EPIWASH STRONTIUM CHROMATE PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Plascon", "Kitchens & Bathrooms - KBM/TKM", "KITCHENS BATHROOMS", "Paints", "INT", [], ["White", "Pastel"]),
  P("Plascon", "Stoep Enamel - SP", "STOEP ENAMEL", "Floor Coatings", "INT_EXT"),
  P("Plascon", "Brickseal - WBS1", "BRICKSEAL", "Paints", "EXT", [], ["Clear"]),
  P("Plascon", "Aquasolv Degreaser - GR1", "AQUASOLV DEGREASER", "Solvents & Cleaners", "INT_EXT"),

  P("Dulux", "Polycell Ripple", "POLYCELL RIPPLE", "Surface Preparation", "INT_EXT"),
  P("Dulux", "Polycell Crackfiller Interior", "POLYCELL CRACKFILLER INTERIOR", "Surface Preparation", "INT"),
  P("Versus", "Plaster Primer", "PLASTER PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Midas", "Masonry Primer", "MASONRY PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Midas", "Gloss Enamel", "GLOSS ENAMEL", "Paints", "INT_EXT", ["Gloss Enamel"]),
  P("Earthcote", "Ultra Fine Aggregate Primer", "ULTRA FINE AGGREGATE PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Marmoran", "Permacrete 1 mm", "PERMACRETE 1MM", "Textured Coatings", "EXT"),
  P("Marmoran", "Permaplast", "PERMAPLAST", "Textured Coatings", "INT_EXT"),
  P("RBP", "Acrylic Primer", "ACRYLIC PRIMER", "Primers & Undercoats", "INT_EXT"),
] as const;

function normalize(value: string) {
  return value.trim().toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

async function resolveBrand(name: BrandName) {
  const candidates = await prisma.supplier.findMany({
    where: {
      supplierType: "BRAND",
      isActive: true,
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        { normalizedName: { equals: normalize(name), mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, _count: { select: { masterCatalogueProducts: true } } },
  });
  const brand = candidates.find(candidate => candidate.name === name) ??
    candidates.sort((a, b) => b._count.masterCatalogueProducts - a._count.masterCatalogueProducts)[0];
  if (!brand) throw new Error(`BRAND supplier not found: ${name}`);
  return brand;
}

async function mergePlasterPrimerAlias(canonicalProductId: string, plasconId: string) {
  const alias = await prisma.masterCatalogueProduct.findUnique({
    where: {
      supplierId_normalizedName: {
        supplierId: plasconId,
        normalizedName: "PROFESSIONAL PLASTER PRIMER",
      },
    },
    select: { id: true, isActive: true },
  });
  if (!alias || alias.id === canonicalProductId) return 0;

  const prices = await prisma.masterProductPrice.findMany({
    where: { productId: alias.id },
    include: {
      base: { select: { name: true, normalizedName: true } },
      finish: { select: { name: true, normalizedName: true } },
    },
  });

  for (const price of prices) {
    const base = await prisma.masterProductBase.upsert({
      where: {
        productId_normalizedName: {
          productId: canonicalProductId,
          normalizedName: price.base.normalizedName,
        },
      },
      create: {
        productId: canonicalProductId,
        name: price.base.name,
        normalizedName: price.base.normalizedName,
      },
      update: { name: price.base.name },
      select: { id: true },
    });

    let finishId: string | null = null;
    if (price.finish) {
      const finish = await prisma.masterProductFinish.upsert({
        where: {
          productId_normalizedName: {
            productId: canonicalProductId,
            normalizedName: price.finish.normalizedName,
          },
        },
        create: {
          productId: canonicalProductId,
          name: price.finish.name,
          normalizedName: price.finish.normalizedName,
        },
        update: { name: price.finish.name },
        select: { id: true },
      });
      finishId = finish.id;
    }

    await prisma.masterProductPrice.update({
      where: { id: price.id },
      data: { productId: canonicalProductId, baseId: base.id, finishId },
    });
  }

  if (alias.isActive) {
    await prisma.masterCatalogueProduct.update({
      where: { id: alias.id },
      data: { isActive: false },
    });
  }
  return prices.length;
}

async function main() {
  const duplicateKeys = PRODUCTS.filter((row, index, all) =>
    all.findIndex(candidate => candidate.brand === row.brand && candidate.identity === row.identity) !== index,
  );
  if (duplicateKeys.length) throw new Error(`Duplicate Batch 04 identities: ${duplicateKeys.map(row => `${row.brand}:${row.identity}`).join(", ")}`);

  const brands = new Map(
    await Promise.all([...new Set(PRODUCTS.map(row => row.brand))].map(async name => [name, await resolveBrand(name)] as const)),
  );
  let created = 0;
  let updated = 0;
  let finishesCreated = 0;
  let basesCreated = 0;
  let canonicalGypsumProductId = "";

  for (const row of PRODUCTS) {
    const brand = brands.get(row.brand);
    if (!brand) throw new Error(`Brand resolution failed: ${row.brand}`);
    const key = { supplierId: brand.id, normalizedName: row.identity };
    const existing = await prisma.masterCatalogueProduct.findUnique({
      where: { supplierId_normalizedName: key },
      select: { id: true },
    });
    const product = await prisma.masterCatalogueProduct.upsert({
      where: { supplierId_normalizedName: key },
      create: {
        supplierId: brand.id,
        name: row.name,
        normalizedName: row.identity,
        category: row.category,
        usage: row.usage,
        isActive: true,
      },
      update: { name: row.name, category: row.category, usage: row.usage, isActive: true },
      select: { id: true },
    });
    if (existing) updated += 1;
    else created += 1;

    if (row.identity === "PROFESSIONAL GYPSUM AND PLASTER PRIMER") canonicalGypsumProductId = product.id;

    for (const name of row.finishes ?? []) {
      const normalizedName = normalize(name);
      const old = await prisma.masterProductFinish.findUnique({ where: { productId_normalizedName: { productId: product.id, normalizedName } }, select: { id: true } });
      await prisma.masterProductFinish.upsert({
        where: { productId_normalizedName: { productId: product.id, normalizedName } },
        create: { productId: product.id, name, normalizedName },
        update: { name },
      });
      if (!old) finishesCreated += 1;
    }
    for (const name of row.bases ?? []) {
      const normalizedName = normalize(name);
      const old = await prisma.masterProductBase.findUnique({ where: { productId_normalizedName: { productId: product.id, normalizedName } }, select: { id: true } });
      await prisma.masterProductBase.upsert({
        where: { productId_normalizedName: { productId: product.id, normalizedName } },
        create: { productId: product.id, name, normalizedName },
        update: { name },
      });
      if (!old) basesCreated += 1;
    }
  }

  const plascon = brands.get("Plascon");
  if (!plascon || !canonicalGypsumProductId) throw new Error("Canonical PP700 product was not resolved.");
  const movedPrices = await mergePlasterPrimerAlias(canonicalGypsumProductId, plascon.id);

  console.log(
    `Batch 04 complete: ${PRODUCTS.length} product families processed (${created} created, ${updated} updated), ` +
      `${finishesCreated} finishes created, ${basesCreated} bases created, ${movedPrices} PP700 alias prices preserved.`,
  );
}

main()
  .catch(error => {
    console.error("Batch 04 master catalogue seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
