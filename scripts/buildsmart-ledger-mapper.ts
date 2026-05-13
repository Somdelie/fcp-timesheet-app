/**
 * Maps BuildSmart ledger codes to HistoricalCostCategory enum values.
 *
 * Ledger ranges observed across FCP sites:
 *   920001  Safety Files
 *   920020  Plant Hire
 *   920025  Small Tools Hire
 *   920030  Formwork & Scaffolding
 *   922010  Paint - Walls
 *   922070  Consumables
 *   922095  Filling Materials
 *   922150  Building Materials
 *   924xxx  Labour Only
 */

export type HistoricalCostCategory =
  | "LABOUR"
  | "MATERIAL"
  | "CONSUMABLE"
  | "PLANT"
  | "TOOLS"
  | "SAFETY"
  | "SCAFFOLDING"
  | "SUBCONTRACT"
  | "OTHER";

export function mapLedgerCategory(code: string): HistoricalCostCategory {
  // Labour: all 924xxx codes
  if (code.startsWith("924")) return "LABOUR";

  // Known material codes
  if (code === "922010") return "MATERIAL"; // Paint - Walls
  if (code === "922095") return "MATERIAL"; // Filling Materials
  if (code === "922150") return "MATERIAL"; // Building Materials

  // Consumables
  if (code === "922070") return "CONSUMABLE";

  // Plant & equipment
  if (code === "920020") return "PLANT"; // Plant Hire

  // Tools
  if (code === "920025") return "TOOLS"; // Small Tools Hire

  // Safety
  if (code === "920001") return "SAFETY"; // Safety Files

  // Scaffolding / formwork
  if (code === "920030") return "SCAFFOLDING"; // Formwork & Scaffolding

  // Generic fallbacks: remaining 922xxx = material, 920xxx = plant
  if (code.startsWith("922")) return "MATERIAL";
  if (code.startsWith("920")) return "PLANT";

  // Subcontract range (930xxx is common in BuildSmart)
  if (code.startsWith("930")) return "SUBCONTRACT";

  return "OTHER";
}

/** Human-readable label for a ledger code, shown in import reports. */
export const LEDGER_LABELS: Record<string, string> = {
  "920001": "Safety Files",
  "920020": "Plant Hire",
  "920025": "Small Tools Hire",
  "920030": "Formwork & Scaffolding",
  "922010": "Paint - Walls",
  "922070": "Consumables",
  "922095": "Filling Materials",
  "922150": "Building Materials",
  "924015": "Labour Only",
};

export function ledgerLabel(code: string): string {
  return LEDGER_LABELS[code] ?? `Ledger ${code}`;
}
