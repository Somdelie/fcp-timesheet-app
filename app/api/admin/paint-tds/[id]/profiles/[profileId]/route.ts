import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/paint-tds/require-admin";

const schema = z.object({
  name: z.string().min(1).optional(),
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
    .nullable()
    .optional(),
  rateMin: z.number().positive().nullable().optional(),
  rateMax: z.number().positive().nullable().optional(),
  coverageM2PerLitre: z.number().positive().nullable().optional(),
  coverageBasis: z.enum(["PER_COAT", "TOTAL_SYSTEM"]).nullable().optional(),
  coverageType: z.enum(["THEORETICAL", "PRACTICAL"]).nullable().optional(),
  recommendedCoats: z.number().int().positive().nullable().optional(),
  recommendedCoatsMin: z.number().int().positive().nullable().optional(),
  recommendedCoatsMax: z.number().int().positive().nullable().optional(),
  recommendedDftMicrons: z.number().positive().nullable().optional(),
  recommendedWftMicrons: z.number().positive().nullable().optional(),
  thicknessMin: z.number().positive().nullable().optional(),
  thicknessMax: z.number().positive().nullable().optional(),
  thicknessUnit: z.enum(["MICRON", "MM"]).nullable().optional(),
  manufacturerRateLabel: z.string().nullable().optional(),
  sourceSnippet: z.string().nullable().optional(),
  sourcePage: z.number().int().positive().nullable().optional(),
  note: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  isSelected: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; profileId: string }>;
  },
) {
  await requireAdmin();
  const { id, profileId } = await params;
  const input = schema.parse(await request.json());

  const existing = await prisma.paintTdsImportProfile.findFirst({
    where: {
      id: profileId,
      importId: id,
    },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Profile not found." },
      { status: 404 },
    );
  }

  const profile = await prisma.paintTdsImportProfile.update({
    where: { id: profileId },
    data: input,
  });

  return NextResponse.json(profile);
}

export async function DELETE(
  _: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; profileId: string }>;
  },
) {
  await requireAdmin();
  const { id, profileId } = await params;

  const result = await prisma.paintTdsImportProfile.deleteMany({
    where: {
      id: profileId,
      importId: id,
    },
  });

  if (!result.count) {
    return NextResponse.json(
      { error: "Profile not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
