import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/paint-tds/require-admin";
import { serialiseTdsImport } from "@/lib/paint-tds/serialise";

const updateSchema = z.object({
  supplierId: z.string().trim().min(1).nullable().optional(),

  manufacturer: z.string().trim().nullable().optional(),
  productCode: z.string().trim().nullable().optional(),
  productName: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  revision: z.string().trim().nullable().optional(),

  revisionDate: z
    .union([z.string(), z.null()])
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value === null ||
        value === "" ||
        !Number.isNaN(new Date(value).getTime()),
      {
        message: "Revision date is invalid.",
      },
    ),

  packSizesLitres: z.array(z.number().positive()).optional(),
  packSizes: z
    .array(
      z.object({
        quantity: z.number().positive(),
        uom: z.enum(["L", "KG"]),
        label: z.string().min(1),
      }),
    )
    .optional(),
  warnings: z.array(z.string()).optional(),
});

async function getActiveSuppliers() {
  return prisma.supplier.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      supplierType: true,
      parentSupplierId: true,
    },
    orderBy: [{ supplierType: "asc" }, { name: "asc" }],
  });
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();

  const { id } = await params;

  const [row, suppliers] = await Promise.all([
    prisma.paintTdsImport.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            supplierType: true,
          },
        },
        profiles: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    }),
    getActiveSuppliers(),
  ]);

  if (!row) {
    return NextResponse.json(
      {
        error: "Import not found.",
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json({
    ...serialiseTdsImport(row),
    supplierId: row.supplierId,
    supplier: row.supplier,
    suppliers,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();

  const { id } = await params;

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid Paint TDS details.",
        issues: parsed.error.flatten(),
      },
      {
        status: 400,
      },
    );
  }

  const input = parsed.data;

  const existingImport = await prisma.paintTdsImport.findUnique({
    where: { id },
    select: {
      id: true,
    },
  });

  if (!existingImport) {
    return NextResponse.json(
      {
        error: "Import not found.",
      },
      {
        status: 404,
      },
    );
  }

  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: input.supplierId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!supplier) {
      return NextResponse.json(
        {
          error: "The selected supplier does not exist or is inactive.",
        },
        {
          status: 400,
        },
      );
    }
  }

  const revisionDateDetected =
    input.revisionDate === undefined
      ? undefined
      : input.revisionDate === null || input.revisionDate === ""
        ? null
        : new Date(input.revisionDate);

  const row = await prisma.paintTdsImport.update({
    where: { id },
    data: {
      supplierId: input.supplierId,

      manufacturerDetected: input.manufacturer,
      productCodeDetected: input.productCode,
      productNameDetected: input.productName,
      descriptionDetected: input.description,
      revisionDetected: input.revision,
      revisionDateDetected,

      packSizesLitres: input.packSizesLitres,
      packSizes: input.packSizes,
      warnings: input.warnings,
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          supplierType: true,
        },
      },
      profiles: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  const suppliers = await getActiveSuppliers();

  return NextResponse.json({
    ...serialiseTdsImport(row),
    supplierId: row.supplierId,
    supplier: row.supplier,
    suppliers,
  });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();

  const { id } = await params;

  const existingImport = await prisma.paintTdsImport.findUnique({
    where: { id },
    select: {
      id: true,
    },
  });

  if (!existingImport) {
    return NextResponse.json(
      {
        error: "Import not found.",
      },
      {
        status: 404,
      },
    );
  }

  await prisma.paintTdsImport.delete({
    where: { id },
  });

  return NextResponse.json({
    success: true,
  });
}
