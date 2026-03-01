import ProductsList, {
  type AdminProductDto,
} from "@/components/products/ProductsList";
import { CreateProductDialog } from "@/components/products/CreateProductDialog";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const revalidate = 0;

export default async function ProductsPage() {
  await requireAuth({ roles: ["ADMIN"] });

  const rows = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      price: true,
      isActive: true,
    },
  });

  const initialProducts: AdminProductDto[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: (p.price as any).toString?.() ?? String(p.price ?? "0"),
    isActive: p.isActive,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <h1 className="text-xl font-semibold">Products</h1>
      {/* Dialog is controlled via custom events from ProductsList */}
      <CreateProductDialog />
      <ProductsList initialProducts={initialProducts} />
    </div>
  );
}
