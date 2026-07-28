import { prisma } from "../lib/prisma";

const BRANDS = [
  { name: "Midas", normalizedName: "MIDAS", vendors: ["Midas Paints Cape Town (Pty) Ltd"] },
  { name: "Earthcote", normalizedName: "EARTHCOTE", vendors: [] },
  { name: "RBP", normalizedName: "RBP", vendors: [] },
] as const;

async function ensureBrand(seed: (typeof BRANDS)[number]) {
  const matches = await prisma.supplier.findMany({
    where: {
      OR: [
        { name: { equals: seed.name, mode: "insensitive" } },
        { normalizedName: { equals: seed.normalizedName, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, supplierType: true, normalizedName: true },
  });

  let brand = matches.find(candidate => candidate.name === seed.name && candidate.supplierType === "BRAND");
  brand ??= matches.find(candidate => candidate.supplierType === "BRAND");

  if (!brand) {
    brand = await prisma.supplier.create({
      data: {
        name: seed.name,
        normalizedName: seed.normalizedName,
        supplierType: "BRAND",
        isActive: true,
      },
      select: { id: true, name: true, supplierType: true, normalizedName: true },
    });
    console.log(`Created brand supplier: ${seed.name}`);
  } else if (brand.normalizedName !== seed.normalizedName) {
    brand = await prisma.supplier.update({
      where: { id: brand.id },
      data: { normalizedName: seed.normalizedName, supplierType: "BRAND", isActive: true },
      select: { id: true, name: true, supplierType: true, normalizedName: true },
    });
  }

  for (const vendorName of seed.vendors) {
    const vendor = await prisma.supplier.findFirst({
      where: { name: { equals: vendorName, mode: "insensitive" } },
      select: { id: true, name: true, supplierType: true, parentSupplierId: true },
    });
    if (!vendor) {
      console.warn(`Vendor not found; skipped: ${vendorName}`);
      continue;
    }
    if (vendor.id === brand.id) throw new Error(`${vendor.name} cannot be both brand and vendor.`);
    if (vendor.supplierType !== "VENDOR" || vendor.parentSupplierId !== brand.id) {
      await prisma.supplier.update({
        where: { id: vendor.id },
        data: { supplierType: "VENDOR", parentSupplierId: brand.id },
      });
      console.log(`Linked vendor to brand: ${vendor.name} -> ${brand.name}`);
    }
  }
}

async function main() {
  for (const brand of BRANDS) await ensureBrand(brand);
  console.log(`Batch 04 supplier setup complete: ${BRANDS.length} brands checked.`);
}

main()
  .catch(error => {
    console.error("Batch 04 supplier setup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

