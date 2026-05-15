/**
 * Backfill supplierId on procurement products and site orders created by the
 * BuildSmart historical cost report importer (which omitted suppliers).
 *
 * Usage:
 *   npx tsx scripts/backfill-buildsmart-product-suppliers.ts
 *   npx tsx scripts/backfill-buildsmart-product-suppliers.ts --dry-run
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { normalizeSkuKey } from "../lib/procurement/buildsmartProductCodes";
import {
  inferSupplierNameFromDescription,
  pickSupplierNameForBrand,
  inferBrandHintFromDescription,
} from "../lib/procurement/inferSupplierFromDescription";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const BUILDSMART_HISTORICAL_NOTE = "Seeded from BuildSmart historical cost report";
const dryRun = process.argv.includes("--dry-run");

type LookupContext = {
  nameToId: Map<string, string>;
  supplierNames: string[];
  poRefToSupplier: Map<string, { id: string; name: string }>;
  skuToSupplier: Map<string, { id: string; name: string }>;
  productNameToSupplier: Map<string, { id: string; name: string }>;
};

async function buildLookupContext(): Promise<LookupContext> {
  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const nameToId = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));
  const supplierNames = suppliers.map((s) => s.name);

  const ordersWithSupplier = await prisma.siteProductOrder.findMany({
    where: { reference: { not: null }, supplierId: { not: null } },
    select: {
      reference: true,
      supplier: { select: { id: true, name: true } },
    },
  });
  const poRefToSupplier = new Map<string, { id: string; name: string }>();
  for (const o of ordersWithSupplier) {
    if (!o.reference || !o.supplier) continue;
    poRefToSupplier.set(o.reference.trim(), o.supplier);
  }

  const productsWithSupplier = await prisma.procurementProduct.findMany({
    where: { sku: { not: null }, supplierId: { not: null } },
    select: {
      sku: true,
      supplierId: true,
      supplier: { select: { id: true, name: true } },
    },
  });
  const skuToSupplier = new Map<string, { id: string; name: string }>();
  for (const p of productsWithSupplier) {
    if (!p.sku || !p.supplier) continue;
    const key = normalizeSkuKey(p.sku);
    if (key && !skuToSupplier.has(key)) {
      skuToSupplier.set(key, p.supplier);
    }
  }

  const catalogWithSupplier = await prisma.procurementProduct.findMany({
    where: { supplierId: { not: null } },
    select: {
      name: true,
      supplier: { select: { id: true, name: true } },
    },
  });
  const productNameToSupplier = new Map<string, { id: string; name: string }>();
  for (const p of catalogWithSupplier) {
    if (!p.supplier) continue;
    const key = p.name.trim().toLowerCase();
    if (!productNameToSupplier.has(key)) {
      productNameToSupplier.set(key, p.supplier);
    }
  }

  return { nameToId, supplierNames, poRefToSupplier, skuToSupplier, productNameToSupplier };
}

function resolveWithContext(
  ctx: LookupContext,
  input: { description: string; sku?: string | null; orderReference?: string | null },
): { supplierId: string; supplierName: string; source: string } | null {
  const nameKey = input.description.trim().toLowerCase();
  const fromCatalog = ctx.productNameToSupplier.get(nameKey);
  if (fromCatalog) {
    return {
      supplierId: fromCatalog.id,
      supplierName: fromCatalog.name,
      source: "catalog_name",
    };
  }

  if (input.orderReference) {
    const fromPo = ctx.poRefToSupplier.get(input.orderReference.trim());
    if (fromPo) {
      return {
        supplierId: fromPo.id,
        supplierName: fromPo.name,
        source: "po_reference",
      };
    }
  }

  if (input.sku) {
    const key = normalizeSkuKey(input.sku);
    if (key) {
      const fromSku = ctx.skuToSupplier.get(key);
      if (fromSku) {
        return {
          supplierId: fromSku.id,
          supplierName: fromSku.name,
          source: "sibling_sku",
        };
      }
    }
  }

  const inferredName = inferSupplierNameFromDescription(
    input.description,
    ctx.supplierNames,
    input.sku,
  );
  if (inferredName) {
    const id = ctx.nameToId.get(inferredName.toLowerCase());
    if (id) {
      return {
        supplierId: id,
        supplierName: inferredName,
        source: "description_inference",
      };
    }
  }

  const brandHint = inferBrandHintFromDescription(input.description);
  if (brandHint) {
    const name = pickSupplierNameForBrand(brandHint, ctx.supplierNames);
    if (name) {
      const id = ctx.nameToId.get(name.toLowerCase());
      if (id) {
        return {
          supplierId: id,
          supplierName: name,
          source: "description_inference",
        };
      }
    }
  }

  return null;
}

type Stats = {
  productsChecked: number;
  productsUpdated: number;
  ordersChecked: number;
  ordersUpdated: number;
  unresolvedProducts: number;
};

async function backfillProducts(stats: Stats, ctx: LookupContext) {
  const products = await prisma.procurementProduct.findMany({
    where: {
      supplierId: null,
      OR: [
        {
          orderItems: {
            some: {
              order: { note: { contains: BUILDSMART_HISTORICAL_NOTE } },
            },
          },
        },
        { description: { contains: "BuildSmart import (PO" } },
        {
          orderItems: {
            some: {
              order: { note: { contains: "Imported from BuildSmart PO" } },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      orderItems: {
        select: { order: { select: { reference: true, note: true } } },
        take: 3,
      },
    },
  });

  stats.productsChecked = products.length;

  for (const product of products) {
    const orderReference =
      product.orderItems.find((i) => i.order.reference)?.order.reference ?? null;

    const resolution = resolveWithContext(ctx, {
      description: product.name,
      sku: product.sku,
      orderReference,
    });

    if (!resolution) {
      stats.unresolvedProducts++;
      console.log(`  [skip] ${product.name} — could not infer supplier`);
      continue;
    }

    if (stats.productsUpdated < 15 || stats.unresolvedProducts < 5) {
      console.log(
        `  [${dryRun ? "dry" : "set"}] ${product.name} → ${resolution.supplierName} (${resolution.source})`,
      );
    }

    if (!dryRun) {
      await prisma.procurementProduct.update({
        where: { id: product.id },
        data: { supplierId: resolution.supplierId },
      });
      // Keep SKU map warm for subsequent rows in this run
      if (product.sku && resolution.supplierName) {
        const key = normalizeSkuKey(product.sku);
        if (key) {
          ctx.skuToSupplier.set(key, {
            id: resolution.supplierId,
            name: resolution.supplierName,
          });
        }
      }
    }
    stats.productsUpdated++;
  }
}

async function backfillOrders(stats: Stats, ctx: LookupContext) {
  const orders = await prisma.siteProductOrder.findMany({
    where: {
      supplierId: null,
      OR: [
        { note: { contains: BUILDSMART_HISTORICAL_NOTE } },
        { note: { contains: "Imported from BuildSmart PO" } },
      ],
    },
    select: {
      id: true,
      reference: true,
      items: {
        select: {
          product: { select: { supplierId: true, supplier: { select: { name: true } } } },
        },
      },
    },
  });

  stats.ordersChecked = orders.length;

  for (const order of orders) {
    // Prefer supplier from PO reference (PDF import sibling)
    let supplierId: string | null = null;
    let supplierName: string | null = null;

    if (order.reference) {
      const fromPo = ctx.poRefToSupplier.get(order.reference.trim());
      if (fromPo) {
        supplierId = fromPo.id;
        supplierName = fromPo.name;
      }
    }

    if (!supplierId) {
      const counts = new Map<string, { id: string; name: string; n: number }>();
      for (const item of order.items) {
        const sid = item.product.supplierId;
        const sname = item.product.supplier?.name;
        if (!sid || !sname) continue;
        const cur = counts.get(sid);
        if (cur) cur.n++;
        else counts.set(sid, { id: sid, name: sname, n: 1 });
      }
      const winner = [...counts.values()].sort((a, b) => b.n - a.n)[0];
      if (winner) {
        supplierId = winner.id;
        supplierName = winner.name;
      }
    }

    if (!supplierId) continue;

    console.log(
      `  [${dryRun ? "dry" : "set"}] order ${order.reference ?? order.id} → ${supplierName}`,
    );

    if (!dryRun) {
      await prisma.siteProductOrder.update({
        where: { id: order.id },
        data: { supplierId },
      });
    }
    stats.ordersUpdated++;
  }
}

async function main() {
  console.log(
    dryRun
      ? "=== DRY RUN: BuildSmart supplier backfill ==="
      : "=== BuildSmart supplier backfill ===",
  );

  const stats: Stats = {
    productsChecked: 0,
    productsUpdated: 0,
    ordersChecked: 0,
    ordersUpdated: 0,
    unresolvedProducts: 0,
  };

  console.log("Loading lookup tables…");
  const ctx = await buildLookupContext();
  console.log(
    `  ${ctx.supplierNames.length} suppliers, ${ctx.poRefToSupplier.size} PO refs, ${ctx.skuToSupplier.size} SKUs`,
  );

  console.log("\nProducts…");
  await backfillProducts(stats, ctx);

  console.log("\nOrders…");
  await backfillOrders(stats, ctx);

  console.log("\nSummary:");
  console.log(`  Products checked:   ${stats.productsChecked}`);
  console.log(`  Products updated:   ${stats.productsUpdated}`);
  console.log(`  Unresolved:         ${stats.unresolvedProducts}`);
  console.log(`  Orders checked:     ${stats.ordersChecked}`);
  console.log(`  Orders updated:     ${stats.ordersUpdated}`);

  if (dryRun) {
    console.log("\nRe-run without --dry-run to apply changes.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
