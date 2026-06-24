import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type Db = typeof prisma | Prisma.TransactionClient;

const EXCLUDED_FINISH_TERMS = [
  "primer",
  "priming",
  "undercoat",
  "under coat",
  "bonding liquid",
  "plaster primer",
  "preparation",
  "prep",
];

const COLOUR_FINISH_TERMS = [
  "colour",
  "color",
  "tint",
  "paint",
  "top coat",
  "topcoat",
  "enamel",
  "acrylic",
  "pva",
  "velvaglo",
  "pearlglo",
  "fresh cote",
  "pem1000",
  "tls",
  "tvw",
  "ral",
  "road marking",
];

function normalizeText(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function isColourFinishProduct(product: {
  name: string;
  sku: string | null;
  colors: string[];
  category: { name: string } | null;
  colorVariants: Array<{ id: string }>;
}) {
  const text = [
    product.name,
    product.sku,
    product.category?.name,
    product.colors.join(" "),
  ]
    .map(normalizeText)
    .join(" ");

  if (EXCLUDED_FINISH_TERMS.some((term) => text.includes(term))) return false;
  if (product.colorVariants.length > 0 || product.colors.length > 0) return true;

  return COLOUR_FINISH_TERMS.some((term) => text.includes(term));
}

export async function ensureInitialFinishingScheduleForColourProduct(
  db: Db,
  input: { siteId: string; productId: string },
) {
  const product = await db.procurementProduct.findUnique({
    where: { id: input.productId },
    select: {
      name: true,
      sku: true,
      colors: true,
      category: { select: { name: true } },
      colorVariants: { select: { id: true }, take: 1 },
    },
  });

  if (!product || !isColourFinishProduct(product)) return false;

  const existing = await db.siteFinishingSchedule.findFirst({
    where: { siteId: input.siteId, isActive: true },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await db.siteFinishingSchedule.update({
      where: { id: existing.id },
      data: { status: "INITIAL" },
    });
    return true;
  }

  const site = await db.site.findUnique({
    where: { id: input.siteId },
    select: { code: true, client: true, address: true },
  });

  await db.siteFinishingSchedule.create({
    data: {
      site: { connect: { id: input.siteId } },
      status: "INITIAL",
      contractNo: site?.code ?? null,
      client: site?.client ?? null,
      siteAddress: site?.address ?? null,
    },
  });

  return true;
}
