import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const logFile = path.join(process.cwd(), "var", "site-photo-uploads.log");
    if (!fs.existsSync(logFile)) {
      return NextResponse.json({ logs: [] });
    }

    const raw = fs.readFileSync(logFile, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const max = 200;
    const recent = lines.slice(-max).map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return { raw: l };
      }
    });

    return NextResponse.json({ logs: recent });
  } catch (e: any) {
    console.error("[upload-logs] failed to read logs", e);
    return NextResponse.json({ error: "Failed to read logs" }, { status: 500 });
  }
}
