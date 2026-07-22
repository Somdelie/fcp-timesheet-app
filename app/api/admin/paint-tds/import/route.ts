import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { extractPdfPages } from "@/lib/paint-tds/extract-pdf-pages";
import { parsePaintTds } from "@/lib/paint-tds/parse-paint-tds";
import { requireAdmin } from "@/lib/paint-tds/require-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILES = 100;
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await requireAdmin();
  const formData = await request.formData();

  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);

  if (!files.length) {
    return NextResponse.json(
      { error: "No PDF files provided." },
      { status: 400 },
    );
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} PDFs per batch.` },
      { status: 400 },
    );
  }

  const results: Array<{
    id: string;
    fileName: string;
    status: "needs-review" | "failed";
    error?: string;
  }> = [];

  for (const file of files) {
    const row = await prisma.paintTdsImport.create({
      data: {
        fileName: file.name,
        fileUrl: null,
        status: "UPLOADED",
        uploadedByUserId: user.id,
      },
    });

    try {
      if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
      ) {
        throw new Error("Only PDF files are supported.");
      }

      if (file.size > MAX_BYTES) {
        throw new Error("PDF exceeds the 20 MB limit.");
      }

      await prisma.paintTdsImport.update({
        where: { id: row.id },
        data: { status: "EXTRACTING" },
      });

      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractPdfPages(buffer);

      await prisma.paintTdsImport.update({
        where: { id: row.id },
        data: {
          status: "PARSING",
          extractedText: extracted.fullText,
        },
      });

      const parsed = await parsePaintTds({
        fileName: file.name,
        pages: extracted.pages,
      });

      await prisma.$transaction(async (tx) => {
        await tx.paintTdsImportProfile.deleteMany({
          where: { importId: row.id },
        });

        await tx.paintTdsImport.update({
          where: { id: row.id },
          data: {
            status: "NEEDS_REVIEW",
            manufacturerDetected: parsed.product.manufacturer,
            productCodeDetected: parsed.product.productCode,
            productNameDetected: parsed.product.name,
            descriptionDetected: parsed.product.description,
            revisionDetected: parsed.source.revision,
            revisionDateDetected: parsed.source.revisionDate
              ? new Date(parsed.source.revisionDate)
              : null,
            packSizesLitres: parsed.product.packSizesLitres,
            packSizes: parsed.product.packSizes as Prisma.InputJsonValue,
            parsedJson: parsed as Prisma.InputJsonValue,
            warnings: parsed.warnings as Prisma.InputJsonValue,
          },
        });

        if (parsed.coverageProfiles.length) {
          await tx.paintTdsImportProfile.createMany({
            data: parsed.coverageProfiles.map((profile, index) => ({
              importId: row.id,
              name: profile.name,
              applicationMethod: profile.applicationMethod,
              applicationMethods:
                profile.applicationMethods as Prisma.InputJsonValue,
              rateMode: profile.rateMode,
              rateUnit: profile.rateUnit,
              rateMin: profile.rateMin,
              rateMax: profile.rateMax,
              coverageM2PerLitre: profile.coverageM2PerLitre,
              coverageBasis: profile.coverageBasis,
              coverageType: profile.coverageType,
              recommendedCoats: profile.recommendedCoats,
              recommendedCoatsMin: profile.recommendedCoatsMin,
              recommendedCoatsMax: profile.recommendedCoatsMax,
              recommendedDftMicrons: profile.recommendedDftMicrons,
              recommendedWftMicrons: profile.recommendedWftMicrons,
              thicknessMin: profile.thicknessMin,
              thicknessMax: profile.thicknessMax,
              thicknessUnit: profile.thicknessUnit,
              manufacturerRateLabel: profile.manufacturerRateLabel,
              sourceSnippet: profile.sourceSnippet,
              sourcePage: profile.sourcePage,
              note: profile.note,
              confidence: profile.confidence,
              isSelected: index === 0,
            })),
          });
        }
      });

      results.push({
        id: row.id,
        fileName: file.name,
        status: "needs-review",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown import error";

      await prisma.paintTdsImport.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          errorMessage: message,
        },
      });

      results.push({
        id: row.id,
        fileName: file.name,
        status: "failed",
        error: message,
      });
    }
  }

  return NextResponse.json({ results });
}
