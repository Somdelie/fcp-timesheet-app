export const SA_BANKS = [
  "ABSA",
  "African Bank",
  "Bidvest Bank",
  "Capitec",
  "Discovery Bank",
  "FNB",
  "Grindrod Bank",
  "HBZ Bank",
  "Investec",
  "Mercantile Bank",
  "Nedbank",
  "Old Mutual Finance",
  "Postbank",
  "Sasfin Bank",
  "Standard Bank",
  "TymeBank",
  "Ubank",
] as const;

export type SaBankName = (typeof SA_BANKS)[number];
