import OrdersPageClient from "@/components/orders/OrdersPageClient";
import type { AdminForemanDto } from "@/components/orders/OrdersPOS";
import type { AdminProductDto } from "@/components/products/ProductsList";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const revalidate = 0;

export default async function OrdersPage() {
  await requireAuth({ roles: ["ADMIN"] });

  const [foremanRows, adminRows, productRows] = await Promise.all([
    prisma.foreman.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "OFFICE"] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        description: true,
        price: true,
        isActive: true,
        category: true,
        sizes: true,
        colors: true,
        stockQty: true,
        thumbnailUrl: true,
        variants: {
          select: { id: true, size: true, color: true, qty: true },
        },
      },
    }),
  ]);

  const foremen: AdminForemanDto[] = [
    ...foremanRows.map((f) => ({
      id: f.id,
      userId: f.userId,
      name: f.user?.name ?? "",
      email: f.user?.email ?? "",
      type: "foreman" as const,
    })),
    ...adminRows.map((u) => ({
      id: u.id,
      userId: u.id,
      name: u.name ?? "",
      email: u.email ?? "",
      type: "admin" as const,
    })),
  ];

  const products: AdminProductDto[] = productRows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku ?? null,
    description: p.description ?? null,
    price: (p.price as any).toString?.() ?? String(p.price ?? "0"),
    isActive: p.isActive,
    category: p.category as "PPE" | "TOOL",
    sizes: p.sizes ?? [],
    colors: p.colors ?? [],
    stockQty: p.stockQty ?? 0,
    thumbnailUrl: p.thumbnailUrl ?? null,
    variants: p.variants ?? [],
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <OrdersPageClient foremen={foremen} products={products} />
    </div>
  );
}
