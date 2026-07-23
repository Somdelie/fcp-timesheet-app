import { prisma } from "@/lib/prisma";

const RETURN_NOTE = "Bulk return of all plant to office/storage";

async function main() {
  const returnedAt = new Date();

  const result = await prisma.$transaction(
    async (tx) => {
      const activeAssignments = await tx.sitePlantAssignment.findMany({
        where: {
          status: { in: ["DEPLOYED", "REPAIR"] },
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
          size: true,
          status: true,
          reference: true,
          siteId: true,
          site: {
            select: {
              code: true,
              name: true,
            },
          },
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
        },
        orderBy: [
          { site: { code: "asc" } },
          { product: { name: "asc" } },
        ],
      });

      if (activeAssignments.length === 0) {
        return {
          assignments: activeAssignments,
          updatedCount: 0,
          transferCount: 0,
        };
      }

      const transfers = await tx.plantTransfer.createMany({
        data: activeAssignments.map((assignment) => ({
          productId: assignment.productId,
          quantity: assignment.quantity,
          fromSiteId: assignment.siteId,
          toSiteId: null,
          fromAssignmentId: assignment.id,
          toAssignmentId: null,
          transferredOn: returnedAt,
          note: RETURN_NOTE,
        })),
      });

      const updated = await tx.sitePlantAssignment.updateMany({
        where: {
          id: { in: activeAssignments.map((assignment) => assignment.id) },
          status: { in: ["DEPLOYED", "REPAIR"] },
        },
        data: {
          status: "RETURNED",
          returnedOn: returnedAt,
        },
      });

      if (updated.count !== activeAssignments.length) {
        throw new Error(
          `Expected to return ${activeAssignments.length} assignments, but only ${updated.count} were updated.`,
        );
      }

      return {
        assignments: activeAssignments,
        updatedCount: updated.count,
        transferCount: transfers.count,
      };
    },
    {
      maxWait: 20_000,
      timeout: 120_000,
    },
  );

  if (result.updatedCount === 0) {
    console.log("No DEPLOYED or REPAIR plant assignments were found.");
    console.log("All plant is already returned or in another final status.");
    return;
  }

  const totalQuantity = result.assignments.reduce(
    (sum, assignment) => sum + assignment.quantity,
    0,
  );

  console.log("All active plant assignments were returned to the office.");
  console.log(`Assignment rows returned: ${result.updatedCount}`);
  console.log(`Total plant quantity returned: ${totalQuantity}`);
  console.log(`Transfer audit rows created: ${result.transferCount}`);
  console.log(`Returned at: ${returnedAt.toISOString()}`);
  console.log("\nReturned plant list:");

  for (const assignment of result.assignments) {
    const siteLabel = assignment.site.code
      ? `${assignment.site.code} - ${assignment.site.name}`
      : assignment.site.name;
    const productLabel = assignment.product.sku
      ? `${assignment.product.name} (${assignment.product.sku})`
      : assignment.product.name;
    const sizeLabel = assignment.size ? ` | Size: ${assignment.size}` : "";
    const referenceLabel = assignment.reference
      ? ` | Ref: ${assignment.reference}`
      : "";

    console.log(
      `- ${siteLabel} | ${productLabel} | Qty: ${assignment.quantity}${sizeLabel}${referenceLabel}`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Return-all-plant script failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
