export type PaintPlan = {
  id: string;
  siteId: string;
  description: string;
  boqReference: string | null;
  areaM2: number;
  productId: string;
  coverageId: string | null;
  coats: number;
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
    coverageM2: number;
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
  coverageM2: number;
  uom: string | null;
  unitSize: number | null;
  note: string | null;
  product: { id: string; name: string };
};
