import { PDFDocument } from "pdf-lib";

const CARD_W_MM = 85.6;
const CARD_H_MM = 54;
const PT_PER_MM = 72 / 25.4;

export const cardW = CARD_W_MM * PT_PER_MM;
export const cardH = CARD_H_MM * PT_PER_MM;

const A4_W = 595;
const A4_H = 842;

const COLS = 2;
const ROWS = 4;
const CARDS_PER_SHEET = COLS * ROWS; // 8

const marginX = (A4_W - COLS * cardW) / 2;
const marginY = (A4_H - ROWS * cardH) / 2;

/**
 * Merges an array of 2-page worker card PDFs (page 0 = QR front, page 1 = photo back)
 * into a print-ready A4 PDF. Layout: 2 columns × 4 rows per sheet.
 * Back pages are mirror-flipped horizontally so duplex printing (Flip on Long Edge)
 * produces correctly aligned double-sided cards.
 */
type InputPdf = Buffer | { name: string; buffer: Buffer };

function pdfName(input: InputPdf, index: number) {
  return Buffer.isBuffer(input) ? `File ${index + 1}` : input.name;
}

function pdfBuffer(input: InputPdf) {
  return Buffer.isBuffer(input) ? input : input.buffer;
}

function assertPdfBuffer(input: InputPdf, index: number) {
  const buffer = pdfBuffer(input);
  const name = pdfName(input, index);
  const header = buffer.subarray(0, 5).toString("latin1");

  if (buffer.length === 0) {
    throw new Error(`${name} is empty. Please re-download that card PDF.`);
  }

  if (header !== "%PDF-") {
    throw new Error(
      `${name} is not a valid PDF. Please re-download it from the employee card download button.`,
    );
  }

  return buffer;
}

export async function mergeCardsForPrinting(
  inputPdfs: InputPdf[],
): Promise<Buffer> {
  const destDoc = await PDFDocument.create();
  const inputPdfBuffers = inputPdfs.map((input, index) =>
    assertPdfBuffer(input, index),
  );

  for (
    let batchStart = 0;
    batchStart < inputPdfBuffers.length;
    batchStart += CARDS_PER_SHEET
  ) {
    const batch = inputPdfBuffers.slice(
      batchStart,
      batchStart + CARDS_PER_SHEET,
    );

    // Load all source docs and embed their pages into the destination doc
    const frontEmbeds: (Awaited<ReturnType<PDFDocument["embedPdf"]>>[number] | null)[] = [];
    const backEmbeds: (Awaited<ReturnType<PDFDocument["embedPdf"]>>[number] | null)[] = [];

    for (const buf of batch) {
      const srcDoc = await PDFDocument.load(buf);
      const pageCount = srcDoc.getPageCount();

      if (pageCount >= 1) {
        const [front] = await destDoc.embedPdf(srcDoc, [0]);
        frontEmbeds.push(front);
      } else {
        frontEmbeds.push(null);
      }

      if (pageCount >= 2) {
        const [back] = await destDoc.embedPdf(srcDoc, [1]);
        backEmbeds.push(back);
      } else {
        backEmbeds.push(null);
      }
    }

    // --- Front sheet ---
    const frontSheet = destDoc.addPage([A4_W, A4_H]);
    for (let i = 0; i < batch.length; i++) {
      const embed = frontEmbeds[i];
      if (!embed) continue;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = marginX + col * cardW;
      // pdf-lib y origin is bottom-left; row 0 → bottom, row 3 → top
      const y = marginY + row * cardH;
      frontSheet.drawPage(embed, { x, y, width: cardW, height: cardH });
    }

    // --- Back sheet (columns mirrored for duplex "Flip on Long Edge") ---
    const backSheet = destDoc.addPage([A4_W, A4_H]);
    for (let i = 0; i < batch.length; i++) {
      const embed = backEmbeds[i];
      if (!embed) continue;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const mirroredCol = COLS - 1 - col;
      const x = marginX + mirroredCol * cardW;
      const y = marginY + row * cardH;
      backSheet.drawPage(embed, { x, y, width: cardW, height: cardH });
    }
  }

  const pdfBytes = await destDoc.save();
  return Buffer.from(pdfBytes);
}
