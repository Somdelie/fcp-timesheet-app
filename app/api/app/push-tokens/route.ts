import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Auth: mobile/API Bearer token with allowed roles
    const ctx = await requireApiAuth(req, [
      "ADMIN",
      "SUPERVISOR",
      "FOREMAN",
      // Add other roles here if introduced later (e.g. ASSISTANT)
    ]);

    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null as any);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const rawToken = String((body as any).token ?? "").trim();
    const rawPlatform = (body as any).platform;
    const platform =
      rawPlatform === undefined || rawPlatform === null
        ? null
        : String(rawPlatform).trim() || null;

    if (!rawToken) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    // Upsert by token (token is unique) – always reassign to latest user
    await prisma.pushToken.upsert({
      where: { token: rawToken },
      update: {
        userId: ctx.user.sub,
        platform: platform ?? undefined,
      },
      create: {
        userId: ctx.user.sub,
        token: rawToken,
        platform: platform ?? undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/app/push-tokens POST error", error);
    return NextResponse.json(
      { error: "Failed to register push token" },
      { status: 500 },
    );
  }
}
