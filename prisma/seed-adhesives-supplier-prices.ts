import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProductUom } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL environment variable is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PAINTS_CATEGORY_ID = "cmmdxbuw40008w8plm4urs9ae"; // reuse existing paints category
const STARTS_ON = new Date("2026-03-01T00:00:00.000Z");

type Variant = {
  unitSize: number;
  uom?: keyof typeof ProductUom;
  price: number;
};

type Row = { name: string; sku?: string | null; variants: Variant[] };

const rows: Row[] = [
  // UNIVERSAL SILICONES (270ML)
  {
    name: "Universal Silicone - Clear",
    sku: "123975",
    variants: [{ unitSize: 0.27, uom: "L", price: 32.9 }],
  },
  {
    name: "Universal Silicone - White",
    sku: "123976",
    variants: [{ unitSize: 0.27, uom: "L", price: 32.9 }],
  },
  {
    name: "Universal Silicone - Grey",
    sku: "123977",
    variants: [{ unitSize: 0.27, uom: "L", price: 32.9 }],
  },
  {
    name: "Universal Silicone - Black",
    sku: "123978",
    variants: [{ unitSize: 0.27, uom: "L", price: 32.9 }],
  },
  {
    name: "Universal Silicone - Brown",
    sku: "123979",
    variants: [{ unitSize: 0.27, uom: "L", price: 32.9 }],
  },
  {
    name: "Universal Silicone - Bronze",
    sku: "123980",
    variants: [{ unitSize: 0.27, uom: "L", price: 32.9 }],
  },

  // SILIRUB N05+ Neutral Silicones (280ML)
  {
    name: "Silirub N05+ White",
    sku: "167425",
    variants: [{ unitSize: 0.28, uom: "L", price: 34.9 }],
  },
  {
    name: "Silirub N05+ Black",
    sku: "167427",
    variants: [{ unitSize: 0.28, uom: "L", price: 34.9 }],
  },
  {
    name: "Silirub N05+ Clear",
    sku: "167428",
    variants: [{ unitSize: 0.28, uom: "L", price: 34.9 }],
  },
  {
    name: "Silirub N05+ Grey",
    sku: "168407",
    variants: [{ unitSize: 0.28, uom: "L", price: 34.9 }],
  },
  {
    name: "Silirub N05+ Bronze",
    sku: "168910",
    variants: [{ unitSize: 0.28, uom: "L", price: 34.9 }],
  },
  {
    name: "Silirub N05+ Anthracite Grey",
    sku: "168911",
    variants: [{ unitSize: 0.28, uom: "L", price: 34.9 }],
  },

  // Paintable Sealant / Gap filler (270ML)
  {
    name: "Paintable Sealant - White",
    sku: "123974",
    variants: [{ unitSize: 0.27, uom: "L", price: 13.9 }],
  },
  {
    name: "Paintable Sealant - Grey",
    sku: "124132",
    variants: [{ unitSize: 0.27, uom: "L", price: 13.9 }],
  },
  {
    name: "Gap Filler (All Weather Flex)",
    sku: "147116",
    variants: [{ unitSize: 0.27, uom: "L", price: 28.2 }],
  },

  // PU FOAMS
  {
    name: "Fill & Fix Foam 500ml",
    sku: "123572",
    variants: [{ unitSize: 0.5, uom: "L", price: 59.9 }],
  },
  {
    name: "Fill & Fix Foam 750ml",
    sku: "123571",
    variants: [{ unitSize: 0.75, uom: "L", price: 79.9 }],
  },

  // SOUDAFLEX (600ML)
  {
    name: "Soudaflex 40 FC - White/Black/Grey 600ml",
    sku: "102486",
    variants: [{ unitSize: 0.6, uom: "L", price: 88.9 }],
  },

  // MULTIBOND SMX35
  {
    name: "SMX35 Seal & Stretch - MULTIBOND - 290 ML - WHITE",
    sku: "124604",
    variants: [{ unitSize: 0.29, uom: "L", price: 72.9 }],
  },
  {
    name: "SMX35 Seal & Stretch - MULTIBOND - 600 ML - WHITE",
    sku: "124598",
    variants: [{ unitSize: 0.6, uom: "L", price: 99.9 }],
  },
];

async function main() {
  // create or get supplier
  const supplierName = "Imported Adhesives (seed)";
  const supplier = await prisma.supplier.upsert({
    where: { name: supplierName },
    update: { isActive: true },
    create: { name: supplierName },
  });

  let createdProducts = 0;
  let updatedPrices = 0;
  let createdPrices = 0;

  for (const r of rows) {
    // try to find existing product by SKU first, then by name
    let product = null;
    if (r.sku) {
      product = await prisma.procurementProduct.findUnique({
        where: { sku: r.sku },
      });
    }
    if (!product) {
      product = await prisma.procurementProduct.findFirst({
        where: { name: r.name },
      });
    }

    if (!product) {
      product = await prisma.procurementProduct.create({
        data: {
          name: r.name,
          sku: r.sku ?? undefined,
          categoryId: PAINTS_CATEGORY_ID,
          supplierId: supplier.id,
          isActive: true,
        },
      });
      createdProducts++;
      console.log(`Created product: ${product.name} (${product.id})`);
    } else {
      // ensure supplierId is set as default supplier if missing
      if (!product.supplierId) {
        await prisma.procurementProduct.update({
          where: { id: product.id },
          data: { supplierId: supplier.id },
        });
      }
    }

    // for each variant, upsert SupplierProductPrice for this supplier/product/size
    for (const v of r.variants) {
      const existing = await prisma.supplierProductPrice.findFirst({
        where: {
          supplierId: supplier.id,
          productId: product.id,
          unitSize: v.unitSize,
        },
      });

      if (existing) {
        await prisma.supplierProductPrice.update({
          where: { id: existing.id },
          data: { price: v.price, startsOn: STARTS_ON, isActive: true },
        });
        updatedPrices++;
      } else {
        await prisma.supplierProductPrice.create({
          data: {
            supplierId: supplier.id,
            productId: product.id,
            uom: v.uom ?? "L",
            unitSize: v.unitSize,
            price: v.price,
            startsOn: STARTS_ON,
            isActive: true,
          },
        });
        createdPrices++;
      }
    }
  }

  console.log(`Created products: ${createdProducts}`);
  console.log(
    `Created prices: ${createdPrices}, Updated prices: ${updatedPrices}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
