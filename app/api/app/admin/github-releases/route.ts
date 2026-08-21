import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { requireApiAuth } from "@/lib/apiAuth";
import { authOptions } from "@/lib/auth";
import { listGithubReleases } from "@/lib/githubReleases";

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

// Read-only convenience for the publish form: lists releases/assets already
// uploaded to GitHub so the admin can pick one instead of typing a numeric
// asset id by hand. Never touches AppRelease — GitHub is the source of
// truth for what's been uploaded, our DB is the source of truth for what's
// currently being served to devices.
export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  try {
    const releases = await listGithubReleases();
    return NextResponse.json({ ok: true, releases }, { headers: CORS_HEADERS });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to list GitHub releases",
      },
      { status: 502, headers: CORS_HEADERS },
    );
  }
}
