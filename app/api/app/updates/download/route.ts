import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";
import { fetchGithubReleaseAsset } from "@/lib/githubReleases";

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

// Proxies the active release's APK straight through from our private
// GitHub Releases repo — the mobile app only ever sees our own JWT-gated
// endpoint, never a GitHub URL or token. Only ever resolves whichever row
// is currently `isActive` for the platform, so an old/inactive release can
// never be fetched through this endpoint regardless of its id.
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
    select: { githubAssetId: true, version: true },
  });

  if (!release) {
    return NextResponse.json(
      { error: "No active release for this platform" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  let githubRes: Response;
  try {
    githubRes = await fetchGithubReleaseAsset(release.githubAssetId);
  } catch (e) {
    console.error("Failed to reach GitHub for release asset", e);
    return NextResponse.json(
      { error: "Could not reach the release storage backend" },
      { status: 502, headers: CORS_HEADERS },
    );
  }

  if (!githubRes.ok || !githubRes.body) {
    console.error(
      `GitHub returned ${githubRes.status} for release ${release.version} (asset ${release.githubAssetId})`,
    );
    return NextResponse.json(
      { error: "Release file is missing or unreachable" },
      { status: 502, headers: CORS_HEADERS },
    );
  }

  const contentLength = githubRes.headers.get("content-length");

  return new Response(githubRes.body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="firstclass-${release.version}.apk"`,
      ...(contentLength ? { "Content-Length": contentLength } : {}),
    },
  });
}
