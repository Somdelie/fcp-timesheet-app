import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse");

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;
  if (!session || !["ADMIN", "OFFICE"].includes(role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("pdf");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No PDF provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer } as any);
  const result = await parser.getText();
  await parser.destroy();
  const text: string = result.text;

  const lines = text.split("\n").map((l: string, i: number) => `[${i}] ${JSON.stringify(l)}`);

  return NextResponse.json({ raw: text, lines });
}
