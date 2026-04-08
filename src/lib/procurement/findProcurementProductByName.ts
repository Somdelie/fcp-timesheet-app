import { prisma } from "@/lib/prisma";

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function findProcurementProductByName(
  name: string,
  supplierId?: string | null,
) {
  const normalizedName = normalize(name);

  const candidates = await prisma.procurementProduct.findMany({
    where: {
      isActive: true,
      ...(supplierId ? { supplierId } : {}),
    },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      supplierId: true,
    },
  });

  const exact = candidates.find(
    (p) => (p.normalizedName ?? normalize(p.name)) === normalizedName,
  );

  return exact ?? null;
}
