import { prisma } from "../lib/prisma";

type BrandName =
  | "Dulux"
  | "Plascon"
  | "Versus"
  | "Midas"
  | "Marmoran"
  | "Earthcote"
  | "Cemcrete"
  | "Coprox"
  | "Woodoc"
  | "PROMINENT";
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

// A product is the stable family only. Pack sizes, colours and tint-base names
// belong to their own records and must never be appended to `name`.
// Existing identities are intentionally retained where Batch 05 improves a
// display name, preventing duplicates and preserving prices/relations.
const PRODUCTS: readonly SeedProduct[] = [
  P("Dulux", "Rockgrip Acrylic Roof", "ROCKGRIP ACRYLIC ROOF", "Roof Coatings", "EXT", ["Matt"]),
  P("Dulux", "Rockgrip Plaster Primer - Solvent-Based", "ROCKGRIP PLASTER PRIMER SOLVENT BASED", "Primers & Undercoats", "INT_EXT", ["Matt"], ["White"]),
  P("Dulux", "Rockgrip Plaster Primer - Water-Based", "ROCKGRIP PLASTER PRIMER WATER BASED", "Primers & Undercoats", "INT_EXT", ["Matt"], ["White"]),
  P("Dulux", "Polycell Polyfilla Fine Crack Filler", "POLYCELL POLYFILLA FINE CRACK FILLER", "Surface Preparation", "INT_EXT"),
  P("Dulux", "Polycell Polyfilla Mendall 90", "POLYCELL POLYFILLA MENDALL 90", "Surface Preparation", "INT_EXT"),
  P("Dulux", "Polycell Mortalift Cleaning Agent", "POLYCELL MORTALIFT CLEANING AGENT", "Solvents & Cleaners", "INT_EXT"),
  P("Dulux", "Polycell Woodfiller", "POLYCELL WOODFILLER", "Surface Preparation", "INT_EXT"),
  P("Dulux", "Dampshield", "DAMPSHIELD", "Waterproofing", "INT_EXT"),
  P("Dulux", "Dulux Gloss Enamel", "DULUX GLOSS ENAMEL", "Paints", "INT_EXT", ["High Gloss"]),
  P("Dulux", "Dulux Roofguard", "DULUX ROOFGUARD", "Roof Coatings", "EXT"),

  P("Plascon", "Skim Coat Exterior - PSE1", "SKIM COAT EXTERIOR", "Surface Preparation", "EXT", ["Smooth Matt"], ["Off-White"]),
  P("Plascon", "Skim Coat Interior - PSI1", "SKIM COAT INTERIOR", "Surface Preparation", "INT", ["Smooth Matt"], ["Off-White"]),
  P("Plascon", "Wood Primer - UC2", "WOOD PRIMER", "Primers & Undercoats", "INT_EXT", ["Matt"]),
  P("Plascon", "Woodcare Sunproof Varnish - WSP", "WOODCARE SUNPROOF VARNISH", "Wood Coatings", "EXT", ["Gloss", "Suede"], ["Clear"]),
  P("Plascon", "Woodcare Ultra Varnish - X", "WOODCARE ULTRA VARNISH", "Wood Coatings", "INT", ["Gloss", "Suede"], ["Clear"]),
  P("Plascon", "TradePro Undercoat - UWU1", "TRADEPRO UNDERCOAT", "Primers & Undercoats", "INT_EXT", ["Matt"], ["White"]),
  P("Plascon", "Brick & Slasto Dressing - TBD1", "BRICK AND SLASTO DRESSING", "Paints", "INT_EXT", ["Gloss"], ["Clear"]),
  P("Plascon", "Polygalv Zinc Rich Primer - SN176", "POLYGALV ZINC RICH PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Plascon", "Glazecoat - REF1124", "GLAZECOAT", "Paints", "INT_EXT", ["Clear Gloss"], ["Clear"]),
  P("Plascon", "Plascoguard 75 - PEX75", "PLASCOGUARD 75", "Industrial Coatings", "INT_EXT"),
  P("Plascon", "Plascotuff 4000 HB Floor - FHB4000", "PLASCOTUFF 4000 HB FLOOR", "Floor Coatings", "INT_EXT"),
  P("Plascon", "Plascotuff Coal Tar Pitch Coating - EPD100", "PLASCOTUFF COAL TAR PITCH COATING", "Industrial Coatings", "INT_EXT"),
  P("Plascon", "Easy Living Roof & Paving - ELR6", "EASY LIVING ROOF AND PAVING", "Roof Coatings", "EXT"),
  P("Plascon", "Dampseal", "DAMPSEAL", "Waterproofing", "INT"),
  P("Plascon", "Professional Superior Matt - PEM950/TPM", "PROFESSIONAL SUPERIOR MATT", "Paints", "INT_EXT", ["Matt"]),

  P("Versus", "Roof Paint", "ROOF PAINT", "Roof Coatings", "EXT", ["Matt"]),
  P("Versus", "Gloss Enamel", "GLOSS ENAMEL", "Paints", "INT_EXT", ["Gloss Enamel"]),
  P("Versus", "Multi-Surface Primer", "MULTI SURFACE PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Versus", "Undercoat", "UNDERCOAT", "Primers & Undercoats", "INT_EXT", [], ["White"]),
  P("Versus", "Anti-Bacterial Paint", "ANTI BACTERIAL PAINT", "Paints", "INT", ["Mid Sheen"]),
  P("Versus", "Ultra Matt", "ULTRA MATT", "Paints", "INT_EXT", ["Matt"]),
  P("Versus", "Status Matt", "STATUS MATT", "Paints", "INT_EXT", ["Matt"]),
  P("Versus", "Status Low Sheen", "STATUS LOW SHEEN", "Paints", "INT_EXT", ["Low Sheen"]),
  P("Versus", "Italic Plaster", "ITALIC PLASTER", "Textured Coatings", "INT_EXT"),
  P("Versus", "Waterproofing Paint", "WATERPROOFING PAINT", "Waterproofing", "EXT"),
  P("Versus", "Verseproof", "VERSEPROOF", "Waterproofing", "EXT"),

  P("Midas", "Envirolite Midamax 190", "MIDAMAX 190", "Paints", "INT_EXT", ["Matt"]),
  P("Midas", "Envirolite Midafelt 225", "MIDAFELT 225", "Paints", "INT_EXT", ["Matt"]),
  P("Midas", "Envirolite Midalux 230", "MIDALUX 230", "Paints", "INT_EXT", ["Satin"]),
  P("Midas", "Envirolite Midalux 240", "MIDALUX 240", "Paints", "INT_EXT", ["Low Sheen"]),
  P("Midas", "Midaflow Gloss Enamel", "GLOSS ENAMEL", "Paints", "INT_EXT", ["Gloss Enamel"]),
  P("Midas", "Midamite Textured Wall Paint", "MIDAMITE TEXTURED WALL PAINT", "Textured Coatings", "EXT"),
  P("Midas", "Wood Primer", "WOOD PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Midas", "Penetrating Primer", "PENETRATING PRIMER", "Primers & Undercoats", "INT_EXT"),
  P("Midas", "Alkyd-Based Undercoat", "ALKYD BASED UNDERCOAT", "Primers & Undercoats", "INT_EXT", [], ["White"]),
  P("Midas", "Water-Based Enamel", "WATER BASED ENAMEL", "Paints", "INT_EXT"),
  P("Midas", "Fibreforce", "FIBREFORCE", "Waterproofing", "EXT"),

  P("Marmoran", "Permacrete - AS003/AS014", "PERMACRETE 1MM", "Textured Coatings", "INT_EXT", ["1 mm", "1.5 mm"]),
  P("Marmoran", "Permaplast - AS014", "PERMAPLAST", "Textured Coatings", "INT_EXT"),
  P("Marmoran", "Permasuede - AS024", "PERMASUEDE", "Textured Coatings", "INT_EXT"),
  P("Marmoran", "Background Plaster - AS017/AS018", "BACKGROUND PLASTER", "Textured Coatings", "INT_EXT", ["Standard", "2 mm"]),
  P("Marmoran", "Mali Spray - AS007S", "MALI SPRAY", "Textured Coatings", "INT_EXT", ["1 mm", "1.5 mm"]),
  P("Marmoran", "Polysheen - AS009", "POLYSHEEN", "Textured Coatings", "INT_EXT"),
  P("Marmoran", "Perma Spray", "PERMA SPRAY", "Textured Coatings", "INT_EXT"),
  P("Marmoran", "Glassguard", "GLASSGUARD", "Textured Coatings", "INT_EXT"),

  P("Earthcote", "Pandomo", "PANDOMO", "Textured Coatings", "INT"),
  P("Earthcote", "Pandomo Primer", "PANDOMO PRIMER", "Primers & Undercoats", "INT"),
  P("Earthcote", "Wall Wax", "WALL WAX", "Decorative Finishes", "INT", [], ["Clear"]),

  P("Cemcrete", "Cemcote", "CEMCOTE", "Cementitious Coatings", "INT_EXT"),
  P("Cemcrete", "Multipurpose Water-Based Sealer", "MULTIPURPOSE WATER BASED SEALER", "Sealers", "INT_EXT"),

  P("Coprox", "Masonry Waterproofing", "MASONRY WATERPROOFING", "Waterproofing", "INT_EXT"),
  P("Coprox", "Waterproof Dualcoat", "WATERPROOF DUALCOAT", "Waterproofing", "INT_EXT"),
  P("Coprox", "Wall & Floor Clear Sealer", "WALL AND FLOOR CLEAR SEALER", "Sealers", "INT_EXT", [], ["Clear"]),

  P("Woodoc", "Woodoc 5", "WOODOC 5", "Wood Coatings", "INT", ["Matt"], ["Clear"]),
  P("Woodoc", "Woodoc 10", "WOODOC 10", "Wood Coatings", "INT", ["Velvet"], ["Clear"]),
  P("Woodoc", "Woodoc 25", "WOODOC 25", "Wood Coatings", "INT", ["Matt", "Satin"], ["Clear"]),
  P("Woodoc", "Woodoc 30", "WOODOC 30", "Wood Coatings", "EXT", ["Low Gloss"], ["Clear"]),
  P("Woodoc", "Woodoc 50", "WOODOC 50", "Wood Coatings", "EXT", ["Gloss", "Matt"], ["Clear"]),
  P("Woodoc", "Stain Concentrate", "STAIN CONCENTRATE", "Wood Coatings", "INT_EXT"),

  P("PROMINENT", "Select Sheen", "SELECT SHEEN", "Paints", "INT_EXT", ["Sheen"]),
  P("PROMINENT", "Speciality Damp Cure", "SPECIALITY DAMP CURE", "Waterproofing", "INT_EXT", [], ["White"]),
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
  const brand = candidates.find(candidate => candidate.name === name)
    ?? candidates.sort((a, b) => b._count.masterCatalogueProducts - a._count.masterCatalogueProducts)[0];
  if (!brand) throw new Error(`BRAND supplier not found: ${name}. Run the Batch 05 supplier seed first.`);
  return brand;
}

