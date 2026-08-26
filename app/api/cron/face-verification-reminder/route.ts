import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizedCron } from "@/lib/cronAuth";
import { sendExpoPush } from "@/lib/expoPush";
import { joburgTodayISO, startOfDayUTC } from "@/lib/dateUtc";

/**
 * Cron-callable reminder: once a day (morning), pings each foreman whose
 * crew has active employees with zero face enrollments submitted - the
 * same MISSING state shown on the Team screen (see
 * app/api/app/foreman/employees/face-status/route.ts). Employees with
 * photos already submitted but still PENDING approval are not the
 * foreman's action item, so they're excluded here.
 *
 * Scoped to each employee's ForemanEmployee link only, not the broader
 * "has attendance under this foreman" definition the Team screen list
 * uses - keeps one employee mapping to one foreman for this reminder.
 *
 * GET /api/cron/face-verification-reminder?secret=YOUR_CRON_SECRET
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dayStartUTC = startOfDayUTC(joburgTodayISO());

  const links = await prisma.foremanEmployee.findMany({
    where: { employee: { isActive: true } },
    select: {
      foreman: { select: { id: true, userId: true } },
      employee: {
        select: {
          firstName: true,
          lastName: true,
          faceEnrollments: { select: { id: true } },
        },
      },
    },
  });

  const byForeman = new Map<string, { userId: string; names: string[] }>();
  for (const link of links) {
    if (link.employee.faceEnrollments.length > 0) continue; // not MISSING

    const foreman = link.foreman;
    const entry = byForeman.get(foreman.id) ?? { userId: foreman.userId, names: [] };
    entry.names.push(`${link.employee.firstName} ${link.employee.lastName}`.trim());
    byForeman.set(foreman.id, entry);
  }

  let foremenNotified = 0;

  for (const [, { userId, names }] of byForeman) {
    // Idempotency: don't re-notify a foreman who already got this reminder today.
    const already = await prisma.notification.findFirst({
      where: {
        userId,
        type: "FACE_VERIFICATION_MISSING",
        createdAt: { gte: dayStartUTC },
      },
      select: { id: true },
    });
    if (already) continue;

    const title = "Face verification missing";
    const message =
      names.length === 1
        ? `${names[0]} still needs face verification photos captured.`
        : `${names.length} of your team still need face verification photos captured: ${names.join(", ")}`;

    await prisma.notification.create({
      data: { userId, type: "FACE_VERIFICATION_MISSING", title, message },
    });

    const pushTokens = await prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (pushTokens.length > 0) {
      await sendExpoPush(
        pushTokens.map((t) => t.token),
        { title, body: message, data: { type: "FACE_VERIFICATION_MISSING" } },
      );
    }

    foremenNotified++;
  }

  return NextResponse.json({
    ok: true,
    foremenNotified,
    foremenPending: byForeman.size,
  });
}
