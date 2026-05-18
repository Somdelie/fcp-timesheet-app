/**
 * Debug a BuildSmart ORDER PDF (PDF Orders tab format).
 * Usage: npx tsx scripts/debug-order-pdf.ts "C:\path\ORDER 68288.pdf"
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdfPath =
  process.argv[2] ?? "C:\\Users\\Cautious.FCP\\Downloads\\ORDER 68288.pdf";

function cleanText(input: string) {
  return input
    .replace(/\r/g, "\n")
    .replace(/[ \t\xa0]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function parseItemChunk(chunk: string) {
  const joined = chunk.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (!joined) return null;
  const costMatch = joined.match(/^(\d{6})\s*/);
  if (!costMatch) return null;
  const costCode = costMatch[1];
  let content = joined.slice(costMatch[0].length).trim();
  let unit = "";
  let quantity = 1;
  const uqMatch = content.match(/(each|\d+\s*[A-Z]{1,3})\s+(\d+)\s*$/i);
  if (uqMatch) {
    unit = uqMatch[1].replace(/\s/g, "");
    quantity = Number(uqMatch[2]);
    content = content.slice(0, uqMatch.index!).trim();
  }
  if (!content) return null;
  const codeMatch = content.match(/^([A-Z]{2,4}\s*[\d]+(?:\s*[\d]+)*[A-Z]*)/i);
  const productCode = codeMatch ? codeMatch[1].trim() : "";
  return { costCode, productCode, rawDescription: content, unit, quantity };
}

function extractItems(text: string, siteCode: string | null) {
  const contractMatch = text.match(/Contract\s*:\s*\d+\s*-\s*[^\n]+/);
  if (!contractMatch) return [];
  const startIdx = contractMatch.index! + contractMatch[0].length;
  const footerIdx = text.indexOf("Authorised Signatory", startIdx);
  const section = text
    .slice(startIdx, footerIdx !== -1 ? footerIdx : text.length)
    .trim();
  const escCode = (siteCode || "\\d{4}").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const delimiterPattern = new RegExp(`${escCode},\\s*Blank\\s+\\d+`, "g");
  const chunks = section
    .split(delimiterPattern)
    .map((s) => s.trim())
    .filter(Boolean);
  const items = [];
  for (const chunk of chunks) {
    const parsed = parseItemChunk(chunk);
    if (parsed) items.push(parsed);
  }
  return items;
}

async function main() {
  const { PDFParse } = require("pdf-parse");
  const buffer = readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  await parser.destroy();
  const text = cleanText(textResult.text);

  const orderNumber = text.match(/Purchase Order\(s\)\s*#\s*(\d+)/i)?.[1];
  const siteCode = text.match(/Contract\s*:\s*(\d+)/i)?.[1] ?? null;
  const siteName = text.match(/Contract\s*:\s*\d+\s*-\s*([^\n]+)/i)?.[1];
  const vendor = text.match(
    /Payment In\s*:\s*\n\d+[A-Z]*\n(.+)\n([A-Z]{2,}\d{2,})/,
  );

  console.log("=== ORDER PDF analysis ===\n");
  console.log("File:", pdfPath);
  console.log("Order #:", orderNumber);
  console.log("Site:", siteCode, "-", siteName);
  console.log("Vendor:", vendor?.[1], `(${vendor?.[2]})`);

  const items = extractItems(text, siteCode);
  console.log("\nParsed items:", items.length);
  items.forEach((it, i) => {
    console.log(`\n  [${i + 1}] costCode=${it.costCode} qty=${it.quantity} unit=${it.unit}`);
    console.log(`      productCode=${it.productCode}`);
    console.log(`      desc=${it.rawDescription.slice(0, 120)}`);
  });

  const amountRe = /\d{1,3}(?:[,\s]\d{3})*\.\d{2}|\d{5,}\.\d{2}/g;
  const amounts: number[] = [];
  for (const m of text.matchAll(amountRe)) {
    amounts.push(parseFloat(m[0].replace(/[\s,]/g, "")));
  }
  console.log("\nAll decimal amounts in PDF text:", amounts.length ? amounts : "(none)");
  console.log("Contains R361,102.54:", amounts.some((a) => Math.abs(a - 361102.54) < 0.01));

  if (amounts.length === 0) {
    console.log(
      "\n⚠ No Rate/Amount values in PDF text — PDF Orders import uses supplier price list, not PDF amounts.",
    );
  }
}

main().catch(console.error);
