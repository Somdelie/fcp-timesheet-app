import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyApiToken } from "@/lib/jwt";
import { runSiteDayPhotoCleanupInternal } from "@/actions/site-day-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdminFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (payload && payload.role === "ADMIN") {
      return { id: payload.sub, role: "ADMIN" as const };
    }
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (session?.user && role === "ADMIN") {
    return { id: (session.user as any).id as string, role: "ADMIN" as const };
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const admin = await getAdminFromRequest(req);

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const maxAgeParam = url.searchParams.get("maxAgeDays");
    const parsed = maxAgeParam ? Number.parseInt(maxAgeParam, 10) : NaN;
    const maxAgeDays = !Number.isNaN(parsed) && parsed > 0 ? parsed : 5;

    const result = await runSiteDayPhotoCleanupInternal(maxAgeDays);

    return NextResponse.json({
      ok: result.ok,
      deletedCount: result.deletedCount,
      maxAgeDays,
    });
  } catch (e: any) {
    console.error("Site-day photo cleanup error", e);
    return NextResponse.json(
      { error: e?.message ?? "Internal Server Error" },
      { status: 500 },
    );
  }
}
