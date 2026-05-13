import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProductUom } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL environment variable is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ── Known IDs ──────────────────────────────────────────────────────────────
const PLASCON_BRAND_ID = "cmmdxdol60009w8plpxqwnxct";
const DIY_SAVOY_PLASCON_ID = "cmmluhd72005jsgpvtjuthcbj";
const DIY_SAVOY_CONSUMABLES_ID = "cmmkyfilp0000c4ply9u04qs0";
const SITE_CODE = "6254"; // Ellipse Ph3

// Category IDs
const CAT_PAINTS = "cmmdxbuw40008w8plm4urs9ae";
const CAT_PRIMERS = "cmmkuzabt0000sgplwm07uc5e";
const CAT_UNDERCOATS = "cmmkuzap80001sgplskriu5x5";
const CAT_ENAMELS = "cmmkuzb2l0002sgplzxl23cxy";
const CAT_ROOF_PAINTS = "cmmkuzbg00003sgplae36gtnx";
const CAT_WATERPROOFING = "cmmkuzbtg0004sgplqzkz8djy";
const CAT_SEALERS = "cmmkuzc6u0005sgpld7k1vppz";
const CAT_FILLERS = "cmmkuzdb00008sgpl7p73l0cg";

// ── Step 1: Ensure new suppliers ───────────────────────────────────────────
async function ensureSuppliers() {
  const marmoran = await prisma.supplier.upsert({
    where: { name: "Marmoran" },
    update: { isActive: true },
    create: { name: "Marmoran", isActive: true },
    select: { id: true },
  });

  const soudal = await prisma.supplier.upsert({
    where: { name: "Soudal" },
    update: { isActive: true },
    create: { name: "Soudal", isActive: true },
    select: { id: true },
  });

  const urochem = await prisma.supplier.upsert({
    where: { name: "Urochem Trading (Pty) Ltd" },
    update: { isActive: true },
    create: { name: "Urochem Trading (Pty) Ltd", isActive: true },
    select: { id: true },
  });

  console.log(`Suppliers ready — Marmoran: ${marmoran.id}`);
  console.log(`               — Soudal: ${soudal.id}`);
  console.log(`               — Urochem: ${urochem.id}`);

  return {
    marmoranId: marmoran.id,
    soudalId: soudal.id,
    urochemId: urochem.id,
  };
}

