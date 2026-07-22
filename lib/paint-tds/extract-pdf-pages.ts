import { extractText, getDocumentProxy } from "unpdf";

export type ExtractedPdf = {
  fullText: string;
  pages: Array<{
    pageNumber: number;
    text: string;
  }>;
};

function normalisePageText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export async function extractPdfPages(buffer: Buffer): Promise<ExtractedPdf> {
  if (!buffer.length) {
    throw new Error("The uploaded PDF is empty.");
  }

  try {
    const data = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );

    const pdf = await getDocumentProxy(data);
    const result = await extractText(pdf, { mergePages: false });

    const pages = result.text.map((pageText, index) => ({
      pageNumber: index + 1,
      text: normalisePageText(pageText),
    }));

    const usableText = pages
      .map((page) => page.text)
      .join("\n")
      .trim();

    if (usableText.length < 80) {
      throw new Error(
        "The PDF contains too little selectable text. It may be a scanned PDF and would require OCR.",
      );
    }

    const fullText = pages
      .map((page) => `--- PAGE ${page.pageNumber} ---\n${page.text}`)
      .join("\n\n");

    return {
      fullText,
      pages,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown PDF extraction error.";

    if (message.includes("password") || message.includes("encrypted")) {
      throw new Error(
        "The PDF is password-protected or encrypted and cannot be read.",
      );
    }

    if (
      message.includes("too little selectable text") ||
      message.includes("uploaded PDF is empty")
    ) {
      throw error;
    }

    throw new Error(`Unable to extract PDF text: ${message}`);
  }
}
