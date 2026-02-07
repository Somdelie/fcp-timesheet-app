import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

async function getForeman(req: Request) {
  const token = getBearer(req);
  let userId: string | null = null;
  let role: string | null = null;

  if (token) {
    const payload = await verifyApiToken(token);
    if (!payload) return null;
    userId = payload.sub;
    role = payload.role;
  } else {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    userId = user?.id ?? null;
    role = user?.role ?? null;
  }

  if (!userId || role !== "FOREMAN") return null;

  return await prisma.foreman.findUnique({
    where: { userId },
    select: { id: true },
  });
}

// DELETE: Remove an assistant (soft delete by setting endsOn)
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ employeeId: string }> },
) {
  const foreman = await getForeman(req);
  if (!foreman) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { employeeId } = await ctx.params;

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 },
      );
    }

    const existing = await prisma.foremanAssistant.findUnique({
      where: { foremanId_employeeId: { foremanId: foreman.id, employeeId } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Assistant not found" },
        { status: 404 },
      );
    }

    // Soft delete by setting endsOn
    const updated = await prisma.foremanAssistant.update({
      where: { foremanId_employeeId: { foremanId: foreman.id, employeeId } },
      data: { endsOn: new Date() },
    });

    return NextResponse.json({ success: true, assistant: updated });
  } catch (error: any) {
    console.error("DELETE /api/app/foreman/assistants/[employeeId]", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove assistant" },
      { status: 500 },
    );
  }
}
