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

  const digits = digitsMatch[0].padStart(6, "0");
  return hadSpace ? `${prefix} ${digits}` : `${prefix}${digits}`;
}

export function normalizeBuildSmartProductCode(
  code: string | null | undefined,
  unit?: string | null,
) {
  return inferBuildSmartProductCode(String(code ?? ""), unit);
}
