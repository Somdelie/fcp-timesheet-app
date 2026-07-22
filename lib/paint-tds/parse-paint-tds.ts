import { parsedPaintTdsSchema, type ParsedPaintTds } from "./schema";

type TdsPage = {
  pageNumber: number;
  text: string;
};

type CoverageProfile = ParsedPaintTds["coverageProfiles"][number];

function toNumber(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }

  const cleaned = raw.replace(/\s+/g, "").replace(",", ".");

  const value = Number(cleaned);

  return Number.isFinite(value) ? value : null;
}

function midpoint(first: number | null, second: number | null): number | null {
  if (first === null && second === null) {
    return null;
  }

  if (first === null) {
    return second;
  }

  if (second === null) {
    return first;
  }

  return Math.round(((first + second) / 2) * 100) / 100;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normaliseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function removeCopySuffix(value: string): string {
  return value
    .replace(/\s*\(\d+\)\s*$/g, "")
    .replace(/\s+copy(?:\s+\d+)?$/i, "")
    .trim();
}

function titleCase(value: string): string {
  const lowercaseWords = new Set([
    "and",
    "or",
    "of",
    "the",
    "for",
    "to",
    "with",
    "in",
    "on",
  ]);

  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && lowercaseWords.has(word)) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function cleanFileName(fileName: string): string {
  return removeCopySuffix(
    normaliseSpaces(
      fileName
        .replace(/\.pdf$/i, "")
        .replace(/\btechnical data sheet\b/gi, "")
        .replace(/\btds\b/gi, "")
        .replace(/[_]+/g, " ")
        .replace(/\s+-\s+/g, " "),
    ),
  );
}

function cleanExtractedProductName(value: string): string {
  return removeCopySuffix(
    normaliseSpaces(
      value
        .replace(/\btechnical data sheet\b/gi, "")
        .replace(/\btds\b\s*[:#-]?/gi, "")
        .replace(/\bproduct code\b.*$/gi, "")
        .replace(/\bversion\b.*$/gi, "")
        .replace(/\brevision date\b.*$/gi, "")
        .replace(/\b(?:tintb|tint\s*bases?)\b.*$/gi, "")
        .replace(/[_]+/g, " "),
    ),
  );
}

function detectManufacturer(text: string): string | null {
  const manufacturers: Array<{
    pattern: RegExp;
    output: string;
  }> = [
    {
      pattern: /\bkansai\s+plascon\b/i,
      output: "Plascon",
    },
    {
      pattern: /\bplascon\b/i,
      output: "Plascon",
    },
    {
      pattern: /\bdulux\b/i,
      output: "Dulux",
    },
    {
      pattern: /\bcemcrete\b/i,
      output: "Cemcrete",
    },
    {
      pattern: /\bmarmoran\b/i,
      output: "Marmoran",
    },
    {
      pattern: /\burochem\b/i,
      output: "Urochem",
    },
    {
      pattern: /\bprominent(?:\s+paints?)?\b/i,
      output: "Prominent",
    },
    {
      pattern: /\bversus(?:\s+paints?)?\b/i,
      output: "Versus",
    },
    {
      pattern: /\bmedal(?:\s+paints?)?\b/i,
      output: "Medal",
    },
    {
      pattern: /\bduram\b/i,
      output: "Duram",
    },
    {
      pattern: /\ba\.?b\.?e\.?\b/i,
      output: "a.b.e.",
    },
    {
      pattern: /\b(?:midas\s+)?earthcote\b|\bmidas\s+paints?\b/i,
      output: "Midas Earthcote",
    },
    {
      pattern: /\bacademy\s+brushware\b/i,
      output: "Academy Brushware",
    },
  ];

  for (const manufacturer of manufacturers) {
    if (manufacturer.pattern.test(text)) {
      return manufacturer.output;
    }
  }

  return null;
}

function detectProductCode(text: string): string | null {
  const contextualPatterns = [
    /\bproduct\s+code\s*[:#-]?\s*([A-Z]{2,}[ -]?\d{2,}(?:[A-Z0-9/-]*))/i,
    /\bproduct\s+code\s*[:#-]?\s*([A-Z0-9][A-Z0-9 ./-]{2,24})/i,
    /\bcode\s*[:#-]\s*([A-Z]{2,}[ -]?\d{2,}(?:[A-Z0-9/-]*))/i,
  ];

  for (const pattern of contextualPatterns) {
    const match = text.match(pattern);
    const candidate = match?.[1] ? normaliseSpaces(match[1]) : null;

    if (!candidate) {
      continue;
    }

    const primaryCode = candidate.match(
      /\b([A-Z]{2,}[ -]?\d{2,}[A-Z0-9-]*)\b/i,
    )?.[1];

    if (primaryCode) {
      return primaryCode.replace(/\s+/g, " ").toUpperCase();
    }
  }

  const fallbackMatches = text.matchAll(
    /\b([A-Z]{2,}[ -]?\d{3,}[A-Z0-9-]*)\b/g,
  );

  const ignoredPrefixes = new Set(["TDS", "VOC", "DFT", "WFT"]);

  for (const match of fallbackMatches) {
    const value = match[1]?.trim();

    if (!value) {
      continue;
    }

    const prefix = value.match(/^[A-Z]+/)?.[0];

    if (prefix && ignoredPrefixes.has(prefix)) {
      continue;
    }

    return value;
  }

  return null;
}

function detectProductHeading(pages: TdsPage[]): string | null {
  const firstPage = pages[0]?.text ?? "";

  const headingPatterns = [
    /^\s*([A-Z][A-Z0-9 &'()/.-]{5,80})\s*$/gm,
    /\bproduct\s+name\s*[:#-]?\s*([^\n]{3,100})/gi,
  ];

  for (const pattern of headingPatterns) {
    const matches = [...firstPage.matchAll(pattern)];

    for (const match of matches) {
      const candidate = cleanExtractedProductName(match[1] ?? "");

      if (
        candidate.length < 4 ||
        /^(product code|technical data sheet|application details|product information)$/i.test(
          candidate,
        )
      ) {
        continue;
      }

      if (
        /\bprofessional\b/i.test(candidate) ||
        /\bprimer\b/i.test(candidate) ||
        /\btexture\b/i.test(candidate) ||
        /\bpaint\b/i.test(candidate) ||
        /\bcoating\b/i.test(candidate)
      ) {
        return titleCase(candidate);
      }
    }
  }

  return null;
}

function buildCanonicalProductName(args: {
  heading: string | null;
  fileName: string;
  productCode: string | null;
}): string {
  let baseName = args.heading ?? cleanFileName(args.fileName);

  baseName = cleanExtractedProductName(baseName);

  if (args.productCode) {
    const codePattern = new RegExp(
      `\\b${escapeRegExp(args.productCode)}\\b`,
      "gi",
    );

    baseName = normaliseSpaces(baseName.replace(codePattern, ""));
  }

  baseName = baseName
    .replace(/\brange\s*&.*$/i, "")
    .replace(/\bTPX\s+tint\s+bases?.*$/i, "")
    .replace(/\btint\s+bases?.*$/i, "")
    .trim();

  baseName = titleCase(baseName);

  if (!baseName) {
    return args.productCode ?? "Unnamed product";
  }

  if (!args.productCode) {
    return baseName;
  }

  return `${baseName} - ${args.productCode}`;
}

function detectDescription(text: string): string | null {
  const patterns = [
    /\bproduct\s+description\s+([^\n]{20,300})/i,
    /\bproduct\s+description\s*[:#-]?\s*([\s\S]{20,300}?)(?=\n\s*(?:intended uses|features|product information|application details)\b)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match?.[1]) {
      continue;
    }

    const description = normaliseSpaces(match[1])
      .replace(/\s+(?:intended uses|features.*)$/i, "")
      .trim();

    if (description.length >= 15) {
      return description;
    }
  }

  return null;
}

function detectRevision(text: string): string | null {
  const patterns = [
    /\bversion\s*[:#-]?\s*([A-Za-z0-9.]{1,24})/i,
    /\brevision(?!\s+date)\s*[:#-]?\s*([A-Za-z0-9.]{1,24})/i,
    /\brev\.?\s*[:#-]?\s*([A-Za-z0-9.]{1,24})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match?.[1]?.trim();

    if (candidate && !/^(date|dated)$/i.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function parseDateToIso(raw: string): string | null {
  const cleaned = raw.trim();

  const isoMatch = cleaned.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    if (isValidDateParts(year, month, day)) {
      return [
        year.toString().padStart(4, "0"),
        month.toString().padStart(2, "0"),
        day.toString().padStart(2, "0"),
      ].join("-");
    }
  }

  const dayFirstMatch = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (dayFirstMatch) {
    const day = Number(dayFirstMatch[1]);
    const month = Number(dayFirstMatch[2]);
    const year = Number(dayFirstMatch[3]);

    if (isValidDateParts(year, month, day)) {
      return [
        year.toString().padStart(4, "0"),
        month.toString().padStart(2, "0"),
        day.toString().padStart(2, "0"),
      ].join("-");
    }
  }

  return null;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (
    year < 1900 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function detectRevisionDate(text: string): string | null {
  const contextualPatterns = [
    /\brevision\s+date\s*[:#-]?\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
    /\bdated?\s*[:#-]?\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i,
  ];

  for (const pattern of contextualPatterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const isoDate = parseDateToIso(match[1]);

      if (isoDate) {
        return isoDate;
      }
    }
  }

  const fallback = text.match(
    /\b(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/,
  );

  return fallback?.[1] ? parseDateToIso(fallback[1]) : null;
}

function detectPackSizes(text: string): number[] {
  const sizes = new Set<number>();

  const packagingSections = [
    ...text.matchAll(
      /\b(?:packaging|pack\s+size|container\s+size)\s*[:#-]?\s*([^\n]{0,120})/gi,
    ),
  ];

  for (const section of packagingSections) {
    const sectionText = section[1] ?? "";

    for (const match of sectionText.matchAll(
      /(\d+(?:[.,]\d+)?)\s*(?:l|ℓ|lit(?:er|re)?s?)\b/gi,
    )) {
      const value = toNumber(match[1]);

      if (value !== null && value > 0 && value <= 500) {
        sizes.add(value);
      }
    }
  }

  if (sizes.size === 0) {
    const explicitPackaging = text.matchAll(
      /\b(?:packaging|available\s+in|supplied\s+in)\b[^\n]{0,80}?(\d+(?:[.,]\d+)?)\s*(?:l|ℓ|lit(?:er|re)?s?)\b/gi,
    );

    for (const match of explicitPackaging) {
      const value = toNumber(match[1]);

      if (value !== null && value > 0 && value <= 500) {
        sizes.add(value);
      }
    }
  }

  return [...sizes].sort((a, b) => a - b);
}

function detectGenericPackSizes(
  text: string,
): ParsedPaintTds["product"]["packSizes"] {
  const sizes = new Map<
    string,
    ParsedPaintTds["product"]["packSizes"][number]
  >();
  const contexts = [
    ...text.matchAll(
      /\b(?:packaging|pack\s+sizes?|container\s+sizes?|available\s+in|supplied\s+in)\b[^\n]{0,160}/gi,
    ),
  ];

  for (const context of contexts) {
    for (const match of (context[0] ?? "").matchAll(
      /(\d+(?:[.,]\d+)?)\s*(kg|kilograms?|l|\u2113|lit(?:er|re)?s?)\b/gi,
    )) {
      const quantity = toNumber(match[1]);
      const uom = /^k/i.test(match[2] ?? "") ? "KG" : "L";

      if (quantity !== null && quantity > 0 && quantity <= 10000) {
        sizes.set(`${quantity}:${uom}`, {
          quantity,
          uom,
          label: `${quantity} ${uom === "KG" ? "kg" : "L"}`,
        });
      }
    }
  }

  return [...sizes.values()].sort(
    (a, b) => a.uom.localeCompare(b.uom) || a.quantity - b.quantity,
  );
}

function parseWordNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const normalised = value.toLowerCase();

  const words: Record<string, number> = {
    one: 1,
    single: 1,
    two: 2,
    double: 2,
    three: 3,
    four: 4,
    five: 5,
  };

  if (normalised in words) {
    return words[normalised];
  }

  const numeric = Number(normalised);

  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function detectCoats(text: string): number | null {
  const directMatch = text.match(
    /\b(one|two|three|four|five|\d{1,2})\s+(?:full\s+|finishing\s+|top\s*)?coats?\b/i,
  );

  if (directMatch?.[1]) {
    return parseWordNumber(directMatch[1]);
  }

  const hyphenatedMatch = text.match(
    /\b(one|two|three|four|five|\d{1,2})[- ]coat\b/i,
  );

  if (hyphenatedMatch?.[1]) {
    return parseWordNumber(hyphenatedMatch[1]);
  }

  if (
    /\bmist\s+coat\b/i.test(text) &&
    /\bfollowed\s+by\s+(?:a|one)\s+full\s+coat\b/i.test(text)
  ) {
    return 2;
  }

  return null;
}

function detectThickness(text: string, kind: "DFT" | "WFT"): number | null {
  const label =
    kind === "DFT" ? "(?:recommended\\s+)?DFT" : "(?:recommended\\s+)?WFT";

  const rangePattern = new RegExp(
    `\\b${label}\\b[^\\d]{0,30}(\\d+(?:[.,]\\d+)?)\\s*(?:-|to|–|—)\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:μm|µm|um|microns?)`,
    "i",
  );

  const rangeMatch = text.match(rangePattern);

  if (rangeMatch?.[1] && rangeMatch[2]) {
    return midpoint(toNumber(rangeMatch[1]), toNumber(rangeMatch[2]));
  }

  const singlePattern = new RegExp(
    `\\b${label}\\b[^\\d]{0,30}(\\d+(?:[.,]\\d+)?)\\s*(?:μm|µm|um|microns?)`,
    "i",
  );

  const singleMatch = text.match(singlePattern);

  if (singleMatch?.[1]) {
    return toNumber(singleMatch[1]);
  }

  const reversedPattern = new RegExp(
    `(\\d+(?:[.,]\\d+)?)\\s*(?:μm|µm|um|microns?)\\s*${kind}`,
    "i",
  );

  const reversedMatch = text.match(reversedPattern);

  return reversedMatch?.[1] ? toNumber(reversedMatch[1]) : null;
}

type DetectedRate = {
  rateMode: NonNullable<CoverageProfile["rateMode"]>;
  rateUnit: NonNullable<CoverageProfile["rateUnit"]>;
  rateMin: number;
  rateMax: number;
  index: number;
  sourceText: string;
};

function detectRateMatches(text: string): DetectedRate[] {
  const patterns: Array<{
    rateMode: DetectedRate["rateMode"];
    rateUnit: DetectedRate["rateUnit"];
    pattern: RegExp;
  }> = [
    {
      rateMode: "COVERAGE",
      rateUnit: "M2_PER_L",
      pattern:
        /(\d+(?:[.,]\d+)?)(?:\s*(?:-|to|\u2013|\u2014)\s*(\d+(?:[.,]\d+)?))?\s*m\s*(?:\u00b2|2)\s*\/\s*(?:l|\u2113|lit(?:er|re)?s?)\b/gi,
    },
    {
      rateMode: "CONSUMPTION",
      rateUnit: "L_PER_M2",
      pattern:
        /(\d+(?:[.,]\d+)?)(?:\s*(?:-|to|\u2013|\u2014)\s*(\d+(?:[.,]\d+)?))?\s*(?:l|\u2113|lit(?:er|re)?s?)\s*\/\s*m\s*(?:\u00b2|2)/gi,
    },
    {
      rateMode: "CONSUMPTION",
      rateUnit: "KG_PER_M2",
      pattern:
        /(\d+(?:[.,]\d+)?)(?:\s*(?:-|to|\u2013|\u2014)\s*(\d+(?:[.,]\d+)?))?\s*kg\s*\/\s*m\s*(?:\u00b2|2)/gi,
    },
    {
      rateMode: "COVERAGE",
      rateUnit: "M2_PER_KG",
      pattern:
        /(\d+(?:[.,]\d+)?)(?:\s*(?:-|to|\u2013|\u2014)\s*(\d+(?:[.,]\d+)?))?\s*m\s*(?:\u00b2|2)\s*\/\s*kg\b/gi,
    },
  ];
  const results: DetectedRate[] = [];

  for (const definition of patterns) {
    for (const match of text.matchAll(definition.pattern)) {
      const first = toNumber(match[1]);
      const second = toNumber(match[2]);

      if (first === null || first <= 0) continue;

      results.push({
        rateMode: definition.rateMode,
        rateUnit: definition.rateUnit,
        rateMin: Math.min(first, second ?? first),
        rateMax: Math.max(first, second ?? first),
        index: match.index ?? 0,
        sourceText: match[0],
      });
    }
  }

  const containerPattern =
    /(\d+(?:[.,]\d+)?)\s*kg[^.\n]{0,80}?cover(?:s|age)?\s*(?:approximately|approx\.?|\+\/-)?\s*(\d+(?:[.,]\d+)?)\s*m\s*(?:\u00b2|2)/gi;

  for (const match of text.matchAll(containerPattern)) {
    const area = toNumber(match[2]);
    if (area === null || area <= 0) continue;
    results.push({
      rateMode: "CONTAINER_COVERAGE",
      rateUnit: "M2_PER_CONTAINER",
      rateMin: area,
      rateMax: area,
      index: match.index ?? 0,
      sourceText: match[0],
    });
  }

  return results.sort((a, b) => a.index - b.index);
}

function detectManufacturerRateLabel(text: string): string | null {
  const labels = [
    "Theoretical spreading rate",
    "Practical spreading rate",
    "Theoretical coverage",
    "Practical coverage",
    "Spreading rate",
    "Spread rate",
    "Material consumption",
    "Consumption",
    "Application rate",
    "Yield",
    "Material usage",
    "Rate of application",
    "Coverage",
  ];

  for (const label of labels) {
    const match = text.match(
      new RegExp(`\\b${escapeRegExp(label)}\\b`, "i"),
    );
    if (match?.[0]) return match[0];
  }

  return null;
}

function detectThicknessRange(text: string): {
  min: number;
  max: number;
  unit: "MICRON" | "MM";
} | null {
  const match =
    text.match(
      /(?:wft|dft|thickness|applied\s+at|coating\s+thickness)[^\d]{0,30}(\d+(?:[.,]\d+)?)(?:\s*(?:-|to|\u2013|\u2014)\s*(\d+(?:[.,]\d+)?))?\s*(mm|\u00b5m|\u03bcm|microns?)/i,
    ) ??
    text.match(
      /(\d+(?:[.,]\d+)?)(?:\s*(?:-|to|\u2013|\u2014)\s*(\d+(?:[.,]\d+)?))?\s*(mm|\u00b5m|\u03bcm|microns?)\s*(?:thickness|dft|wft)?/i,
    );
  const first = toNumber(match?.[1]);
  const second = toNumber(match?.[2]);
  if (first === null) return null;
  return {
    min: Math.min(first, second ?? first),
    max: Math.max(first, second ?? first),
    unit: /^mm$/i.test(match?.[3] ?? "") ? "MM" : "MICRON",
  };
}

function detectCoverage(text: string): number | null {
  const range = text.match(
    /(\d+(?:[.,]\d+)?)\s*(?:-|to|–|—)\s*(\d+(?:[.,]\d+)?)\s*m\s*[²2]\s*\/\s*(?:l|ℓ|lit(?:er|re)?)/i,
  );

  if (range?.[1] && range[2]) {
    return midpoint(toNumber(range[1]), toNumber(range[2]));
  }

  const single = text.match(
    /(\d+(?:[.,]\d+)?)\s*m\s*[²2]\s*\/\s*(?:l|ℓ|lit(?:er|re)?)/i,
  );

  return single?.[1] ? toNumber(single[1]) : null;
}

function detectApplicationMethod(text: string): string | null {
  const lower = text.toLowerCase();

  const methods: Array<{
    test: RegExp;
    output: string;
  }> = [
    {
      test: /sheepskin\s+roller.*honey-?comb|honey-?comb.*sheepskin\s+roller/i,
      output: "Sheepskin roller and honeycomb roller",
    },
    {
      test: /honey-?comb(?:\s+sponge)?(?:\s+textured)?\s+roller/i,
      output: "Honeycomb roller",
    },
    {
      test: /medium\s+pile\s+roller/i,
      output: "Medium pile roller",
    },
    {
      test: /medium\s+lime\s*wash\s+brush/i,
      output: "Medium lime wash brush",
    },
    {
      test: /hopper\s+(?:spray\s+)?gun/i,
      output: "Hopper spray gun",
    },
    {
      test: /\bairless\s+spray\b/i,
      output: "Airless spray",
    },
    {
      test: /\bconventional\s+spray\b/i,
      output: "Conventional spray",
    },
    {
      test: /\broller\b/i,
      output: "Roller",
    },
    {
      test: /\bbrush\b/i,
      output: "Brush",
    },
    {
      test: /\bspray\b/i,
      output: "Spray",
    },
  ];

  for (const method of methods) {
    if (method.test.test(lower)) {
      return method.output;
    }
  }

  return null;
}

function detectApplicationMethods(text: string): string[] {
  const methods = new Set<string>();
  const candidates: Array<[RegExp, string]> = [
    [/\bairless\s+spray\b/i, "Airless spray"],
    [/\bconventional\s+spray\b/i, "Conventional spray"],
    [/\bbrush\b/i, "Brush"],
    [/\broller\b/i, "Roller"],
    [/\bhopper\s+(?:spray\s+)?gun\b/i, "Hopper spray gun"],
    [/\btrowel\b/i, "Trowel"],
    [/\bsqueegee\b/i, "Squeegee"],
  ];

  for (const [pattern, name] of candidates) {
    if (pattern.test(text)) methods.add(name);
  }

  const specific = detectApplicationMethod(text);
  if (specific) methods.add(specific);
  return [...methods];
}

function detectCoverageBasis(text: string): CoverageProfile["coverageBasis"] {
  const lower = text.toLowerCase();

  if (
    /\bper\s+coat\b/.test(lower) ||
    /\beach\s+coat\b/.test(lower) ||
    /\b\d+\s*(?:µm|μm|um)\s+dft\s+per\s+coat\b/.test(lower)
  ) {
    return "PER_COAT";
  }

  if (
    /\btotal\s+(?:practical\s+)?spreading\s+rate\b/.test(lower) ||
    /\btotal\s+system\b/.test(lower) ||
    /\bsystem\s+total\b/.test(lower) ||
    /\bone[- ]coat\s+finish\b/.test(lower)
  ) {
    return "TOTAL_SYSTEM";
  }

  return null;
}

function detectCoverageType(text: string): CoverageProfile["coverageType"] {
  const lower = text.toLowerCase();

  if (
    lower.includes("theoretical spreading rate") ||
    lower.includes("theoretical coverage")
  ) {
    return "THEORETICAL";
  }

  if (
    lower.includes("practical spreading rate") ||
    lower.includes("total practical spreading rate") ||
    lower.includes("applied at") ||
    lower.includes("using")
  ) {
    return "PRACTICAL";
  }

  return null;
}

function buildProfileName(args: {
  block: string;
  method: string | null;
  coverage: number;
  coats: number | null;
}): string {
  const lower = args.block.toLowerCase();

  if (lower.includes("even spray texture") || lower.includes("hopper")) {
    return "Even spray texture — Hopper gun";
  }

  if (lower.includes("one coat") || lower.includes("1.9")) {
    return "One-coat stipple — Sheepskin and honeycomb roller";
  }

  if (lower.includes("two coat stipple")) {
    return "Two-coat stipple finish — Honeycomb roller";
  }

  if (
    lower.includes("coarse texture finish") &&
    lower.includes("medium pile")
  ) {
    return "Two-coat coarse texture — Medium pile roller";
  }

  if (lower.includes("striated") || lower.includes("lime wash")) {
    return "Two-coat striated finish — Lime wash brush";
  }

  if (lower.includes("theoretical spreading rate")) {
    return "Manufacturer theoretical coverage";
  }

  const prefix =
    args.coats === 1 ? "One-coat" : args.coats === 2 ? "Two-coat" : "Coverage";

  if (args.method) {
    return `${prefix} application — ${args.method}`;
  }

  return `${prefix} profile — ${args.coverage} m²/L`;
}

function splitIntoApplicationBlocks(pageText: string): string[] {
  const normalised = pageText.replace(/\r/g, "");

  const headingPattern =
    /(?:^|\n)\s*[•\-]?\s*((?:TWO|ONE|IF APPLIED|STRIATED|EVEN SPRAY)[A-Z0-9 ()/-]{3,80}:?)/g;

  const matches = [...normalised.matchAll(headingPattern)];

  if (matches.length === 0) {
    return normalised
      .split(/\n{2,}/)
      .map(normaliseSpaces)
      .filter(Boolean);
  }

  const blocks: string[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0;

    const end =
      index + 1 < matches.length ? matches[index + 1].index : normalised.length;

    const block = normaliseSpaces(normalised.slice(start, end));

    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

function findContextAroundMatch(
  text: string,
  index: number,
  radius = 350,
): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);

  return normaliseSpaces(text.slice(start, end));
}

function detectCoverageProfiles(
  pages: TdsPage[],
  packSizes: number[],
): ParsedPaintTds["coverageProfiles"] {
  const profiles: ParsedPaintTds["coverageProfiles"] = [];

  const firstPack = packSizes[0] ?? null;

  for (const page of pages) {
    const applicationBlocks = splitIntoApplicationBlocks(page.text);

    const pageCandidates = [...applicationBlocks];

    const coverageMatches = [
      ...page.text.matchAll(
        /(\d+(?:[.,]\d+)?)\s*m\s*[²2]\s*\/\s*(?:l|ℓ|lit(?:er|re)?)/gi,
      ),
    ];

    for (const match of coverageMatches) {
      if (match.index === undefined) {
        continue;
      }

      pageCandidates.push(findContextAroundMatch(page.text, match.index));
    }

    for (const block of pageCandidates) {
      const coverage = detectCoverage(block);

      if (coverage === null || coverage <= 0) {
        continue;
      }

      const coats = detectCoats(block);
      const method = detectApplicationMethod(block);
      const dft = detectThickness(block, "DFT");
      const wft = detectThickness(block, "WFT");

      let coverageBasis = detectCoverageBasis(block);

      let coverageType = detectCoverageType(block);

      const lower = block.toLowerCase();

      if (
        coverageBasis === null &&
        lower.includes("theoretical spreading rate")
      ) {
        coverageBasis = "PER_COAT";
      }

      if (
        coverageBasis === null &&
        (lower.includes("one coat") ||
          lower.includes("total practical spreading rate"))
      ) {
        coverageBasis = "TOTAL_SYSTEM";
      }

      if (coverageType === null && lower.includes("theoretical")) {
        coverageType = "THEORETICAL";
      }

      if (
        coverageType === null &&
        (lower.includes("application") || method !== null)
      ) {
        coverageType = "PRACTICAL";
      }

      const profile: CoverageProfile = {
        name: buildProfileName({
          block,
          method,
          coverage,
          coats,
        }),
        applicationMethod: method,
        applicationMethods: method ? [method] : [],
        rateMode: "COVERAGE",
        rateUnit: "M2_PER_L",
        rateMin: coverage,
        rateMax: coverage,
        coverageM2PerLitre: coverage,
        coverageBasis,
        coverageType,
        recommendedCoats: coats,
        recommendedCoatsMin: coats,
        recommendedCoatsMax: coats,
        recommendedDftMicrons: dft,
        recommendedWftMicrons: wft,
        containerSizeLitres: firstPack,
        thicknessMin: dft ?? wft,
        thicknessMax: dft ?? wft,
        thicknessUnit: dft !== null || wft !== null ? "MICRON" : null,
        manufacturerRateLabel: detectManufacturerRateLabel(block),
        sourceSnippet: normaliseSpaces(block).slice(0, 500),
        sourcePage: page.pageNumber,
        note: "Auto-extracted using the local rule-based parser. Verify values before approval.",
        confidence: calculateConfidence({
          coverage,
          coverageBasis,
          coverageType,
          coats,
          method,
          dft,
          wft,
          sourcePage: page.pageNumber,
        }),
      };

      addOrMergeProfile(profiles, profile);
    }
  }

  return profiles.sort((a, b) => {
    const pageDifference = (a.sourcePage ?? 999) - (b.sourcePage ?? 999);

    if (pageDifference !== 0) {
      return pageDifference;
    }

    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
}

function detectGenericRateProfiles(
  pages: TdsPage[],
): ParsedPaintTds["coverageProfiles"] {
  const profiles: ParsedPaintTds["coverageProfiles"] = [];

  for (const page of pages) {
    for (const rate of detectRateMatches(page.text)) {
      const context = findContextAroundMatch(page.text, rate.index, 240);
      const methods = detectApplicationMethods(context);
      const method = methods[0] ?? null;
      const coats = detectCoats(context);
      const dft = detectThickness(context, "DFT");
      const wft = detectThickness(context, "WFT");
      const thickness = detectThicknessRange(context);
      const coverageBasis = detectCoverageBasis(context);
      const coverageType = detectCoverageType(context);
      const manufacturerRateLabel = detectManufacturerRateLabel(context);
      const midpointRate = midpoint(rate.rateMin, rate.rateMax);
      const unitLabel: Record<NonNullable<CoverageProfile["rateUnit"]>, string> = {
        M2_PER_L: "m2/L",
        M2_PER_KG: "m2/kg",
        L_PER_M2: "L/m2",
        KG_PER_M2: "kg/m2",
        M2_PER_CONTAINER: "m2/container",
      };

      const profile: CoverageProfile = {
        name:
          manufacturerRateLabel ??
          `${rate.rateMode === "CONSUMPTION" ? "Consumption" : "Coverage"} - ${rate.rateMin}${rate.rateMax !== rate.rateMin ? `-${rate.rateMax}` : ""} ${unitLabel[rate.rateUnit]}`,
        applicationMethod: method,
        applicationMethods: methods,
        rateMode: rate.rateMode,
        rateUnit: rate.rateUnit,
        rateMin: rate.rateMin,
        rateMax: rate.rateMax,
        coverageM2PerLitre:
          rate.rateUnit === "M2_PER_L" ? midpointRate : null,
        coverageBasis,
        coverageType,
        recommendedCoats: coats,
        recommendedCoatsMin: coats,
        recommendedCoatsMax: coats,
        recommendedDftMicrons: dft,
        recommendedWftMicrons: wft,
        containerSizeLitres: null,
        thicknessMin: thickness?.min ?? dft ?? wft,
        thicknessMax: thickness?.max ?? dft ?? wft,
        thicknessUnit:
          thickness?.unit ?? (dft !== null || wft !== null ? "MICRON" : null),
        manufacturerRateLabel,
        sourceSnippet: context.slice(0, 500),
        sourcePage: page.pageNumber,
        note: "Auto-extracted using the unit-aware rule-based parser. Verify values before approval.",
        confidence: calculateConfidence({
          coverage: midpointRate,
          coverageBasis,
          coverageType,
          coats,
          method,
          dft,
          wft,
          sourcePage: page.pageNumber,
        }),
      };

      addOrMergeProfile(profiles, profile);
    }
  }

  return profiles.sort(
    (a, b) =>
      (a.sourcePage ?? 999) - (b.sourcePage ?? 999) ||
      (b.confidence ?? 0) - (a.confidence ?? 0),
  );
}

function calculateConfidence(args: {
  coverage: number | null;
  coverageBasis: CoverageProfile["coverageBasis"];
  coverageType: CoverageProfile["coverageType"];
  coats: number | null;
  method: string | null;
  dft: number | null;
  wft: number | null;
  sourcePage: number | null;
}): number {
  let score = 0.45;

  if (args.coverage !== null) score += 0.15;
  if (args.coverageBasis !== null) score += 0.1;
  if (args.coverageType !== null) score += 0.1;
  if (args.coats !== null) score += 0.07;
  if (args.method !== null) score += 0.05;
  if (args.dft !== null) score += 0.03;
  if (args.wft !== null) score += 0.03;
  if (args.sourcePage !== null) score += 0.02;

  return Math.min(0.98, Math.round(score * 100) / 100);
}

function addOrMergeProfile(
  profiles: ParsedPaintTds["coverageProfiles"],
  incoming: CoverageProfile,
): void {
  const existingIndex = profiles.findIndex((profile) => {
    if (
      profile.rateUnit !== null &&
      incoming.rateUnit !== null &&
      profile.rateMin !== null &&
      incoming.rateMin !== null
    ) {
      return (
        profile.rateUnit === incoming.rateUnit &&
        Math.abs(profile.rateMin - incoming.rateMin) < 0.001 &&
        Math.abs(
          (profile.rateMax ?? profile.rateMin) -
            (incoming.rateMax ?? incoming.rateMin),
        ) < 0.001
      );
    }

    const existingCoverage = profile.coverageM2PerLitre;
    const incomingCoverage = incoming.coverageM2PerLitre;

    if (existingCoverage === null || incomingCoverage === null) {
      return profile.name === incoming.name;
    }

    return (
      Math.abs(existingCoverage - incomingCoverage) < 0.001 &&
      (profile.applicationMethod === incoming.applicationMethod ||
        profile.name === incoming.name)
    );
  });

  if (existingIndex === -1) {
    profiles.push(incoming);
    return;
  }

  const existing = profiles[existingIndex];

  profiles[existingIndex] = {
    ...existing,
    name:
      incoming.name.length > existing.name.length
        ? incoming.name
        : existing.name,
    applicationMethod: existing.applicationMethod ?? incoming.applicationMethod,
    applicationMethods: [
      ...new Set([
        ...existing.applicationMethods,
        ...incoming.applicationMethods,
      ]),
    ],
    rateMode: existing.rateMode ?? incoming.rateMode,
    rateUnit: existing.rateUnit ?? incoming.rateUnit,
    rateMin: existing.rateMin ?? incoming.rateMin,
    rateMax: existing.rateMax ?? incoming.rateMax,
    coverageBasis: existing.coverageBasis ?? incoming.coverageBasis,
    coverageType: existing.coverageType ?? incoming.coverageType,
    recommendedCoats: existing.recommendedCoats ?? incoming.recommendedCoats,
    recommendedCoatsMin:
      existing.recommendedCoatsMin ?? incoming.recommendedCoatsMin,
    recommendedCoatsMax:
      existing.recommendedCoatsMax ?? incoming.recommendedCoatsMax,
    recommendedDftMicrons:
      existing.recommendedDftMicrons ?? incoming.recommendedDftMicrons,
    recommendedWftMicrons:
      existing.recommendedWftMicrons ?? incoming.recommendedWftMicrons,
    containerSizeLitres:
      existing.containerSizeLitres ?? incoming.containerSizeLitres,
    thicknessMin: existing.thicknessMin ?? incoming.thicknessMin,
    thicknessMax: existing.thicknessMax ?? incoming.thicknessMax,
    thicknessUnit: existing.thicknessUnit ?? incoming.thicknessUnit,
    manufacturerRateLabel:
      existing.manufacturerRateLabel ?? incoming.manufacturerRateLabel,
    sourceSnippet: existing.sourceSnippet ?? incoming.sourceSnippet,
    sourcePage: existing.sourcePage ?? incoming.sourcePage,
    confidence: Math.max(existing.confidence ?? 0, incoming.confidence ?? 0),
  };
}

function applyDocumentDefaults(
  profiles: ParsedPaintTds["coverageProfiles"],
  fullText: string,
  packSizes: number[],
): ParsedPaintTds["coverageProfiles"] {
  const documentDft = detectThickness(fullText, "DFT");

  const documentWft = detectThickness(fullText, "WFT");

  const firstPack = packSizes[0] ?? null;

  return profiles.map((profile) => {
    const lowerName = profile.name.toLowerCase();

    let recommendedCoats = profile.recommendedCoats;

    let recommendedDft = profile.recommendedDftMicrons;

    let recommendedWft = profile.recommendedWftMicrons;

    if (
      lowerName.includes("theoretical") ||
      lowerName.includes("two-coat stipple")
    ) {
      recommendedCoats ??= 2;
      recommendedDft ??= documentDft;
      recommendedWft ??= documentWft;
    }

    if (lowerName.includes("one-coat stipple")) {
      recommendedCoats = 1;
      recommendedWft ??= 490;
    }

    if (lowerName.includes("even spray")) {
      recommendedCoats ??= 2;
    }

    return {
      ...profile,
      recommendedCoats,
      recommendedCoatsMin: profile.recommendedCoatsMin ?? recommendedCoats,
      recommendedCoatsMax: profile.recommendedCoatsMax ?? recommendedCoats,
      recommendedDftMicrons: recommendedDft,
      recommendedWftMicrons: recommendedWft,
      containerSizeLitres: profile.containerSizeLitres ?? firstPack,
    };
  });
}

export async function parsePaintTds(input: {
  fileName: string;
  pages: TdsPage[];
}): Promise<ParsedPaintTds> {
  const fullText = input.pages.map((page) => page.text).join("\n\n");

  const manufacturer = detectManufacturer(fullText);

  const productCode = detectProductCode(fullText);

  const heading = detectProductHeading(input.pages);

  const productName = buildCanonicalProductName({
    heading,
    fileName: input.fileName,
    productCode,
  });

  let packSizes = detectGenericPackSizes(fullText);
  if (!packSizes.length) {
    packSizes = detectPackSizes(fullText).map((quantity) => ({
      quantity,
      uom: "L" as const,
      label: `${quantity} L`,
    }));
  }
  const packSizesLitres = packSizes
    .filter((packSize) => packSize.uom === "L")
    .map((packSize) => packSize.quantity);

  const detectedProfiles = detectGenericRateProfiles(input.pages);
  if (!detectedProfiles.length) {
    detectedProfiles.push(
      ...detectCoverageProfiles(input.pages, packSizesLitres),
    );
  }

  const coverageProfiles = applyDocumentDefaults(
    detectedProfiles,
    fullText,
    packSizesLitres,
  );

  const warnings: string[] = [
    "Parsed with local rule-based extraction. Verify the extracted values before approval.",
  ];

  if (!manufacturer) {
    warnings.push("The manufacturer could not be detected.");
  }

  if (!productCode) {
    warnings.push("The product code could not be detected.");
  }

  if (!coverageProfiles.length) {
    warnings.push(
      "No explicit supported coverage or consumption values were detected in the PDF text.",
    );
  }

  if (coverageProfiles.some((profile) => profile.coverageBasis === null)) {
    warnings.push(
      "Some coverage profiles do not specify whether the rate is per coat or for the complete system.",
    );
  }

  if (coverageProfiles.some((profile) => profile.recommendedCoats === null)) {
    warnings.push(
      "Some coverage profiles do not specify the required number of coats.",
    );
  }

  const parsed: ParsedPaintTds = {
    product: {
      manufacturer,
      name: productName,
      productCode,
      description: detectDescription(fullText),
      packSizesLitres,
      packSizes,
    },
    source: {
      revision: detectRevision(fullText),
      revisionDate: detectRevisionDate(fullText),
    },
    coverageProfiles,
    warnings,
  };

  return parsedPaintTdsSchema.parse(parsed);
}
