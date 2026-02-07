import { Decimal } from "@prisma/client/runtime/client";

export function formatCurrency(
  amount: number | string | Decimal | null | undefined,
  locale: string = "en-ZA",
  currency: string = "ZAR",
): string {
  if (amount === null || amount === undefined) return "R0.00";

  const n =
    amount instanceof Decimal
      ? Number(amount.toString())
      : typeof amount === "string"
        ? Number(amount)
        : amount;

  if (!Number.isFinite(n)) return "R0.00";

  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(n);

    // Replace ZAR with R (optional)
    return formatted.replace("ZAR", "R");
  } catch {
    return `R${n.toFixed(2)}`;
  }
}
