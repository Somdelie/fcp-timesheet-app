import "dotenv/config";

import { prisma } from "../lib/prisma";

const BRAND_ID = "cmnog4opm0000ocpvu6yt79mp";

type SeedProduct = {
  name: string;
  aliases: string[];
  defaultPrice?: number | null;
  notes?: string | null;
};

type ExistingProduct = {
  id: string;
  name: string;
  normalizedName: string | null;
  supplierId: string | null;
  isActive: boolean;
  description: string | null;
};

const PRODUCTS: SeedProduct[] = [
  {
    name: "Wood Primer",
    aliases: ["WOOD PRIMER"],
    defaultPrice: 458.48,
  },
  {
    name: "Select Plaster Primer",
    aliases: ["SELECT PLASTER PRIMER"],
    defaultPrice: 1311.44,
  },
  {
    name: "Rust Primer - Red",
    aliases: ["RUST PRIMER - RED"],
    defaultPrice: 1418.04,
  },
  {
    name: "QD Red Oxide",
    aliases: ["QD RED OXIDE"],
    defaultPrice: 1926.97,
  },
  {
    name: "Ultraprime - White",
    aliases: ["ULTRAPRIME - WHITE"],
    defaultPrice: 1595.97,
  },
  {
    name: "Select Matt",
    aliases: ["SELECT MATT WHITE"],
    defaultPrice: 1055.29,
  },
  {
    name: "Matt",
    aliases: ["MATT - WHITE", "TINT FROM WHITE", "MATT - CLEAR TINT BASE"],
    defaultPrice: 1416.69,
    notes: "Canonical family seeded from multiple Prominent Matt variants",
  },
  {
    name: "Select Sheen",
    aliases: [
      "SELECT SHEEN WHITE",
      "SELECT SHEEN WHITE + TINT",
      "SELECT SHEEN CLEAR BASE + TINT",
    ],
    defaultPrice: 1260.95,
    notes: "Canonical family seeded from Select Sheen variants",
  },
  {
    name: "Satin Silk",
    aliases: [
      "SATIN SILK - WHITE",
      "SATIN SILK PASTEL",
      "SATIN SILK PASTEL 20LT",
      "SATIN SILK CLEAR BASE + TINT",
    ],
    defaultPrice: 1521.29,
    notes: "Canonical family seeded from Satin Silk variants",
  },
  {
    name: "Fibre Seal",
    aliases: ["FIBRE SEAL - WHITE"],
    defaultPrice: 1198.11,
  },
  {
    name: "Damp Cure",
    aliases: ["DAMP CURE"],
    defaultPrice: 1675.59,
  },
  {
    name: "Select Universal Undercoat",
    aliases: ["SELECT UNIVERSAL UNDERCOAT"],
    defaultPrice: 401.33,
  },
  {
    name: "Gloss Enamel",
    aliases: [
      "GLOSS ENAMEL - WHITE",
      "GLOSS CLEAR BASE + TINT",
      "GLOSS PASTEL + TINT",
      "GLOSS SIGNAL RED",
      "GLOSS CHROME YELLOW",
      "GLOSS WINDSOR GREEN",
      "GLOSS COSMOS BLUE",
    ],
    defaultPrice: 2218.9,
    notes: "Canonical family seeded from Gloss Enamel variants",
  },
  {
    name: "Non-Drip Enamel",
    aliases: [
      "NON-DRIP ENAMEL - WHITE",
      "NON DRIP WHITE + TINT",
      "NON DRIP CLEAR BASE + TINT",
    ],
    defaultPrice: 746.02,
    notes: "Canonical family seeded from Non-Drip Enamel variants",
  },
  {
    name: "Ultrasheen",
    aliases: ["ULTRASHEEN - WHITE", "ULTRASHEEN CLEAR TINT BASE"],
    defaultPrice: 1994.5,
    notes: "Canonical family seeded from Ultrasheen variants",
  },
  {
    name: "Skimmit Skimcoat Interior 15KG",
    aliases: ["SKIMMIT SKIMCOAT INTERIOR - 15KG"],
    defaultPrice: 371.16,
  },
  {
    name: "Texture",
    aliases: [
      "TEXTURED - WHITE",
      "TEXTURE PASTEL BASE + TINT",
      "TEXTURE CLEAR BASE + TINT",
    ],
    defaultPrice: 999.0,
    notes: "Canonical family seeded from Texture variants",
  },
  {
    name: "Roof & Paving",
    aliases: ["ROOF & PAVING - WHITE"],
    defaultPrice: 1217.65,
  },
  {
    name: "Wood Preservative - Clear",
    aliases: ["WOOD PRESERVATIVE - CLEAR"],
    defaultPrice: 540.29,
  },
  {
    name: "Wood Varnish - Clear",
    aliases: ["WOOD VARNISH - CLEAR"],
    defaultPrice: 540.29,
  },
  {
    name: "2 Pack Polyurethane - White",
    aliases: [
      "2 PACK POLYURETHANE - WHITE",
      "2 PACK POLYURETHANE - WHITE + TINT",
    ],
    defaultPrice: 1274.59,
    notes: "Canonical family seeded from 2 Pack Polyurethane white variants",
  },
  {
    name: "2 Pack Polyurethane - Clear",
    aliases: ["2 PACK POLYURETHANE - CLEAR + TINT"],
    defaultPrice: 1239.76,
  },
  {
    name: "2 Pack Polyurethane - Catalyst",
    aliases: ["2 PACK POLYURETHANE - CATALYST"],
    defaultPrice: 465.88,
  },
  {
    name: "Neuklad",
    aliases: [
      "NEUKLAD - WHITE",
      "NEUKLAD PASTEL + TINT",
      "NEUKLAD CLEAR BASE + TINT",
    ],
    defaultPrice: 1730.36,
    notes: "Canonical family seeded from Neuklad variants",
  },
];

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function uniqueNormalizedKeys(item: SeedProduct): string[] {
  return [...new Set([item.name, ...item.aliases].map(normalize))];
}

