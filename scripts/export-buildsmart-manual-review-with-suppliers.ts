import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

import { prisma } from "../lib/prisma";

type ManualReviewRow = {
  orderId: string;
  orderReference: string | null;
  itemId: string;
  rawName: string;
  currentProductId: string;
  currentProductName: string;
  currentPrice: string;
  mode: string;
  reason: string;
};

type RepairReport = {
  manualReview?: ManualReviewRow[];
};

function csv(value: unknown): string {
  const text = String(value ?? "");
  const escaped = text.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

async function main() {
  const reportPath = path.resolve(
    process.cwd(),
    "scripts",
    "buildsmart-order-repair-report.json",
  );

  if (!fs.existsSync(reportPath)) {
    throw new Error(`Report not found: ${reportPath}`);
  }

  const report = JSON.parse(
    fs.readFileSync(reportPath, "utf8"),
  ) as RepairReport;
  const rows = report.manualReview ?? [];

  const productIds = [...new Set(rows.map((r) => r.currentProductId))];
  const orderIds = [...new Set(rows.map((r) => r.orderId))];

  const [products, orders] = await Promise.all([
    prisma.procurementProduct.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        supplier: { select: { id: true, name: true } },
      },
    }),
    prisma.siteProductOrder.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        supplier: { select: { id: true, name: true } },
      },
    }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const outputPath = path.resolve(
    process.cwd(),
    "scripts",
    "buildsmart-manual-review-with-suppliers.csv",
  );

  const headers = [
    "orderId",
    "orderReference",
    "orderSupplierId",
    "orderSupplierName",
    "itemId",
    "rawName",
    "currentProductId",
    "currentProductName",
    "currentProductSupplierId",
    "currentProductSupplierName",
    "currentPrice",
    "mode",
    "reason",
  ];

  const lines = [headers.join(",")];

  for (const row of rows) {
    const product = productMap.get(row.currentProductId);
    const order = orderMap.get(row.orderId);

    const out = [
      row.orderId,
      row.orderReference ?? "",
      order?.supplier?.id ?? "",
      order?.supplier?.name ?? "",
      row.itemId,
      row.rawName,
      row.currentProductId,
      row.currentProductName,
      product?.supplier?.id ?? "",
      product?.supplier?.name ?? "",
      row.currentPrice,
      row.mode,
      row.reason,
    ];

    lines.push(out.map(csv).join(","));
  }

  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Rows exported: ${rows.length}`);
  console.log(`CSV: ${outputPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
