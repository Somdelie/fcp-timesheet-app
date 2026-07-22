export type PaintPlan = {
  id: string;
  siteId: string;
  description: string;
  boqReference: string | null;
  areaM2: number;
  productId: string;
  coverageId: string | null;
  coats: number;
  coverageNameSnapshot: string | null;
  coverageM2PerLitreSnapshot: number;
  coverageBasisSnapshot: "PER_COAT" | "TOTAL_SYSTEM";
  containerSizeLitresSnapshot: number;
  wastagePercent: number;
  requiredLitresBeforeWastage: number;
  wastageLitres: number;
  requiredLitres: number;
  requiredContainers: number;
  roundedContainers: number;
  estimatedCost: number | null;
  note: string | null;
  createdAt: string;
  site: { id: string; name: string; code: string | null };
  product: {
    id: string;
    name: string;
    uom: string | null;
    unitSize: number | null;
  };
  coverage: {
    id: string;
    name: string;
    coverageM2PerLitre: number | null;
    coverageBasis: "PER_COAT" | "TOTAL_SYSTEM" | null;
    coverageType: "THEORETICAL" | "PRACTICAL" | null;
    recommendedCoats: number | null;
    uom: string | null;
    unitSize: number | null;
    note: string | null;
  } | null;
  usages: {
    id: string;
    usedLitres: number | null;
    usedContainers: number | null;
    note: string | null;
    usedOn: string;
  }[];
};

export type SiteOption = { id: string; name: string; code: string | null };
export type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  uom: string | null;
  unitSize: number | null;
};
export type CoverageOption = {
  id: string;
  name: string;
  applicationMethod: string | null;
  applicationMethods: string[] | null;
  rateMode: "COVERAGE" | "CONSUMPTION" | "CONTAINER_COVERAGE";
  rateUnit:
    | "M2_PER_L"
    | "M2_PER_KG"
    | "L_PER_M2"
    | "KG_PER_M2"
    | "M2_PER_CONTAINER";
  rateMin: number | null;
  rateMax: number | null;
  coverageM2PerLitre: number | null;
  coverageBasis: "PER_COAT" | "TOTAL_SYSTEM" | null;
  coverageType: "THEORETICAL" | "PRACTICAL" | null;
  recommendedCoats: number | null;
  recommendedCoatsMin: number | null;
  recommendedCoatsMax: number | null;
  uom: string | null;
  unitSize: number | null;
  recommendedDftMicrons: number | null;
  recommendedWftMicrons: number | null;
  thicknessMin: number | null;
  thicknessMax: number | null;
  thicknessUnit: "MICRON" | "MM" | null;
  manufacturerRateLabel: string | null;
  sourceSnippet: string | null;
  note: string | null;
  isDefault: boolean;
  product: { id: string; name: string };
};
