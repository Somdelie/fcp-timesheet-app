export type ProgrammeActivityColor = {
  trackClass: string;
  barClass: string;
  handleClass: string;
  borderHex: string;
  fillHex: string;
  fillRgb: [number, number, number];
  textHex: string;
};

export const programmeActivityColors: ProgrammeActivityColor[] = [
  {
    trackClass: "bg-emerald-500/20",
    barClass: "border-emerald-600 bg-emerald-50 text-emerald-950",
    handleClass: "border-emerald-700/30 bg-emerald-700/15",
    borderHex: "FF059669",
    fillHex: "FFD1FAE5",
    fillRgb: [0.82, 0.98, 0.9],
    textHex: "FF064E3B",
  },
  {
    trackClass: "bg-sky-500/20",
    barClass: "border-sky-600 bg-sky-50 text-sky-950",
    handleClass: "border-sky-700/30 bg-sky-700/15",
    borderHex: "FF0284C7",
    fillHex: "FFE0F2FE",
    fillRgb: [0.88, 0.95, 1],
    textHex: "FF082F49",
  },
  {
    trackClass: "bg-amber-500/25",
    barClass: "border-amber-600 bg-amber-50 text-amber-950",
    handleClass: "border-amber-700/30 bg-amber-700/15",
    borderHex: "FFD97706",
    fillHex: "FFFEF3C7",
    fillRgb: [1, 0.95, 0.78],
    textHex: "FF451A03",
  },
  {
    trackClass: "bg-violet-500/20",
    barClass: "border-violet-600 bg-violet-50 text-violet-950",
    handleClass: "border-violet-700/30 bg-violet-700/15",
    borderHex: "FF7C3AED",
    fillHex: "FFEDE9FE",
    fillRgb: [0.93, 0.91, 1],
    textHex: "FF2E1065",
  },
  {
    trackClass: "bg-rose-500/20",
    barClass: "border-rose-600 bg-rose-50 text-rose-950",
    handleClass: "border-rose-700/30 bg-rose-700/15",
    borderHex: "FFE11D48",
    fillHex: "FFFFE4E6",
    fillRgb: [1, 0.89, 0.9],
    textHex: "FF4C0519",
  },
  {
    trackClass: "bg-cyan-500/20",
    barClass: "border-cyan-600 bg-cyan-50 text-cyan-950",
    handleClass: "border-cyan-700/30 bg-cyan-700/15",
    borderHex: "FF0891B2",
    fillHex: "FFCFFAFE",
    fillRgb: [0.81, 0.98, 1],
    textHex: "FF083344",
  },
  {
    trackClass: "bg-lime-500/25",
    barClass: "border-lime-600 bg-lime-50 text-lime-950",
    handleClass: "border-lime-700/30 bg-lime-700/15",
    borderHex: "FF65A30D",
    fillHex: "FFECFCCB",
    fillRgb: [0.93, 0.99, 0.8],
    textHex: "FF1A2E05",
  },
  {
    trackClass: "bg-fuchsia-500/20",
    barClass: "border-fuchsia-600 bg-fuchsia-50 text-fuchsia-950",
    handleClass: "border-fuchsia-700/30 bg-fuchsia-700/15",
    borderHex: "FFC026D3",
    fillHex: "FFFAE8FF",
    fillRgb: [0.98, 0.91, 1],
    textHex: "FF4A044E",
  },
];

export function getProgrammeActivityColor(index: number) {
  return programmeActivityColors[index % programmeActivityColors.length];
}
