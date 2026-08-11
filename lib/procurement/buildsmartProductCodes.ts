const PRODUCT_UNIT_SUFFIX_RE = /(\d+(?:\.\d+)?)(ML|L|KG|G|MM|CM|M)$/i;

export function normalizeSkuKey(value: string | null | undefined) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isNumericCostCode(value: string | null | undefined) {
  return /^\d{6}$/.test(String(value ?? "").trim());
}

export function inferBuildSmartProductCode(
  rawDescription: string,
  unit?: string | null,
): string | null {
  const raw = String(rawDescription ?? "").trim();
  if (!raw) return null;

  if (/\bPLASTER\s+MIX\b/i.test(raw)) return "P-MIX";

  const withoutCostCode = raw.replace(/^\d{6}\s+/, "").trim();
  const match = withoutCostCode.match(/^([A-Z]{1,4})(\s*)(\d[A-Z0-9]*)/i);
  if (!match) return null;

  const prefix = match[1].toUpperCase();
  const hadSpace = match[2].length > 0;
  let body = match[3].toUpperCase().replace(/\s+/g, "");

  const unitText = String(unit ?? "").toUpperCase().replace(/\s+/g, "");
  if (unitText) {
    const escapedUnit = unitText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body.replace(new RegExp(`${escapedUnit}$`, "i"), "");
  }
  const embeddedUnit = body.match(/^(\d{6})(\d{1,3})(ML|L|KG|G)$/i);
  if (embeddedUnit) {
    body = embeddedUnit[1];
  } else {
    body = body.replace(PRODUCT_UNIT_SUFFIX_RE, "");
  }
  body = body.replace(/[^A-Z0-9]/g, "");

  const digitsMatch = body.match(/\d+/);
  if (!digitsMatch) return null;

  let digits = digitsMatch[0];
  // BuildSmart product codes are a zero-padded 6-digit code (e.g. "PEM600" ->
  // "000600"). Some raw descriptions append a bare size with no unit letter
  // straight after it (e.g. "PEM00060020" = product 600 + size 20L,
  // "PEM0006005" = product 600 + size 5L) — the embeddedUnit branch above
  // only catches sizes that keep their unit letter, so also strip any digits
  // beyond the leading 6 here.
  if (digits.length > 6) {
    digits = digits.slice(0, 6);
  }
  digits = digits.padStart(6, "0");
  return hadSpace ? `${prefix} ${digits}` : `${prefix}${digits}`;
}

export function normalizeBuildSmartProductCode(
  code: string | null | undefined,
  unit?: string | null,
) {
  return inferBuildSmartProductCode(String(code ?? ""), unit);
}
