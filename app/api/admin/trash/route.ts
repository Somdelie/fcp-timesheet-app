import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type TrashRow = {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  description: string | null;
  metadata: unknown;
  deletedByUserId: string | null;
  deletedByName: string | null;
  deletedAt: Date;
  expiresAt: Date;
};

type AttendanceTrashMetadata = {
  attendanceScan?: {
    id: string;
    employeeId: string;
    employeeName?: string;
    siteId: string;
    siteDayId: string;
    workDateISO: string;
    scannedAtISO: string;
    scannedOutAtISO: string | null;
    direction: "IN" | "OUT";
    scanType: "REGULAR" | "MANUAL";
    dayRateAtScan: string;
    team: string | null;
    overtimeType: string;
    manualReason: string | null;
    transferredFromSiteId: string | null;
    transferredFromScanId: string | null;
    transferredAtISO: string | null;
  };
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      ),
    };
  }
  if (user.role !== "ADMIN") {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: CORS_HEADERS },
      ),
    };
  }

  return { ok: true as const, user };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  await prisma.$executeRaw`DELETE FROM "TrashItem" WHERE "expiresAt" <= NOW()`;

  const rows = await prisma.$queryRaw<TrashRow[]>`
    SELECT
      "id",
      "entityType",
      "entityId",
      "label",
      "description",
      "metadata",
      "deletedByUserId",
      "deletedByName",
      "deletedAt",
      "expiresAt"
    FROM "TrashItem"
    ORDER BY "deletedAt" DESC
  `;

  return NextResponse.json(
    {
      items: rows.map((row) => ({
        ...row,
        deletedAt: row.deletedAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      })),
    },
    { headers: CORS_HEADERS },
  );
}

export async function DELETE() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const deleted = await prisma.$executeRaw`DELETE FROM "TrashItem"`;

  return NextResponse.json(
    { ok: true, deleted },
    { headers: CORS_HEADERS },
  );
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Select at least one trash item to restore" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const restored: string[] = [];
  const failures: { id: string; label: string; error: string }[] = [];

  for (const id of ids) {
    const rows = await prisma.$queryRaw<TrashRow[]>`
      SELECT
        "id",
        "entityType",
        "entityId",
        "label",
        "description",
        "metadata",
        "deletedByUserId",
        "deletedByName",
        "deletedAt",
        "expiresAt"
      FROM "TrashItem"
      WHERE "id" = ${id}
      LIMIT 1
    `;
    const item = rows[0];

    if (!item) {
      failures.push({ id, label: "Unknown item", error: "Trash item not found" });
      continue;
    }

    if (item.entityType !== "attendance-scan") {
      failures.push({ id, label: item.label, error: "This item type cannot be restored yet" });
      continue;
    }

    const metadata = item.metadata as AttendanceTrashMetadata;
    const scan = metadata?.attendanceScan;

    if (!scan?.id || !scan.employeeId || !scan.siteId || !scan.siteDayId || !scan.workDateISO) {
      failures.push({ id, label: item.label, error: "Trash item is missing restore data" });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const existingById = await tx.attendanceScan.findUnique({
          where: { id: scan.id },
          select: { id: true },
        });
        if (existingById) {
          throw new Error("The original scan already exists");
        }

        const existingForEmployeeDate = await tx.attendanceScan.findUnique({
          where: {
            // Trashed scans predate ShiftType, so restore always targets the
            // DAY shift for that employee/date.
            employeeId_workDate_shiftType: {
              employeeId: scan.employeeId,
              workDate: new Date(scan.workDateISO),
              shiftType: "DAY",
            },
          },
          select: { id: true },
        });
        if (existingForEmployeeDate) {
          throw new Error("Employee already has a scan for that date");
        }

        const siteDay = await tx.siteDay.findUnique({
          where: { id: scan.siteDayId },
          select: { id: true },
        });
        if (!siteDay) {
          throw new Error("Original site day no longer exists");
        }

        await tx.attendanceScan.create({
          data: {
            id: scan.id,
            siteDay: { connect: { id: scan.siteDayId } },
            employee: { connect: { id: scan.employeeId } },
            workDate: new Date(scan.workDateISO),
            site: { connect: { id: scan.siteId } },
            scannedAt: new Date(scan.scannedAtISO),
            dayRateAtScan: scan.dayRateAtScan,
            team: scan.team,
            scanType: scan.scanType,
            direction: scan.direction,
            scannedOutAt: scan.scannedOutAtISO ? new Date(scan.scannedOutAtISO) : null,
            overtimeType: scan.overtimeType as any,
            manualReason: scan.manualReason,
            transferredFromSiteId: scan.transferredFromSiteId,
            transferredFromScanId: scan.transferredFromScanId,
            transferredAt: scan.transferredAtISO ? new Date(scan.transferredAtISO) : null,
          },
        } as any);

        await tx.$executeRaw`DELETE FROM "TrashItem" WHERE "id" = ${item.id}`;
      });

      restored.push(item.id);
    } catch (error) {
      failures.push({
        id: item.id,
        label: item.label,
        error: error instanceof Error ? error.message : "Failed to restore item",
      });
    }
  }

  return NextResponse.json(
    { ok: failures.length === 0, restored, failures },
    { status: failures.length > 0 && restored.length === 0 ? 409 : 200, headers: CORS_HEADERS },
  );
}
