import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  rotateLogIfNeeded,
  listArchivedLogFiles,
  markFileImported,
} from "@/lib/sitePhotoLogUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: import archived log files into the DB. Query param `includeCurrent=true`
// will rotate the current working log into the archive before importing.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const url = new URL(req.url);
    const includeCurrent = url.searchParams.get("includeCurrent") === "true";

    const logDir = path.join(process.cwd(), "var");
    await fs.promises.mkdir(logDir, { recursive: true });
    const logFile = path.join(logDir, "site-photo-uploads.log");

    if (includeCurrent) {
      // rotate if present (only rotates when > default threshold)
      await rotateLogIfNeeded(logFile, 0); // 0 means always rotate current
    }

    const files = await listArchivedLogFiles(logDir);
    if (files.length === 0)
      return NextResponse.json({ imported: 0, files: [] });

    // Ensure Prisma model exists on the client
    const hasModel = (prisma as any).siteDayPhotoUploadLog;
    if (!hasModel) {
      return NextResponse.json(
        {
          error:
            "Prisma model SiteDayPhotoUploadLog not found. Create migration and run prisma generate before importing.",
        },
        { status: 400 },
      );
    }

    let totalImported = 0;
    const processedFiles: string[] = [];

    for (const filePath of files) {
      try {
        const raw = await fs.promises.readFile(filePath, "utf8");
        const lines = raw.split(/\r?\n/).filter(Boolean);
        const records: any[] = [];
        for (const l of lines) {
          try {
            const obj = JSON.parse(l);
            const rec = {
              ts: obj.ts ? new Date(obj.ts) : new Date(),
              durationMs: obj.durationMs ?? null,
              success: Boolean(obj.success),
              userId: obj.userId ?? null,
              actingForemanId: obj.actingForemanId ?? null,
              siteDayId: obj.siteDayId ?? null,
              cloudinaryPublicId:
                obj.cloudinaryPublicId ?? obj.publicId ?? null,
              imageUrl: obj.imageUrl ?? null,
              width: obj.width ?? null,
              height: obj.height ?? null,
              format: obj.format ?? null,
              errorText: obj.error ?? obj.errorText ?? null,
            };
            records.push(rec);
          } catch (e) {
            // ignore malformed line
          }
        }

        // insert in batches to avoid huge payloads
        const batchSize = 500;
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          if (batch.length === 0) continue;
          await (prisma as any).siteDayPhotoUploadLog.createMany({
            data: batch,
            skipDuplicates: true,
          });
          totalImported += batch.length;
        }

        // move file to imported subdir
        const dest = await markFileImported(filePath);
        processedFiles.push(
          path.basename(filePath) +
            (dest ? " -> imported" : " -> moved-failed"),
        );
      } catch (e: any) {
        console.error("import file failed", filePath, e);
      }
    }

    return NextResponse.json({
      imported: totalImported,
      files: processedFiles,
    });
  } catch (e: any) {
    console.error("import-logs error", e);
    return NextResponse.json(
      { error: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}