function buildDescription(item: SeedProduct): string | undefined {
  if (item.notes?.trim()) return item.notes.trim();
  return undefined;
}

function pickBestExisting(
  item: SeedProduct,
  existingByNormalized: Map<string, ExistingProduct[]>,
) {
  const canonicalKey = normalize(item.name);
  const keys = uniqueNormalizedKeys(item);

  const candidates = keys.flatMap((key) => existingByNormalized.get(key) ?? []);
  if (!candidates.length) return null;

  const ranked = [
    ...new Map(
      candidates.map((candidate) => [candidate.id, candidate]),
    ).values(),
  ].sort((left, right) => {
    const leftScore =
      (left.supplierId === BRAND_ID ? 100 : 0) +
      (normalize(left.name) === canonicalKey ? 10 : 0) +
      (left.isActive ? 1 : 0);
    const rightScore =
      (right.supplierId === BRAND_ID ? 100 : 0) +
      (normalize(right.name) === canonicalKey ? 10 : 0) +
      (right.isActive ? 1 : 0);
    return rightScore - leftScore;
  });

  return ranked[0];
}

async function upsertDefaultPrice(
  productId: string,
  defaultPrice: number,
  dryRun: boolean,
) {
  const existing = await prisma.supplierProductPrice.findFirst({
    where: {
      supplierId: BRAND_ID,
      productId,
      uom: null,
      unitSize: null,
      isActive: true,
      endsOn: null,
    },
    orderBy: [{ startsOn: "desc" }, { createdAt: "desc" }],
  });

  const price = defaultPrice.toFixed(2);

  if (dryRun) {
    return {
      action: existing ? "update" : "create",
      price,
    } as const;
  }

  if (existing) {
    await prisma.supplierProductPrice.update({
      where: { id: existing.id },
      data: {
        price,
        startsOn: new Date(),
        endsOn: null,
        isActive: true,
      },
    });

    return {
      action: "update",
      price,
    } as const;
  }

  await prisma.supplierProductPrice.create({
    data: {
      supplierId: BRAND_ID,
      productId,
      price,
      isActive: true,
      startsOn: new Date(),
      endsOn: null,
    },
  });

  return {
    action: "create",
    price,
  } as const;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const supplier = await prisma.supplier.findUnique({
    where: { id: BRAND_ID },
    select: { id: true, name: true, supplierType: true, isActive: true },
  });

  if (!supplier) {
    throw new Error(`Supplier ${BRAND_ID} was not found.`);
  }

  const lookupNames = [
    ...new Set(PRODUCTS.flatMap((item) => [item.name, ...item.aliases])),
  ];
  const lookupKeys = [...new Set(lookupNames.map(normalize))];

  const existing = await prisma.procurementProduct.findMany({
    where: {
      OR: [
        { supplierId: BRAND_ID },
        {
          supplierId: null,
          OR: [
            { normalizedName: { in: lookupKeys } },
            { name: { in: lookupNames } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      supplierId: true,
      isActive: true,
      description: true,
    },
  });

  const existingByNormalized = new Map<string, ExistingProduct[]>();
  for (const row of existing) {
    const key = normalize(row.normalizedName ?? row.name);
    const bucket = existingByNormalized.get(key) ?? [];
    bucket.push(row);
    existingByNormalized.set(key, bucket);
  }

  console.log(
    `Seeding Prominent products for supplier ${supplier.name} (${supplier.id})`,
  );
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);

  let createdProducts = 0;
  let updatedProducts = 0;
  let createdPrices = 0;
  let updatedPrices = 0;

  for (const item of PRODUCTS) {
    const normalizedName = normalize(item.name);
    const description = buildDescription(item);
    const existingProduct = pickBestExisting(item, existingByNormalized);

    let productId: string;

    if (existingProduct) {
      productId = existingProduct.id;
      const needsUpdate =
        existingProduct.name !== item.name ||
        existingProduct.normalizedName !== normalizedName ||
        existingProduct.supplierId !== BRAND_ID ||
        existingProduct.isActive !== true ||
        (description ?? null) !== existingProduct.description;

      if (needsUpdate) {
        if (!dryRun) {
          await prisma.procurementProduct.update({
            where: { id: existingProduct.id },
            data: {
              name: item.name,
              normalizedName,
              supplierId: BRAND_ID,
              isActive: true,
              description,
            },
          });
        }

        updatedProducts += 1;
        console.log(
          `[${dryRun ? "preview" : "applied"}] UPDATE product ${item.name}`,
        );
      } else {
        console.log(
          `[${dryRun ? "preview" : "applied"}] KEEP product ${item.name}`,
        );
      }
    } else {
      if (dryRun) {
        productId = `dry-run:${normalizedName}`;
      } else {
        const created = await prisma.procurementProduct.create({
          data: {
            name: item.name,
            normalizedName,
            supplierId: BRAND_ID,
            isActive: true,
            description,
          },
        });
        productId = created.id;
      }

      createdProducts += 1;
      console.log(
        `[${dryRun ? "preview" : "applied"}] CREATE product ${item.name}`,
      );
    }

    if (item.defaultPrice != null) {
      const priceResult = await upsertDefaultPrice(
        productId,
        item.defaultPrice,
        dryRun,
      );
      if (priceResult.action === "create") createdPrices += 1;
      if (priceResult.action === "update") updatedPrices += 1;
      console.log(
        `[${dryRun ? "preview" : "applied"}] ${priceResult.action.toUpperCase()} price ${item.name} -> ${priceResult.price}`,
      );
    }
  }

  console.log("\nSummary");
  console.log(`- Products created: ${createdProducts}`);
  console.log(`- Products updated: ${updatedProducts}`);
  console.log(`- Prices created: ${createdPrices}`);
  console.log(`- Prices updated: ${updatedPrices}`);
  console.log(`- Canonical products processed: ${PRODUCTS.length}`);
}

main()
  .catch((error) => {
    console.error("Prominent seed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
