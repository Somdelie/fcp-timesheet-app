import { prisma } from "../lib/prisma";

type BrandSeed = {
  name: string;
  normalizedName: string;
  vendorAliases: readonly string[];
};

const BRANDS: readonly BrandSeed[] = [
  {
    name: "Dulux",
    normalizedName: "DULUX",
    vendorAliases: [
      "SHAVE PAINTS - SANDTON",
      "AA Paints Durbanville",
      "JF Paints Blouberg - Dulux",
      "Dulux Specialist Paint Centre - Gezina",
      "Dulux Centurion",
      "Dulux Specialist Paint Centre Klerksdorp",
      "SSK Agriland Mossel Bay - Dulux",
    ],
  },
  {
    name: "Plascon",
    normalizedName: "PLASCON",
    vendorAliases: [
      "DIY Savoy Plascon",
      "City Paint and Tool Plett Plascon POS",
    ],
  },
  {
    name: "Marmoran",
    normalizedName: "MARMORAN",
    vendorAliases: [],
  },
  {
    name: "UROCHEM",
    normalizedName: "UROCHEM",
    vendorAliases: ["Urochem Trading (Pty) Ltd"],
  },
  {
    name: "PROMINENT",
    normalizedName: "PROMINENT",
    vendorAliases: ["Prominent Paints"],
  },
  {
    name: "Versus",
    normalizedName: "VERSUS",
    vendorAliases: ["Versus Paint Specialist (Pty) Ltd"],
  },
] as const;

async function ensureBrand(seed: BrandSeed) {
  const matches = await prisma.supplier.findMany({
    where: {
      OR: [
        { name: { equals: seed.name, mode: "insensitive" } },
        { normalizedName: { equals: seed.normalizedName, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      supplierType: true,
      isActive: true,
      _count: { select: { masterCatalogueProducts: true } },
    },
  });

  // Prefer the exact canonical spelling. This deliberately chooses `Dulux`
  // over the duplicate `DULUX` record without deleting either record.
  let brand = matches.find(candidate => candidate.name === seed.name);
  brand ??= matches
    .filter(candidate => candidate.supplierType === "BRAND")
    .sort(
      (a, b) =>
        b._count.masterCatalogueProducts - a._count.masterCatalogueProducts ||
        a.name.localeCompare(b.name),
    )[0];

  if (!brand) {
    brand = await prisma.supplier.create({
      data: {
        name: seed.name,
        normalizedName: seed.normalizedName,
        supplierType: "BRAND",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        supplierType: true,
        isActive: true,
        _count: { select: { masterCatalogueProducts: true } },
      },
    });
    console.log(`Created brand supplier: ${seed.name}`);
  } else if (
    brand.supplierType !== "BRAND" ||
    brand.normalizedName !== seed.normalizedName ||
    !brand.isActive
  ) {
    brand = await prisma.supplier.update({
      where: { id: brand.id },
      data: {
        supplierType: "BRAND",
        normalizedName: seed.normalizedName,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        supplierType: true,
        isActive: true,
        _count: { select: { masterCatalogueProducts: true } },
      },
    });
    console.log(`Promoted/normalized brand supplier: ${brand.name}`);
  }

  const duplicates = matches.filter(candidate => candidate.id !== brand.id);
  for (const duplicate of duplicates) {
    console.warn(
      `Duplicate brand-like supplier left unchanged: ${duplicate.name} (${duplicate.id}, ${duplicate._count.masterCatalogueProducts} master products). Canonical ${seed.name}: ${brand.id}.`,
    );
  }

  for (const vendorName of seed.vendorAliases) {
    const vendor = await prisma.supplier.findFirst({
      where: { name: { equals: vendorName, mode: "insensitive" } },
      select: { id: true, name: true, supplierType: true, parentSupplierId: true },
    });

    if (!vendor) {
      console.warn(`Vendor not found; skipped brand link: ${vendorName} -> ${seed.name}`);
      continue;
    }

    if (vendor.id === brand.id) {
      throw new Error(`Supplier cannot be both brand and vendor: ${vendor.name}`);
    }

    if (vendor.supplierType !== "VENDOR" || vendor.parentSupplierId !== brand.id) {
      await prisma.supplier.update({
        where: { id: vendor.id },
        data: { supplierType: "VENDOR", parentSupplierId: brand.id },
      });
      console.log(`Linked vendor to brand: ${vendor.name} -> ${seed.name}`);
    }
  }

  return brand;
}

async function main() {
  for (const seed of BRANDS) await ensureBrand(seed);
  console.log(`Supplier brand setup complete: ${BRANDS.length} brands checked.`);
}

main()
  .catch(error => {
    console.error("Supplier brand setup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

