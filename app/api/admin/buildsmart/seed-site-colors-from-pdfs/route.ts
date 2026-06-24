import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { seedSitePaintColorsFromOrderPdfs } from "@/lib/procurement/sitePaintColorSeeder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role as string | undefined;
    if (!session || !["ADMIN", "OFFICE"].includes(role ?? "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const action = String(formData.get("action") ?? "parse");
    if (action !== "parse" && action !== "import") {
      return NextResponse.json(
        { error: 'action must be "parse" or "import"' },
        { status: 400 },
      );
    }

    const pdfEntries = formData.getAll("pdfs");
    if (!pdfEntries.length) {
      return NextResponse.json(
        { error: "No PDF files provided" },
        { status: 400 },
      );
    }
    if (pdfEntries.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Too many files (max ${MAX_FILES})` },
        { status: 400 },
      );
    }

    const pdfs: { fileName: string; buffer: Buffer }[] = [];
    for (const entry of pdfEntries) {
      if (!(entry instanceof File)) continue;
      if (entry.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `"${entry.name}" exceeds 10 MB limit` },
          { status: 400 },
        );
      }
      if (
        entry.type !== "application/pdf" &&
        !entry.name.toLowerCase().endsWith(".pdf")
      ) {
        continue;
      }
      const buffer = Buffer.from(await entry.arrayBuffer());
      if (!buffer.byteLength) continue;
      pdfs.push({ fileName: entry.name, buffer });
    }

    if (!pdfs.length) {
      return NextResponse.json(
        { error: "No valid PDF files provided" },
        { status: 400 },
      );
    }

    const { rows, parseFailures } = await seedSitePaintColorsFromOrderPdfs(
      pdfs,
      { write: action === "import" },
    );

    const summary = rows.reduce(
      (acc, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return NextResponse.json({
      action,
      summary: {
        files: pdfs.length,
        coloursDetected: rows.length,
        parseFailures: parseFailures.length,
        ...summary,
      },
      rows,
      parseFailures,
    });
  } catch (err) {
    console.error("seed-site-colors-from-pdfs error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 },
    );
  }
}
