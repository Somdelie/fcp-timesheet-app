export type TdsCoverageBasis = "PER_COAT" | "TOTAL_SYSTEM";
export type TdsCoverageType = "THEORETICAL" | "PRACTICAL";
export type TdsRateMode = "COVERAGE" | "CONSUMPTION" | "CONTAINER_COVERAGE";
export type TdsRateUnit =
  | "M2_PER_L"
  | "M2_PER_KG"
  | "L_PER_M2"
  | "KG_PER_M2"
  | "M2_PER_CONTAINER";

export type TdsImportStatus =
  | "uploaded"
  | "extracting"
  | "parsing"
  | "needs-review"
  | "approved"
  | "imported"
  | "failed";

export type ExtractionStatus = TdsImportStatus;

export interface TdsCoverageProfile {
  id: string;
  name: string;
  applicationMethod: string | null;
  applicationMethods: string[];
  rateMode: TdsRateMode | null;
  rateUnit: TdsRateUnit | null;
  rateMin: number | null;
  rateMax: number | null;
  coverageM2PerLitre: number | null;
  coverageBasis: TdsCoverageBasis | null;
  coverageType: TdsCoverageType | null;
  recommendedCoats: number | null;
  recommendedCoatsMin: number | null;
  recommendedCoatsMax: number | null;
  recommendedDftMicrons: number | null;
  recommendedWftMicrons: number | null;
  containerSizeLitres: number | null;
  thicknessMin: number | null;
  thicknessMax: number | null;
  thicknessUnit: "MICRON" | "MM" | null;
  manufacturerRateLabel: string | null;
  sourceSnippet: string | null;
  sourcePage: number | null;
  note: string | null;
  confidence: number | null;
  isSelected: boolean;
}

export interface TdsFile {
  id: string;
  fileName: string;
  fileUrl: string | null;
  manufacturer: string | null;
  productCode: string | null;
  productName: string | null;
  description: string | null;
  revision: string | null;
  revisionDate: string | null;
  packSizesLitres: number[];
  packSizes: Array<{ quantity: number; uom: "L" | "KG"; label: string }>;
  status: TdsImportStatus;
  warnings: string[];
  errorMessage: string | null;
  uploadedAt: string;
  profiles: TdsCoverageProfile[];
}
