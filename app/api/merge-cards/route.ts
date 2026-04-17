import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mergeCardsForPrinting } from "@/lib/merge-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role as string | undefined;

    if (!role || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const files = formData.getAll("cards");

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No card PDFs provided" },
        { status: 400 },
      );
    }

    const buffers: Buffer[] = [];
    for (const file of files) {
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Invalid file entry in form-data" },
          { status: 400 },
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      buffers.push(Buffer.from(arrayBuffer));
    }

    const mergedPdf = await mergeCardsForPrinting(buffers);
    const timestamp = Date.now();

    return new Response(new Uint8Array(mergedPdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cards_print_ready_${timestamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[merge-cards] error", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to merge cards" },
      { status: 500 },
    );
  }
}
