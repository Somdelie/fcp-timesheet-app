import OrdersPageClient from "@/components/orders/OrdersPageClient";
import type { AdminForemanDto } from "@/components/orders/OrdersPOS";
import type { AdminProductDto } from "@/components/products/ProductsList";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const revalidate = 0;

export default async function OrdersPage() {
  await requireAuth({ roles: ["ADMIN"] });

  const [foremanRows, productRows] = await Promise.all([
    prisma.foreman.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        isActive: true,
      },
    }),
  ]);

  const foremen: AdminForemanDto[] = foremanRows.map((f) => ({
    id: f.id,
    userId: f.userId,
    name: f.user?.name ?? "",
    email: f.user?.email ?? "",
  }));

  const products: AdminProductDto[] = productRows.map((p) => ({
    id: p.id,
    name: p.name,
    price: (p.price as any).toString?.() ?? String(p.price ?? "0"),
    isActive: p.isActive,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <OrdersPageClient foremen={foremen} products={products} />
    </div>
  );
}
