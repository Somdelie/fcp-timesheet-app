import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProductUom } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ── Step 1: Ensure the "DIY Savoy Consumables" supplier exists ──
async function ensureSupplier() {
  const supplier = await prisma.supplier.upsert({
    where: { name: "DIY Savoy Consumables" },
    update: {},
    create: { name: "DIY Savoy Consumables", isActive: true },
    select: { id: true, name: true },
  });
  console.log(`Supplier: ${supplier.name} (${supplier.id})`);
  return supplier.id;
}

// ── Step 2: Ensure consumable products exist ──
const consumableProducts = [
  {
    name: "424 Turps 5L",
    sku: "CON-TURPS-5L",
    uom: ProductUom.L,
    unitSize: "5.000",
  },
  {
    name: "Dish Washing Liquid",
    sku: "CON-DISH-WASH",
    uom: ProductUom.UNIT,
    unitSize: "1.000",
  },
  {
    name: "Paint Stripper",
    sku: "CON-PAINT-STRIP",
    uom: ProductUom.UNIT,
    unitSize: "1.000",
  },
];

async function ensureProducts(supplierId: string) {
  for (const p of consumableProducts) {
    await prisma.procurementProduct.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        name: p.name,
        sku: p.sku,
        uom: p.uom,
        unitSize: p.unitSize,
        supplierId,
        isActive: true,
      },
    });
  }
  console.log(`Ensured ${consumableProducts.length} consumable products`);
}

// ── Step 3: Seed the orders ──
const consumableOrders = [
  {
    reference: "66798",
    siteCode: "6573",
    createdAt: new Date("2026-03-03T10:00:00"),
    note: "Imported from BuildSmart PO 66798",
    items: [
      { sku: "CON-TURPS-5L", quantity: 3, note: "424 Turps 5L" },
      { sku: "CON-DISH-WASH", quantity: 1, note: "Dish Washing Liquid" },
    ],
  },
  {
    reference: "66793",
    siteCode: "6156",
    createdAt: new Date("2026-03-03T10:00:00"),
    note: "Imported from BuildSmart PO 66793",
    items: [{ sku: "CON-TURPS-5L", quantity: 1, note: "424 Turps 5L" }],
  },
  {
    reference: "66685",
    siteCode: "6450",
    createdAt: new Date("2026-03-03T09:00:00"),
    note: "Imported from BuildSmart PO 66685",
    items: [{ sku: "CON-PAINT-STRIP", quantity: 1, note: "Paint Stripper" }],
  },
];

async function seedConsumableOrders(supplierId: string) {
  for (const order of consumableOrders) {
    // Skip if already exists
    const existing = await prisma.siteProductOrder.findFirst({
      where: { reference: order.reference },
      select: { id: true },
    });
    if (existing) {
      console.log(`Order ${order.reference}: already exists, skipping`);
      continue;
    }

    const site = await prisma.site.findFirst({
      where: { code: order.siteCode },
      select: { id: true, code: true, name: true },
    });
    if (!site) {
      console.warn(
        `Skipping order ${order.reference}: site code ${order.siteCode} not found`,
      );
      continue;
    }

    const created = await prisma.siteProductOrder.create({
      data: {
        siteId: site.id,
        supplierId,
        reference: order.reference,
        note: order.note,
        createdAt: order.createdAt,
      },
      select: { id: true },
    });

    for (const item of order.items) {
      const product = await prisma.procurementProduct.findFirst({
        where: { sku: item.sku },
        select: { id: true },
      });
      if (!product) {
        console.warn(
          `Order ${order.reference}: product not found for SKU ${item.sku}`,
        );
        continue;
      }

      await prisma.siteProductOrderItem.create({
        data: {
          orderId: created.id,
          productId: product.id,
          quantity: item.quantity,
          unitPriceAtOrder: "0",
          note: item.note,
          createdAt: order.createdAt,
        },
      });
    }

    console.log(`Order ${order.reference} → site ${site.code} (${site.name})`);
  }
}

async function main() {
  const supplierId = await ensureSupplier();
  await ensureProducts(supplierId);
  await seedConsumableOrders(supplierId);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
