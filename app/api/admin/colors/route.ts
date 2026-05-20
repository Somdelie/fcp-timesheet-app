import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/colors
 * Returns unique colors (deduplicated) with product count for each.
 * Only for ADMIN or OFFICE roles.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    !["ADMIN", "OFFICE"].includes(session.user.role || "")
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const colors = await prisma.productColorVariant.groupBy({
      by: ["colorName", "baseType", "isTinted", "colorCode"],
      _count: {
        id: true,
        productId: true,
      },
      orderBy: [{ colorName: "asc" }, { baseType: "asc" }],
    });

    const result = colors.map((c) => ({
      colorName: c.colorName,
      baseType: c.baseType,
      isTinted: c.isTinted,
      colorCode: c.colorCode,
      productCount: c._count.productId,
      variantCount: c._count.id,
    }));

    return Response.json(result);
  } catch (error) {
    console.error("Failed to fetch colors:", error);
    return Response.json({ error: "Failed to fetch colors" }, { status: 500 });
  }
}