async function main() {
  const duplicateKeys = PRODUCTS.filter((row, index, all) =>
    all.findIndex(candidate => candidate.brand === row.brand && candidate.identity === row.identity) !== index,
  );
  if (duplicateKeys.length) {
    throw new Error(`Duplicate Batch 05 identities: ${duplicateKeys.map(row => `${row.brand}:${row.identity}`).join(", ")}`);
  }

  const brands = new Map(
    await Promise.all([...new Set(PRODUCTS.map(row => row.brand))].map(async name => [name, await resolveBrand(name)] as const)),
  );
  let created = 0;
  let updated = 0;
  let finishesCreated = 0;
  let basesCreated = 0;

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

    for (const name of row.finishes ?? []) {
      const normalizedName = normalize(name);
      const previous = await prisma.masterProductFinish.findUnique({
        where: { productId_normalizedName: { productId: product.id, normalizedName } },
        select: { id: true },
      });
      await prisma.masterProductFinish.upsert({
        where: { productId_normalizedName: { productId: product.id, normalizedName } },
        create: { productId: product.id, name, normalizedName },
        update: { name },
      });
      if (!previous) finishesCreated += 1;
    }

    for (const name of row.bases ?? []) {
      const normalizedName = normalize(name);
      const previous = await prisma.masterProductBase.findUnique({
        where: { productId_normalizedName: { productId: product.id, normalizedName } },
        select: { id: true },
      });
      await prisma.masterProductBase.upsert({
        where: { productId_normalizedName: { productId: product.id, normalizedName } },
        create: { productId: product.id, name, normalizedName },
        update: { name },
      });
      if (!previous) basesCreated += 1;
    }
  }

  console.log(
    `Batch 05 complete: ${PRODUCTS.length} products processed `
    + `(${created} created, ${updated} updated), ${finishesCreated} finishes created, ${basesCreated} bases created.`,
  );
}

main()
  .catch(error => {
    console.error("Batch 05 master catalogue product seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
