import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPlantAvailability } from "@/lib/procurement/plantAvailability";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supervisors = await prisma.user.findMany({
    where: {
      role: "SUPERVISOR",
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });

  const products = await prisma.procurementProduct.findMany({
    where: {
      productType: "PLANT",
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      sku: true,
      thumbnailUrl: true,
      sizes: true,
      colors: true,
    },
  });

  const availabilityByProduct = await getPlantAvailability(
    products.map((p) => p.id),
  );

  const items = products.map((p) => ({
    ...p,
    variants: availabilityByProduct.get(p.id) ?? [],
  }));

  const sites = await prisma.site.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  return NextResponse.json({
    supervisors,
    items,
    sites,
  });
}
