import { prisma } from "../lib/prisma";

type BrandSeed = {
  name: string;
  normalizedName: string;
  vendorNames: readonly string[];
};

const BRANDS: readonly BrandSeed[] = [
  { name: "Dulux", normalizedName: "DULUX", vendorNames: [] },
  { name: "Plascon", normalizedName: "PLASCON", vendorNames: [] },
  { name: "Versus", normalizedName: "VERSUS", vendorNames: ["Versus Paint Specialist (Pty) Ltd"] },
  { name: "Midas", normalizedName: "MIDAS", vendorNames: ["Midas Paints Cape Town (Pty) Ltd"] },
  { name: "Marmoran", normalizedName: "MARMORAN", vendorNames: ["Marmoran"] },
  { name: "Earthcote", normalizedName: "EARTHCOTE", vendorNames: [] },
  { name: "Cemcrete", normalizedName: "CEMCRETE", vendorNames: ["Cemcrete"] },
  { name: "Coprox", normalizedName: "COPROX", vendorNames: [] },
  { name: "Woodoc", normalizedName: "WOODOC", vendorNames: [] },
  { name: "PROMINENT", normalizedName: "PROMINENT", vendorNames: ["Prominent Paints"] },
] as const;

function vendorDisplayName(brandName: string) {
  return `${brandName} (Vendor)`;
}

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
      parentSupplierId: true,
      _count: { select: { masterCatalogueProducts: true } },
    },
  });

  let brand = matches
    .filter(candidate => candidate.supplierType === "BRAND")
    .sort((a, b) => b._count.masterCatalogueProducts - a._count.masterCatalogueProducts)[0];

  // An exact-name VENDOR is legacy purchasing data. Preserve it as a vendor,
  // give it an explicit display label, then create a separate BRAND record.
  if (!brand) {
    const sameNameVendor = matches.find(candidate => candidate.supplierType === "VENDOR");
    if (sameNameVendor && seed.vendorNames.some(name => name.toLowerCase() === sameNameVendor.name.toLowerCase())) {
      await prisma.supplier.update({
        where: { id: sameNameVendor.id },
        data: {
          name: vendorDisplayName(seed.name),
          normalizedName: `${seed.normalizedName} VENDOR`,
          supplierType: "VENDOR",
          isActive: true,
        },
      });
      console.log(`Preserved purchasing supplier as vendor: ${sameNameVendor.name}`);
    }

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
        parentSupplierId: true,
        _count: { select: { masterCatalogueProducts: true } },
      },
    });
    console.log(`Created brand supplier: ${seed.name}`);
  } else {
    brand = await prisma.supplier.update({
      where: { id: brand.id },
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
        parentSupplierId: true,
        _count: { select: { masterCatalogueProducts: true } },
      },
    });
  }

  for (const originalVendorName of seed.vendorNames) {
    const possibleNames = [originalVendorName, vendorDisplayName(seed.name)];
    const vendor = await prisma.supplier.findFirst({
      where: {
        id: { not: brand.id },
        supplierType: "VENDOR",
        OR: possibleNames.map(name => ({ name: { equals: name, mode: "insensitive" as const } })),
      },
      select: { id: true, name: true, parentSupplierId: true },
    });
    if (!vendor) continue;
    if (vendor.parentSupplierId !== brand.id) {
      await prisma.supplier.update({
        where: { id: vendor.id },
        data: { parentSupplierId: brand.id, supplierType: "VENDOR", isActive: true },
      });
      console.log(`Linked vendor to brand: ${vendor.name} -> ${brand.name}`);
    }
  }
}

async function main() {
  for (const seed of BRANDS) await ensureBrand(seed);
  console.log(`Batch 05 supplier setup complete: ${BRANDS.length} brands checked.`);
}

main()
  .catch(error => {
    console.error("Batch 05 supplier setup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
