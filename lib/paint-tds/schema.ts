import { z } from "zod";

export const parsedPaintTdsSchema = z.object({
  product: z.object({
    manufacturer: z.string().nullable(),
    name: z.string().min(1),
    productCode: z.string().nullable(),
    description: z.string().nullable(),
    packSizesLitres: z.array(z.number().positive()),
    packSizes: z.array(
      z.object({
        quantity: z.number().positive(),
        uom: z.enum(["L", "KG"]),
        label: z.string().min(1),
      }),
    ),
  }),
  source: z.object({
    revision: z.string().nullable(),
    revisionDate: z.string().nullable(),
  }),
  coverageProfiles: z.array(
    z.object({
      name: z.string().min(1),
      applicationMethod: z.string().nullable(),
      applicationMethods: z.array(z.string()),
      rateMode: z
        .enum(["COVERAGE", "CONSUMPTION", "CONTAINER_COVERAGE"])
        .nullable(),
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
      recommendedCoatsMin: z.number().int().positive().nullable(),
      recommendedCoatsMax: z.number().int().positive().nullable(),
      recommendedDftMicrons: z.number().positive().nullable(),
      recommendedWftMicrons: z.number().positive().nullable(),
      containerSizeLitres: z.number().positive().nullable(),
      thicknessMin: z.number().positive().nullable(),
      thicknessMax: z.number().positive().nullable(),
      thicknessUnit: z.enum(["MICRON", "MM"]).nullable(),
      manufacturerRateLabel: z.string().nullable(),
      sourceSnippet: z.string().nullable(),
      sourcePage: z.number().int().positive().nullable(),
      note: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  warnings: z.array(z.string()),
});

// Compatibility alias for older imports.
export const paintTdsSchema = parsedPaintTdsSchema;

export type ParsedPaintTds = z.infer<typeof parsedPaintTdsSchema>;
