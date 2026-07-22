import { cleanText } from "@/lib/buildsmart-parser";

let pdfParseModule: any = null;

async function getPDFParseModule() {
  if (!pdfParseModule) {
    pdfParseModule = await import("pdf-parse");
  }
  return pdfParseModule;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = await getPDFParseModule();
  const PDFParse = pdfParse.PDFParse || pdfParse.default;
  const parser = new PDFParse({ data: buffer } as { data: Buffer });
  const result = await parser.getText();
  await parser.destroy();
  return cleanText(result.text ?? "");
}
