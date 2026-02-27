import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/page-visit
 * Body: { path: string }
 *
 * Lightweight fire-and-forget admin page visit logger.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireServerAuth();
    if (auth.role !== "ADMIN") {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const path = typeof body?.path === "string" ? body.path.trim() : "";
    if (!path) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Best-effort, fire & forget — don't let failures block UI
    prisma.auditEvent
      .create({
        data: {
          actorUserId: auth.userId,
          action: "APP_OPEN",
          entity: "Dashboard",
          entityId: null,
          metadata: { path },
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
