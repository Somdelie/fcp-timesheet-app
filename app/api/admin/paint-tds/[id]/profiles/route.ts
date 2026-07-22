import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/paint-tds/require-admin";

const schema = z.object({
  name: z.string().min(1),
  applicationMethod: z.string().nullable().optional(),
  applicationMethods: z.array(z.string()).optional(),
  rateMode: z
    .enum(["COVERAGE", "CONSUMPTION", "CONTAINER_COVERAGE"])
    .nullable()
    .optional(),
  rateUnit: z
    .enum([
      "M2_PER_L",
      "M2_PER_KG",
      "L_PER_M2",
      "KG_PER_M2",
      "M2_PER_CONTAINER",
    ])
    .nullable(),
  rateMin: z.number().positive().nullable(),
  rateMax: z.number().positive().nullable(),
  coverageM2PerLitre: z.number().positive().nullable(),
  coverageBasis: z.enum(["PER_COAT", "TOTAL_SYSTEM"]).nullable(),
  coverageType: z.enum(["THEORETICAL", "PRACTICAL"]).nullable(),
  recommendedCoats: z.number().int().positive().nullable(),
  recommendedCoatsMin: z.number().int().positive().nullable().optional(),
  recommendedCoatsMax: z.number().int().positive().nullable().optional(),
  recommendedDftMicrons: z.number().positive().nullable(),
  recommendedWftMicrons: z.number().positive().nullable(),
  thicknessMin: z.number().positive().nullable().optional(),
  thicknessMax: z.number().positive().nullable().optional(),
  thicknessUnit: z.enum(["MICRON", "MM"]).nullable().optional(),
  manufacturerRateLabel: z.string().nullable().optional(),
  sourceSnippet: z.string().nullable().optional(),
  sourcePage: z.number().int().positive().nullable(),
  note: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable(),
  isSelected: z.boolean().default(true),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;
  const input = schema.parse(await request.json());

  const importRow = await prisma.paintTdsImport.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!importRow) {
    return NextResponse.json(
      { error: "Import not found." },
      { status: 404 },
    );
  }

  const profile = await prisma.paintTdsImportProfile.create({
    data: {
      importId: id,
      ...input,
    },
  });

  return NextResponse.json(profile, { status: 201 });
}
