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
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
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

// Toggle which release is "live" without publishing a new one — the
// emergency lever if an active release turns out to be bad (e.g.
// re-activate the previous version). Does not edit any other field.
const PatchAppReleaseSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
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

  const json = await req.json().catch(() => null);
  const body = PatchAppReleaseSchema.safeParse(json);
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const existing = await prisma.appRelease.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Release not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const release = await prisma.$transaction(async (tx) => {
    if (body.data.isActive) {
      await tx.appRelease.updateMany({
        where: {
          platform: existing.platform,
          isActive: true,
          id: { not: id },
        },
        data: { isActive: false },
      });
    }

    return tx.appRelease.update({
      where: { id },
      data: { isActive: body.data.isActive },
    });
  });

  return NextResponse.json({ ok: true, release }, { headers: CORS_HEADERS });
}
