// app/api/app/notifications/route.ts

import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 1800; // 30 minutes

export async function GET() {
  return NextResponse.json(
    {
      notifications: [],
      unreadCount: 0,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=1800, stale-while-revalidate=1800",
      },
    },
  );
}

export async function POST() {
  return NextResponse.json({ success: true });
}
