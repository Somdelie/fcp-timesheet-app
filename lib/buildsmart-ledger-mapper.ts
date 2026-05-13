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
  if (code.startsWith("924")) return "LABOUR";
  if (code === "922010") return "MATERIAL";
  if (code === "922095") return "MATERIAL";
  if (code === "922150") return "MATERIAL";
  if (code === "922070") return "CONSUMABLE";
  if (code === "920020") return "PLANT";
  if (code === "920025") return "TOOLS";
  if (code === "920001") return "SAFETY";
  if (code === "920030") return "SCAFFOLDING";
  if (code.startsWith("922")) return "MATERIAL";
  if (code.startsWith("920")) return "PLANT";
  if (code.startsWith("930")) return "SUBCONTRACT";
  return "OTHER";
}

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
