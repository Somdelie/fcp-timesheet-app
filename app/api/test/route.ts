import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const ctx = await requireApiAuth(req); // any authenticated user

  if (!ctx) {
    return NextResponse.json({ error: "Oops Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ message: "Test endpoint OK", user: ctx.user });
}
