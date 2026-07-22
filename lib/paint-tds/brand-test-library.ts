import type { TdsRateUnit } from "@/types/tds-types";

export interface BrandTdsFixture {
  manufacturer: string;
  fileName: string;
  text: string;
  expectedRateUnit: TdsRateUnit | null;
}

/**
 * Extracted-text fixtures covering the core South African manufacturer set.
 * Keep the snippets compact so parser regressions identify the failing format.
 * Real manufacturer PDFs can be added alongside these fixtures as licensed
 * source documents become available.
 */
export const brandTdsFixtures: BrandTdsFixture[] = [
  {
    manufacturer: "Plascon",
    fileName: "plascon-wall-paint.pdf",
    text: "PLASCON\nProduct code: PEM 900\nPack sizes: 1 L, 5 L, 20 L\nTheoretical spreading rate: 8-10 m2/L per coat\nApplication: Brush, Roller, Airless spray\n2 coats",
    expectedRateUnit: "M2_PER_L",
  },
  {
    manufacturer: "Dulux",
    fileName: "dulux-trade-coating.pdf",
    text: "DULUX TRADE\nProduct code: DTX 100\nPack sizes: 5 L and 20 L\nPractical coverage: 7 m2/L per coat\nDFT: 125-150 microns\n2 coats",
    expectedRateUnit: "M2_PER_L",
  },
  {
    manufacturer: "Prominent",
    fileName: "prominent-waterproofing.pdf",
    text: "PROMINENT PAINTS\nProduct code: PRO 210\nPack size: 20 L\nSystem consumption: 2.1 L/m2\nApply by roller in 3 coats",
    expectedRateUnit: "L_PER_M2",
  },
  {
    manufacturer: "Marmoran",
    fileName: "marmoran-decorative-plaster.pdf",
    text: "MARMORAN\nProduct code: MAR 330\nPack sizes: 8 kg, 32 kg\nMaterial consumption: 1.5-2.0 kg/m2\nApplied by stainless steel trowel",
    expectedRateUnit: "KG_PER_M2",
  },
  {
    manufacturer: "Versus",
    fileName: "versus-textured-coating.pdf",
    text: "VERSUS PAINTS\nProduct code: VER 440\nPack size: 25 kg\nCoverage: 3-4 m2/kg\nApplication method: Trowel",
    expectedRateUnit: "M2_PER_KG",
  },
  {
    manufacturer: "Cemcrete",
    fileName: "cemcrete-bagged-product.pdf",
    text: "CEMCRETE\nProduct code: CEM 550\n25 kg bag covers approximately 12 m2\nApplication method: Trowel",
    expectedRateUnit: "M2_PER_CONTAINER",
  },
  {
    manufacturer: "a.b.e.",
    fileName: "abe-membrane.pdf",
    text: "a.b.e. Construction Chemicals\nProduct code: ABE 660\nPack size: 20 kg\nConsumption: 1.2-1.8 kg/m2\nThickness: 0.8-1.2 mm",
    expectedRateUnit: "KG_PER_M2",
  },
  {
    manufacturer: "Medal",
    fileName: "medal-wall-coating.pdf",
    text: "MEDAL PAINTS\nProduct code: MED 770\nPack sizes: 1 L, 5 L, 20 L\nCoverage: 8 m2/L per coat\nBrush, Roller or Airless spray\n2 coats",
    expectedRateUnit: "M2_PER_L",
  },
  {
    manufacturer: "Duram",
    fileName: "duram-waterproofing.pdf",
    text: "DURAM\nProduct code: DUR 880\nPack size: 20 L\nSystem consumption: 1.5 L/m2\nApply 2 coats by brush or roller",
    expectedRateUnit: "L_PER_M2",
  },
  {
    manufacturer: "Urochem",
    fileName: "urochem-epoxy.pdf",
    text: "UROCHEM\nProduct code: URO 990\nPack size: 32 kg\nMaterial consumption: 0.4-0.6 kg/m2\nDFT: 300 microns",
    expectedRateUnit: "KG_PER_M2",
  },
  {
    manufacturer: "Midas Earthcote",
    fileName: "midas-earthcote-finish.pdf",
    text: "MIDAS PAINTS EARTHCOTE\nProduct code: MEC 110\nPack sizes: 8 kg and 32 kg\nYield: 2.5-3.0 m2/kg\nApplication method: Trowel",
    expectedRateUnit: "M2_PER_KG",
  },
  {
    manufacturer: "Academy Brushware",
    fileName: "academy-brushware-accessory.pdf",
    text: "ACADEMY BRUSHWARE\nProduct code: ACB 220\nProfessional airless spray accessory\nPack size: 1 unit",
    expectedRateUnit: null,
  },
];
