#!/usr/bin/env node
import { prisma } from "../lib/prisma";

function parseJobNumber(code: unknown): number | null {
  const str = String(code ?? "").trim();
  if (!str) return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const sites = await prisma.site.findMany({
    where: {
      code: { not: null },
    },
    select: {
      id: true,
      name: true,
      code: true,
      attendanceScans: {
        select: { dayRateAtScan: true },
      },
      siteProductOrders: {
        select: {
          items: {
            select: {
              quantity: true,
              unitPriceAtOrder: true,
            },
          },
        },
      },
    },
  });

  const candidates = sites
    .map((site) => {
      const jobNumber = parseJobNumber(site.code);
      const totalWages = (site.attendanceScans ?? []).reduce(
        (sum, scan) => sum + (Number(scan.dayRateAtScan) || 0),
        0,
      );
      const totalOrderCost = (site.siteProductOrders ?? []).reduce(
        (sum, order) =>
          sum +
          (order.items ?? []).reduce(
            (itemSum, item) =>
              itemSum +
              (Number(item.unitPriceAtOrder) || 0) *
                (Number(item.quantity) || 0),
            0,
          ),
        0,
      );
      return {
        ...site,
        jobNumber,
        totalWages,
        totalOrderCost,
        totalCost: totalWages + totalOrderCost,
      };
    })
    .filter(
      (site) =>
        site.jobNumber !== null &&
        site.jobNumber < 6000 &&
        site.totalCost === 0,
    );

  if (!candidates.length) {
    console.log(
      "No low-numbered jobs (<6000) with zero wages and zero order cost found.",
    );
    return;
  }

  console.log(
    `${dryRun ? "DRY RUN: " : "Deleting:"} ${candidates.length} site(s)`,
  );
  for (const site of candidates) {
    console.log(
      `- ${site.name ?? "<Unnamed>"} (id=${site.id}, code=${site.code})`,
    );
  }

  if (dryRun) {
    console.log("DRY RUN complete. No sites were deleted.");
    return;
  }

  for (const site of candidates) {
    await prisma.site.delete({ where: { id: site.id } });
  }

  console.log(`Deleted ${candidates.length} site(s).`);
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