// ── Step 2: Fix & ensure all products ─────────────────────────────────────
// Upserts products that were missing from the catalog or had names that
// didn't match BuildSmart PDF descriptions.
async function fixAndEnsureProducts(supplierIds: {
  marmoranId: string;
  soudalId: string;
  urochemId: string;
}) {
  type Product = {
    sku: string;
    name: string;
    categoryId: string;
    supplierId: string;
    uom: keyof typeof ProductUom;
    unitSize: string;
  };

  // ── Plascon brand: missing size variants ──
  const plasconProducts: Product[] = [
    // 5L variant of Prof. Contractors Matt White (only 20L existed)
    {
      sku: "PEM000600-0005",
      name: "Prof. Contractors Matt White",
      categoryId: CAT_PAINTS,
      supplierId: PLASCON_BRAND_ID,
      uom: "L",
      unitSize: "5.000",
    },
    // Universal Undercoat White 5L (BuildSmart: UC0000015L)
    {
      sku: "UC000001-0005",
      name: "Plascon Universal Undercoat White",
      categoryId: CAT_UNDERCOATS,
      supplierId: PLASCON_BRAND_ID,
      uom: "L",
      unitSize: "5.000",
    },
    // Polvin Super Acrylic Tintbase Pastel 5L (only 20L existed as TAP001010-0020)
    {
      sku: "TAP001010-0005",
      name: "Plascon Sup. Acr. Polvin T/B Pastel",
      categoryId: CAT_PAINTS,
      supplierId: PLASCON_BRAND_ID,
      uom: "L",
      unitSize: "5.000",
    },
    // Velvaglo Non-Drip Waterbased 1L
    {
      sku: "TVW001000-0001",
      name: "Plascon Velvaglo WB Enamel T/B Pastel",
      categoryId: CAT_ENAMELS,
      supplierId: PLASCON_BRAND_ID,
      uom: "L",
      unitSize: "1.000",
    },
    // Woodcare Ultra Varnish Gloss Clear 5L
    {
      sku: "WUV000001-0005",
      name: "Woodcare Ultra Varnish Gloss Clear",
      categoryId: CAT_ENAMELS,
      supplierId: PLASCON_BRAND_ID,
      uom: "L",
      unitSize: "5.000",
    },
    // URP4 Trade Pro Roof and More — Black 5L & 20L
    {
      sku: "URP4-BLACK-0005",
      name: "URP4 Trade Pro Roof and More Black",
      categoryId: CAT_ROOF_PAINTS,
      supplierId: PLASCON_BRAND_ID,
      uom: "L",
      unitSize: "5.000",
    },
    {
      sku: "URP4-BLACK-0020",
      name: "URP4 Trade Pro Roof and More Black",
      categoryId: CAT_ROOF_PAINTS,
      supplierId: PLASCON_BRAND_ID,
      uom: "L",
      unitSize: "20.000",
    },
  ];

  // ── Marmoran texture coatings ──
  const marmoranProducts: Product[] = [
    {
      sku: "MAR-RBP-PRIMER",
      name: "Marmoran RBP Primer",
      categoryId: CAT_PRIMERS,
      supplierId: supplierIds.marmoranId,
      uom: "KG",
      unitSize: "20.000",
    },
    {
      sku: "MAR-PERMASUEDE",
      name: "Marmoran Permasuede",
      categoryId: CAT_PAINTS,
      supplierId: supplierIds.marmoranId,
      uom: "KG",
      unitSize: "25.000",
    },
    {
      sku: "MAR-MALI-1MM-32KG",
      name: "Marmoran 1mm Mali Spray",
      categoryId: CAT_PAINTS,
      supplierId: supplierIds.marmoranId,
      uom: "KG",
      unitSize: "32.000",
    },
  ];

  // ── Soudal: SMX35 may already exist from adhesives seed; upsert safely ──
  const soudalProducts: Product[] = [
    {
      sku: "124604",
      name: "SMX35 Seal & Stretch - MULTIBOND - 290 ML - WHITE",
      categoryId: CAT_SEALERS,
      supplierId: supplierIds.soudalId,
      uom: "L",
      unitSize: "0.290",
    },
    {
      sku: "124598",
      name: "SMX35 Seal & Stretch - MULTIBOND - 600 ML - WHITE",
      categoryId: CAT_SEALERS,
      supplierId: supplierIds.soudalId,
      uom: "L",
      unitSize: "0.600",
    },
  ];

  // ── Urochem ──
  const urochemProducts: Product[] = [
    {
      sku: "URO-BACKING-CORD-10MM",
      name: "10mm Backing Cord",
      categoryId: CAT_SEALERS,
      supplierId: supplierIds.urochemId,
      uom: "UNIT",
      unitSize: "1.000",
    },
  ];

  // ── Consumables (masking tape, sandpaper) via DIY Savoy Consumables ──
  const consumableProducts: Product[] = [
    {
      sku: "CON-MASK-TAPE-24MM",
      name: "Masking Tape 24mm",
      categoryId: CAT_PAINTS,
      supplierId: DIY_SAVOY_CONSUMABLES_ID,
      uom: "UNIT",
      unitSize: "1.000",
    },
    {
      sku: "CON-MASK-TAPE-18MM",
      name: "Masking Tape 18mm",
      categoryId: CAT_PAINTS,
      supplierId: DIY_SAVOY_CONSUMABLES_ID,
      uom: "UNIT",
      unitSize: "1.000",
    },
    {
      sku: "CON-SANDPAPER-P80-50M",
      name: "Sandpaper P80 50m",
      categoryId: CAT_PAINTS,
      supplierId: DIY_SAVOY_CONSUMABLES_ID,
      uom: "UNIT",
      unitSize: "1.000",
    },
    {
      sku: "POL-POLYFILLA-INT-12KG",
      name: "Polycell Polyfilla Interior 12KG",
      categoryId: CAT_FILLERS,
      supplierId: DIY_SAVOY_CONSUMABLES_ID,
      uom: "KG",
      unitSize: "12.000",
    },
  ];

  const allProducts = [
    ...plasconProducts,
    ...marmoranProducts,
    ...soudalProducts,
    ...urochemProducts,
    ...consumableProducts,
  ];

  let created = 0;
  let skipped = 0;

  for (const p of allProducts) {
    const existing = await prisma.procurementProduct.findUnique({
      where: { sku: p.sku },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.procurementProduct.create({
      data: {
        name: p.name,
        sku: p.sku,
        categoryId: p.categoryId,
        supplierId: p.supplierId,
        uom: p.uom,
        unitSize: p.unitSize,
        isActive: true,
      },
    });
    created++;
    console.log(`Created product: ${p.name} (${p.sku})`);
  }

  console.log(`Products — created: ${created}, already exists: ${skipped}`);
}

// ── Step 3: Seed orders ────────────────────────────────────────────────────
// All orders are for site 6254 (Ellipse Ph3).
// Reference = BuildSmart PO number. Orders are skipped if already seeded.

type OrderItem = {
  sku: string;
  quantity: number;
  unitPriceAtOrder: string;
  note?: string;
};

type OrderEntry = {
  reference: string;
  createdAt: Date;
  note?: string;
  items: OrderItem[];
};

// ── DIY Savoy Plascon orders ───────────────────────────────────────────────
// PO range observed in PDF: 59815–67997 (25+ orders)
// TODO: Extract each order number and its line items from the BuildSmart
//       PDF report for Contract 6254 - Ellipse Ph3 (DIY Savoy Plascon section).
const diySavoyPlasconOrders: OrderEntry[] = [
  // Example structure (fill in from PDF):
  // {
  //   reference: "59815",
  //   createdAt: new Date("2025-10-01T08:00:00"),
  //   note: "Imported from BuildSmart PO 59815",
  //   items: [
  //     { sku: "PEM000600-0020", quantity: 10, unitPriceAtOrder: "425.84" },
  //   ],
  // },
];

// ── DIY Savoy Consumables orders ──────────────────────────────────────────
// PO range observed in PDF: 59875–65581 (25+ orders)
// TODO: Extract from BuildSmart PDF (DIY Savoy Consumables section).
const diySavoyConsumablesOrders: OrderEntry[] = [
  // {
  //   reference: "59875",
  //   createdAt: new Date("2025-10-01T08:00:00"),
  //   note: "Imported from BuildSmart PO 59875",
  //   items: [
  //     { sku: "CON-TURPS-5L", quantity: 2, unitPriceAtOrder: "0" },
  //   ],
  // },
];

// ── Marmoran orders ───────────────────────────────────────────────────────
// 4 orders confirmed from BuildSmart PDF (Marmoran section).
// TODO: Fill in exact quantities and dates per order from the PDF.
const marmoranOrders: OrderEntry[] = [
  {
    reference: "61032",
    createdAt: new Date("2025-11-01T08:00:00"),
    note: "Imported from BuildSmart PO 61032",
    items: [
      // TODO: verify quantities from PDF
      { sku: "MAR-RBP-PRIMER", quantity: 1, unitPriceAtOrder: "0" },
      { sku: "MAR-MALI-1MM-32KG", quantity: 5, unitPriceAtOrder: "851.20" },
    ],
  },
  {
    reference: "61843",
    createdAt: new Date("2025-11-15T08:00:00"),
    note: "Imported from BuildSmart PO 61843",
    items: [
      { sku: "MAR-MALI-1MM-32KG", quantity: 5, unitPriceAtOrder: "851.20" },
    ],
  },
  {
    reference: "62716",
    createdAt: new Date("2025-12-01T08:00:00"),
    note: "Imported from BuildSmart PO 62716",
    items: [
      { sku: "MAR-MALI-1MM-32KG", quantity: 5, unitPriceAtOrder: "851.20" },
      { sku: "MAR-PERMASUEDE", quantity: 2, unitPriceAtOrder: "0" },
    ],
  },
  {
    reference: "63118",
    createdAt: new Date("2025-12-15T08:00:00"),
    note: "Imported from BuildSmart PO 63118",
    items: [
      { sku: "MAR-MALI-1MM-32KG", quantity: 5, unitPriceAtOrder: "851.20" },
    ],
  },
];

// ── Soudal SMX35 orders ───────────────────────────────────────────────────
// 9 orders in range 61423–63611 (Soudal section in PDF).
// TODO: Extract each order number and quantities from BuildSmart PDF.
const soudalOrders: OrderEntry[] = [
  // {
  //   reference: "61423",
  //   createdAt: new Date("2025-11-05T08:00:00"),
  //   note: "Imported from BuildSmart PO 61423",
  //   items: [
  //     { sku: "124604", quantity: 25, unitPriceAtOrder: "82.90" },
  //   ],
  // },
];

// ── Urochem backing cord orders ───────────────────────────────────────────
// 4 orders in range 59936–62176 (Urochem section in PDF).
// TODO: Extract from BuildSmart PDF.
const urochemOrders: OrderEntry[] = [
  // {
  //   reference: "59936",
  //   createdAt: new Date("2025-10-05T08:00:00"),
  //   note: "Imported from BuildSmart PO 59936",
  //   items: [
  //     { sku: "URO-BACKING-CORD-10MM", quantity: 2, unitPriceAtOrder: "0" },
  //   ],
  // },
];

async function seedOrders(
  orders: OrderEntry[],
  supplierId: string,
  siteId: string,
  supplierLabel: string,
) {
  let created = 0;
  let skipped = 0;

  for (const order of orders) {
    const existing = await prisma.siteProductOrder.findFirst({
      where: { reference: order.reference },
      select: { id: true },
    });

    if (existing) {
      console.log(`Order ${order.reference}: already exists, skipping`);
      skipped++;
      continue;
    }

    const created_order = await prisma.siteProductOrder.create({
      data: {
        siteId,
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
          `Order ${order.reference}: product SKU ${item.sku} not found — skipping item`,
        );
        continue;
      }

      await prisma.siteProductOrderItem.create({
        data: {
          orderId: created_order.id,
          productId: product.id,
          quantity: item.quantity,
          unitPriceAtOrder: item.unitPriceAtOrder,
          note: item.note,
          createdAt: order.createdAt,
        },
      });
    }

    console.log(`${supplierLabel} order ${order.reference}: created`);
    created++;
  }

  console.log(
    `${supplierLabel} — created: ${created}, skipped: ${skipped}`,
  );
}

async function main() {
  // Ensure site exists
  const site = await prisma.site.findFirst({
    where: { code: SITE_CODE },
    select: { id: true, name: true },
  });
  if (!site) {
    throw new Error(`Site with code ${SITE_CODE} not found. Aborting.`);
  }
  console.log(`Site: ${site.name} (${SITE_CODE})`);

  const supplierIds = await ensureSuppliers();
  await fixAndEnsureProducts(supplierIds);

  await seedOrders(
    diySavoyPlasconOrders,
    DIY_SAVOY_PLASCON_ID,
    site.id,
    "DIY Savoy Plascon",
  );
  await seedOrders(
    diySavoyConsumablesOrders,
    DIY_SAVOY_CONSUMABLES_ID,
    site.id,
    "DIY Savoy Consumables",
  );
  await seedOrders(
    marmoranOrders,
    supplierIds.marmoranId,
    site.id,
    "Marmoran",
  );
  await seedOrders(
    soudalOrders,
    supplierIds.soudalId,
    site.id,
    "Soudal",
  );
  await seedOrders(
    urochemOrders,
    supplierIds.urochemId,
    site.id,
    "Urochem",
  );

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
