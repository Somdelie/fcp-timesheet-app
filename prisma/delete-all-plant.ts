import { prisma } from "@/lib/prisma";

const CONFIRMATION_FLAG = "--confirm-delete-all-jhb-ppe";

async function main() {
  const confirmed = process.argv.includes(CONFIRMATION_FLAG);

  const ppeProducts = await prisma.product.findMany({
    where: { category: "PPE" },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      stockQty: true,
      _count: {
        select: {
          variants: true,
          orderItems: true,
          receiptItems: true,
          deductions: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  if (ppeProducts.length === 0) {
    console.log("No JHB PPE products were found. Nothing was deleted.");
    return;
  }

  const productIds = ppeProducts.map((product) => product.id);
  const totalStock = ppeProducts.reduce(
    (sum, product) => sum + product.stockQty,
    0,
  );
  const totalVariants = ppeProducts.reduce(
    (sum, product) => sum + product._count.variants,
    0,
  );
  const totalOrderItems = ppeProducts.reduce(
    (sum, product) => sum + product._count.orderItems,
    0,
  );
  const totalReceiptItems = ppeProducts.reduce(
    (sum, product) => sum + product._count.receiptItems,
    0,
  );
  const totalDeductions = ppeProducts.reduce(
    (sum, product) => sum + product._count.deductions,
    0,
  );

  console.log("JHB PPE reset preview:");
  console.log(`PPE products: ${ppeProducts.length}`);
  console.log(`Recorded stock quantity: ${totalStock}`);
  console.log(`Stock variants: ${totalVariants}`);
  console.log(`Product-order items: ${totalOrderItems}`);
  console.log(`Stock-receipt items: ${totalReceiptItems}`);
  console.log(`Linked deductions to preserve: ${totalDeductions}`);
  console.log("\nPPE products:");

  for (const product of ppeProducts) {
    const sku = product.sku ? ` (${product.sku})` : "";
    console.log(
      `- ${product.name}${sku} | Stock: ${product.stockQty} | Price: ${product.price.toString()} | Variants: ${product._count.variants}`,
    );
  }

  if (!confirmed) {
    console.log("\nPREVIEW ONLY — no data was deleted.");
    console.log("To permanently delete all JHB PPE catalogue data, run:");
    console.log(`pnpm tsx prisma/delete-all-jhb-ppe.ts ${CONFIRMATION_FLAG}`);
    return;
  }

  const deleted = await prisma.$transaction(
    async (tx) => {
      const linkedOrderItems = await tx.productOrderItem.findMany({
        where: { productId: { in: productIds } },
        select: { id: true },
      });
      const orderItemIds = linkedOrderItems.map((item) => item.id);

      // Keep deduction history but detach it from catalogue rows being reset.
      const detachedDeductions = await tx.deduction.updateMany({
        where: {
          OR: [
            { productId: { in: productIds } },
            ...(orderItemIds.length
              ? [{ orderItemId: { in: orderItemIds } }]
              : []),
          ],
        },
        data: {
          productId: null,
          orderItemId: null,
        },
      });

      const orderItems = await tx.productOrderItem.deleteMany({
        where: { productId: { in: productIds } },
      });

      const receiptItems = await tx.stockReceiptItem.deleteMany({
        where: { productId: { in: productIds } },
      });

      // StockItemVariant rows cascade when their Product is deleted.
      const products = await tx.product.deleteMany({
        where: {
          id: { in: productIds },
          category: "PPE",
        },
      });

      if (products.count !== ppeProducts.length) {
        throw new Error(
          `Expected to delete ${ppeProducts.length} PPE products, but deleted ${products.count}.`,
        );
      }

      return {
        products: products.count,
        orderItems: orderItems.count,
        receiptItems: receiptItems.count,
        deductionsPreserved: detachedDeductions.count,
      };
    },
    {
      maxWait: 20_000,
      timeout: 120_000,
    },
  );

  console.log("\nJHB PPE catalogue reset completed successfully.");
  console.log(`PPE products deleted: ${deleted.products}`);
  console.log(`Product-order items deleted: ${deleted.orderItems}`);
  console.log(`Stock-receipt items deleted: ${deleted.receiptItems}`);
  console.log(`Deduction records preserved: ${deleted.deductionsPreserved}`);
  console.log("Cape Town PPE stock was not changed.");
  console.log("You can now add the JHB PPE catalogue back manually.");
}

main()
  .catch((error) => {
    console.error("Delete-all-JHB-PPE script failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
