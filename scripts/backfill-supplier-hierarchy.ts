import "dotenv/config";
import { prisma } from "@/lib/prisma";

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

async function main() {
  console.log("=== Backfill supplier hierarchy ===");

  const suppliers = await prisma.supplier.findMany({
    select: {
      id: true,
      name: true,
      normalizedName: true,
      supplierType: true,
      parentSupplierId: true,
    },
  });

  const byNorm = new Map<string, { id: string; name: string }>();
  for (const s of suppliers) {
    byNorm.set(normalize(s.name), { id: s.id, name: s.name });
  }

  const dulux = byNorm.get("dulux");
  const plascon = byNorm.get("plascon");

  if (dulux) {
    await prisma.supplier.update({
      where: { id: dulux.id },
      data: { supplierType: "BRAND" },
    });
    console.log(`Marked BRAND: ${dulux.name}`);
  }

  if (plascon) {
    await prisma.supplier.update({
      where: { id: plascon.id },
      data: { supplierType: "BRAND" },
    });
    console.log(`Marked BRAND: ${plascon.name}`);
  }

  const duluxVendorMatchers = [/aa paints/i, /shave paints/i];

  const plasconVendorMatchers = [/diy savoy/i, /kansai/i];

  for (const s of suppliers) {
    const norm = normalize(s.name);

    if (dulux && duluxVendorMatchers.some((rx) => rx.test(s.name))) {
      await prisma.supplier.update({
        where: { id: s.id },
        data: {
          supplierType: "VENDOR",
          parentSupplierId: dulux.id,
        },
      });
      console.log(`Linked ${s.name} -> Dulux`);
      continue;
    }

    if (plascon && plasconVendorMatchers.some((rx) => rx.test(s.name))) {
      await prisma.supplier.update({
        where: { id: s.id },
        data: {
          supplierType: "VENDOR",
          parentSupplierId: plascon.id,
        },
      });
      console.log(`Linked ${s.name} -> Plascon`);
      continue;
    }

    // keep existing suppliers as VENDOR by default
    if (
      !s.parentSupplierId &&
      s.supplierType !== "VENDOR" &&
      norm !== "dulux" &&
      norm !== "plascon"
    ) {
      await prisma.supplier.update({
        where: { id: s.id },
        data: { supplierType: "VENDOR" },
      });
    }
  }

  console.log("=== Done ===");
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
