import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

// Any authenticated app role can check for updates — this isn't
// admin-gated data, just the current release info for their platform.
export async function GET(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const platform =
    req.nextUrl.searchParams.get("platform")?.trim().toLowerCase() ||
    "android";

  const release = await prisma.appRelease.findFirst({
    where: { platform, isActive: true },
    orderBy: { versionCode: "desc" },
    select: {
      version: true,
      versionCode: true,
      minVersionCode: true,
      releaseNotes: true,
      createdAt: true,
    },
  });

  if (!release) {
    return NextResponse.json(
      { ok: true, release: null },
      { headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      release: {
        version: release.version,
        versionCode: release.versionCode,
        minVersionCode: release.minVersionCode,
        releaseNotes: release.releaseNotes,
        publishedAt: release.createdAt.toISOString(),
      },
    },
    { headers: CORS_HEADERS },
  );
}
