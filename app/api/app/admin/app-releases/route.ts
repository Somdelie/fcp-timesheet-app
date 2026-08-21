import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const platform =
    req.nextUrl.searchParams.get("platform")?.trim().toLowerCase() ||
    undefined;

  const releases = await prisma.appRelease.findMany({
    where: platform ? { platform } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, releases }, { headers: CORS_HEADERS });
}

// The APK itself is uploaded to GitHub Releases directly (github.com's own
// UI, or `gh release upload`) — this endpoint only records which asset to
// serve. No file ever passes through this route.
const CreateAppReleaseSchema = z.object({
  platform: z.string().trim().toLowerCase().default("android"),
  version: z.string().trim().min(1),
  versionCode: z.number().int().positive(),
  minVersionCode: z.number().int().positive(),
  githubAssetId: z.number().int().positive(),
  releaseNotes: z.array(z.string().trim().min(1)).default([]),
  isActive: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const json = await req.json().catch(() => null);
  const body = CreateAppReleaseSchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: body.error.flatten() },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const data = body.data;

  if (data.minVersionCode > data.versionCode) {
    return NextResponse.json(
      {
        error:
          "minVersionCode cannot be higher than versionCode for the same release",
      },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const release = await prisma.$transaction(async (tx) => {
    if (data.isActive) {
      await tx.appRelease.updateMany({
        where: { platform: data.platform, isActive: true },
        data: { isActive: false },
      });
    }

    return tx.appRelease.create({
      data: {
        platform: data.platform,
        version: data.version,
        versionCode: data.versionCode,
        minVersionCode: data.minVersionCode,
        githubAssetId: data.githubAssetId,
        releaseNotes: data.releaseNotes,
        isActive: data.isActive,
        createdByUserId: admin.id,
      },
    });
  });

  return NextResponse.json(
    { ok: true, release },
    { status: 201, headers: CORS_HEADERS },
  );
}
