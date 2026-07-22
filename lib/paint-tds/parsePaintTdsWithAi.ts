import {
  parsedPaintTdsSchema,
  type ParsedPaintTds,
} from "@/lib/paint-tds/schema";

const SYSTEM_PROMPT = `
You extract paint technical data sheet information.

Important calculation rules:

1. PER_COAT means the stated spreading rate applies separately to every coat.
   Example:
   4 m²/L with 2 coats means:
   litres = area × 2 ÷ 4.

2. TOTAL_SYSTEM means the stated spreading rate already includes the full
   application system.
   Example:
   total practical spreading rate of 1 m²/L means:
   litres = area ÷ 1.
   Do not multiply by the number of coats again.

3. Do not invent coverage values.

4. If the document only gives wet film thickness and no coverage,
   return no coverage profile and add a warning.

5. Extract separate profiles when different application methods have
   different spreading rates.

6. Include source page and confidence.

7. Treat theoretical spreading rate separately from practical spreading rate.
`;

function extractFirstJsonObject(input: string): string {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");

  if (start < 0 || end < 0 || end <= start) {
    throw new Error("AI response did not include JSON.");
  }

  return input.slice(start, end + 1);
}

function fallbackParse(
  fileName: string,
  text: string,
): ParsedPaintTds {
  const productCodeMatch = text.match(/\b([A-Z]{2,}\s?\d{2,})\b/);
  const revisionMatch = text.match(/revision\s*[:#]?\s*([\d.]+)/i);
  const dateMatch = text.match(
    /(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})/,
  );

  return {
    product: {
      name: fileName
        .replace(/\.pdf$/i, "")
        .replace(/[-_]+/g, " ")
        .trim(),
      productCode: productCodeMatch?.[1] ?? null,
      description: null,
      manufacturer: null,
      packSizesLitres: [],
      packSizes: [],
    },
    source: {
      revision: revisionMatch?.[1] ?? null,
      revisionDate: dateMatch?.[1] ?? null,
    },
    coverageProfiles: [],
    warnings: [
      "AI parsing is not configured. Set OPENAI_API_KEY to enable structured extraction.",
    ],
  };
}

export async function parsePaintTdsWithAi(input: {
  fileName: string;
  text: string;
}): Promise<ParsedPaintTds> {
  const fileName = input.fileName;
  const text = input.text.slice(0, 120_000);

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallbackParse(fileName, text);
  }

  const model = process.env.OPENAI_TDS_MODEL || "gpt-4.1-mini";

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              `File name: ${fileName}`,
              "",
              "Return strictly JSON matching the expected schema.",
              "If a field is unknown, use null or an empty array.",
              "",
              "PDF text:",
              text,
            ].join("\n"),
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `AI parsing failed (${response.status}): ${body.slice(0, 500)}`,
    );
  }

  const payload: unknown = await response.json();

  const raw =
    typeof payload === "object" &&
    payload !== null &&
    "choices" in payload &&
    Array.isArray((payload as { choices?: unknown }).choices)
      ? (
          payload as {
            choices: Array<{
              message?: { content?: unknown };
            }>;
          }
        ).choices[0]?.message?.content
      : null;

  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("AI parsing returned an empty response.");
  }

  const parsedJson: unknown = JSON.parse(
    extractFirstJsonObject(raw),
  );

  return parsedPaintTdsSchema.parse(parsedJson);
}
