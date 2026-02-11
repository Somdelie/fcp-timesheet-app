import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { toISODate } from "@/lib/workdate";

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
    const periodParam = url.searchParams.get("period");
    const daysParam = url.searchParams.get("days");

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let startDate: Date;
    let endDate: Date;

    if (periodParam) {
      // Parse period format: "2026-01-31_2026-02-13"
      const [startISO, endISO] = periodParam.split("_");
      if (!startISO || !endISO) {
        return NextResponse.json(
          { error: "Invalid period format. Use YYYY-MM-DD_YYYY-MM-DD" },
          { status: 400 },
        );
      }
      startDate = new Date(`${startISO}T00:00:00Z`);
      endDate = new Date(`${endISO}T00:00:00Z`);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid date in period parameter" },
          { status: 400 },
        );
      }
    } else {
      // Fallback to days param (default 7, max 30)
      let days = daysParam ? parseInt(daysParam, 10) : 7;
      if (isNaN(days) || days < 1) days = 7;
      if (days > 30) days = 30;

      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    }

    const data = [] as { day: string; scans: number; sites: number }[];

    // Build array from startDate to endDate (inclusive), chronologically
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateISO = toISODate(currentDate);
      const baseDateFilter = { workDate: new Date(`${dateISO}T00:00:00Z`) };

      let scansCount = 0;
      let sitesCount = 0;

      // Only query for dates up to today (future days get 0)
      if (currentDate <= today) {
        [scansCount, sitesCount] = await Promise.all([
          prisma.attendanceScan.count({ where: baseDateFilter }),
          prisma.siteDay.count({ where: baseDateFilter }),
        ]);
      }

      // Format as "Feb 11"
      const dayLabel = currentDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });

      data.push({
        day: dayLabel,
        scans: scansCount,
        sites: sitesCount,
      });

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    console.log(
      "[admin weekly-attendance] response data",
      JSON.stringify(data),
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching admin weekly attendance:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
