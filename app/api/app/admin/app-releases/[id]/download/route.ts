import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";
import { authOptions } from "@/lib/auth";
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

async function getAdminFromRequest(req: NextRequest) {
  const apiCtx = await requireApiAuth(req, ["ADMIN"]);
  if (apiCtx) {
    return { id: apiCtx.user.sub, role: apiCtx.user.role as string } as const;
  }

  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      const role = (session.user as any).role as string | undefined;
      if (role === "ADMIN") {
        return { id: (session.user as any).id as string, role } as const;
      }
    }
  } catch {
    // Ignore session errors and fall through to unauthorized
  }

  return null;
}

// Lets an admin re-download any published release's APK for verification —
// unlike /api/app/updates/download (which only ever serves the *active*
// release, to the mobile app), this is scoped by a specific AppRelease id
// so any historical release, active or not, can be pulled for a QA check.
// Same GitHub-proxying, same no-buffering streaming.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { id } = await params;

  const release = await prisma.appRelease.findUnique({
    where: { id },
    select: { githubAssetId: true, version: true, platform: true },
  });

  if (!release) {
    return NextResponse.json(
      { error: "Release not found" },
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
      "Content-Disposition": `attachment; filename="firstclass-${release.platform}-${release.version}.apk"`,
      ...(contentLength ? { "Content-Length": contentLength } : {}),
    },
  });
}
