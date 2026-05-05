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
  });

  const toDto = (p: (typeof rows)[number]): AdminProductDto => ({
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
  });

  const ppeProducts = rows.filter((p) => p.category === "PPE").map(toDto);
  const toolProducts = rows.filter((p) => p.category === "TOOL").map(toDto);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <h1 className="text-xl font-semibold">PPE & Tools Catalogue</h1>
      <CreateProductDialog />
      <ProductsList ppeProducts={ppeProducts} toolProducts={toolProducts} />
    </div>
  );
}
