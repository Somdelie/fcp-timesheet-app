import type {
  TdsFile,
  TdsImportStatus,
} from "@/types/tds-types";

const statusMap: Record<string, TdsImportStatus> = {
  UPLOADED: "uploaded",
  EXTRACTING: "extracting",
  PARSING: "parsing",
  NEEDS_REVIEW: "needs-review",
  APPROVED: "approved",
  IMPORTED: "imported",
  FAILED: "failed",
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function serialiseTdsImport(row: any): TdsFile {
  return {
    id: row.id,
    fileName: row.fileName,
    fileUrl: row.fileUrl ?? null,
    manufacturer: row.manufacturerDetected ?? null,
    productCode: row.productCodeDetected ?? null,
    productName: row.productNameDetected ?? null,
    description: row.descriptionDetected ?? null,
    revision: row.revisionDetected ?? null,
    revisionDate: row.revisionDateDetected?.toISOString?.() ?? null,
    packSizesLitres: Array.isArray(row.packSizesLitres)
      ? row.packSizesLitres
          .map(Number)
          .filter((value: number) => Number.isFinite(value))
      : [],
    packSizes: Array.isArray(row.packSizes)
      ? row.packSizes
          .map((packSize: any) => ({
            quantity: Number(packSize?.quantity),
            uom: packSize?.uom,
            label: String(packSize?.label ?? ""),
          }))
          .filter(
            (packSize: any) =>
              Number.isFinite(packSize.quantity) &&
              (packSize.uom === "L" || packSize.uom === "KG") &&
              packSize.label,
          )
      : Array.isArray(row.packSizesLitres)
        ? row.packSizesLitres.map((quantity: number) => ({
            quantity: Number(quantity),
            uom: "L" as const,
            label: `${Number(quantity)} L`,
          }))
        : [],
    status: statusMap[row.status] ?? "failed",
    warnings: Array.isArray(row.warnings)
      ? row.warnings.map(String)
      : [],
    errorMessage: row.errorMessage ?? null,
    uploadedAt: row.createdAt.toISOString(),
    profiles: (row.profiles ?? []).map((profile: any) => ({
      id: profile.id,
      name: profile.name,
      applicationMethod: profile.applicationMethod ?? null,
      applicationMethods: Array.isArray(profile.applicationMethods)
        ? profile.applicationMethods.map(String)
        : profile.applicationMethod
          ? [String(profile.applicationMethod)]
          : [],
      rateMode: profile.rateMode ?? null,
      rateUnit: profile.rateUnit ?? null,
      rateMin: toNullableNumber(profile.rateMin),
      rateMax: toNullableNumber(profile.rateMax),
      coverageM2PerLitre: toNullableNumber(
        profile.coverageM2PerLitre,
      ),
      coverageBasis: profile.coverageBasis ?? null,
      coverageType: profile.coverageType ?? null,
      recommendedCoats: profile.recommendedCoats ?? null,
      recommendedCoatsMin: profile.recommendedCoatsMin ?? null,
      recommendedCoatsMax: profile.recommendedCoatsMax ?? null,
      recommendedDftMicrons: toNullableNumber(
        profile.recommendedDftMicrons,
      ),
      recommendedWftMicrons: toNullableNumber(
        profile.recommendedWftMicrons,
      ),
      containerSizeLitres: null,
      thicknessMin: toNullableNumber(profile.thicknessMin),
      thicknessMax: toNullableNumber(profile.thicknessMax),
      thicknessUnit: profile.thicknessUnit ?? null,
      manufacturerRateLabel: profile.manufacturerRateLabel ?? null,
      sourceSnippet: profile.sourceSnippet ?? null,
      sourcePage: profile.sourcePage ?? null,
      note: profile.note ?? null,
      confidence: toNullableNumber(profile.confidence),
      isSelected: Boolean(profile.isSelected),
    })),
  };
}
