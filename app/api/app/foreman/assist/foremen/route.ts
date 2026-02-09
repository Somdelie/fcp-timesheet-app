import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/app/foreman/assist/foremen
 *
 * List available foremen for the current user.
 * - If user is a real foreman: returns [{ foremanId, name }]
 * - If user is an assistant: returns all active linked foremen
 * - If user has no foreman role: returns 403
 */
export async function GET(req: Request) {
  // --- auth ---
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const payload = await verifyApiToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (payload.role !== "FOREMAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = payload.sub;
  const now = new Date();

  // Check if user is a real foreman
  const realForeman = await prisma.foreman.findUnique({
    where: { userId },
    select: { id: true, user: { select: { name: true } } },
  });

  if (realForeman) {
    // User is a real foreman - return themselves
    return NextResponse.json({
      ok: true,
      foremen: [
        {
          foremanId: realForeman.id,
          name: realForeman.user.name || "Foreman",
        },
      ],
    });
  }

  // Check if user is an employee (assistant)
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!employee) {
    // User is neither foreman nor employee
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all active ForemanAssistant links
  const links = await prisma.foremanAssistant.findMany({
    where: {
      employeeId: employee.id,
      startsOn: { lte: now },
      OR: [{ endsOn: null }, { endsOn: { gt: now } }],
    },
    select: {
      foreman: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (links.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const foremen = links.map((link) => ({
    foremanId: link.foreman.id,
    name: link.foreman.user.name || "Foreman",
  }));

  return NextResponse.json({
    ok: true,
    foremen,
  });
}
