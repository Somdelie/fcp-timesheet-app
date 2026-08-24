import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiToken } from "@/lib/jwt";
import { employeeWhereFor } from "@/lib/employee-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

// Same 5 poses as capture-reference.tsx / face-enrollments routes.
const REQUIRED_POSES = ["FRONT", "LEFT", "RIGHT", "SMILE", "NEUTRAL"] as const;

export type FaceStatus = "MISSING" | "PENDING" | "RECOGNISED";

function statusFor(enrollments: { pose: string; status: string }[]): {
  faceStatus: FaceStatus;
  completedPoses: number;
} {
  const approvedPoses = new Set(
    enrollments.filter((e) => e.status === "APPROVED").map((e) => e.pose),
  );
  const completedPoses = approvedPoses.size;

  if (completedPoses >= REQUIRED_POSES.length) {
    return { faceStatus: "RECOGNISED", completedPoses };
  }
  if (enrollments.length > 0) {
    // Some photos exist but the set isn't fully approved yet - either still
    // awaiting admin review, or a rejected pose needs a retake.
    return { faceStatus: "PENDING", completedPoses };
  }
  return { faceStatus: "MISSING", completedPoses: 0 };
}

/**
 * GET /api/app/supervisor/employees/face-status?show=active|all
 *
 * Backs the supervisor's Face Verification list (office-app's
 * (supervisor-stack)/face-verifications.tsx) - one row per employee in the
 * supervisor's scope (see lib/employee-scope.ts) with a rolled-up
 * MISSING / PENDING / RECOGNISED status, so the list can be filtered
 * without the client fetching each employee's enrollments individually.
 */
export async function GET(req: Request) {
  const token = getBearer(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await verifyApiToken(token);
  if (!payload || payload.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supervisor = await prisma.supervisor.findUnique({
    where: { userId: payload.sub },
    select: { id: true },
  });
  if (!supervisor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const show = url.searchParams.get("show");
  const activeFilter = show === "all" ? {} : { isActive: true };

  const employees = await prisma.employee.findMany({
    where: {
      ...employeeWhereFor({ userId: payload.sub, role: "SUPERVISOR" }),
      ...activeFilter,
    },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      faceImageUrl: true,
      isActive: true,
      faceEnrollments: { select: { pose: true, status: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    employees: employees.map((e) => {
      const { faceStatus, completedPoses } = statusFor(e.faceEnrollments);
      return {
        id: e.id,
        fullName: `${e.firstName} ${e.lastName}`.trim(),
        code: e.qrCodeValue,
        photoUrl: e.faceImageUrl ?? null,
        active: e.isActive,
        faceStatus,
        completedPoses,
        totalPoses: REQUIRED_POSES.length,
      };
    }),
  });
}
