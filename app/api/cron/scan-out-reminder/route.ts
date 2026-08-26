import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizedCron } from "@/lib/cronAuth";
import { sendExpoPush } from "@/lib/expoPush";
import { joburgTodayISO, startOfDayUTC } from "@/lib/dateUtc";

/**
 * Cron-callable reminder: pings each foreman whose crew has employees
 * scanned in today but not yet scanned out. Fires the same business logic
 * regardless of when it's called - the weekday/weekend split (15:45 SAST
 * weekdays, 14:45 SAST weekends) lives in the external scheduler as two
 * separate trigger times (13:45 UTC / 12:45 UTC), not in this route.
 *
 * GET /api/cron/scan-out-reminder?secret=YOUR_CRON_SECRET
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!authorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayISO = joburgTodayISO();
  const workDate = startOfDayUTC(todayISO);

  const pending = await prisma.attendanceScan.findMany({
    where: { workDate, scannedOutAt: null },
    select: {
      employee: { select: { firstName: true, lastName: true } },
      siteDay: {
        select: {
          foreman: { select: { id: true, userId: true } },
        },
      },
    },
  });

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, foremenNotified: 0, workDate: todayISO });
  }

  const byForeman = new Map<
    string,
    { userId: string; names: string[] }
  >();
  for (const scan of pending) {
    const foreman = scan.siteDay.foreman;
    const entry = byForeman.get(foreman.id) ?? { userId: foreman.userId, names: [] };
    entry.names.push(`${scan.employee.firstName} ${scan.employee.lastName}`.trim());
    byForeman.set(foreman.id, entry);
  }

  let foremenNotified = 0;

  for (const [, { userId, names }] of byForeman) {
    // Idempotency: don't re-notify a foreman who already got this reminder today.
    const already = await prisma.notification.findFirst({
      where: {
        userId,
        type: "SCAN_OUT_REMINDER",
        createdAt: { gte: workDate },
      },
      select: { id: true },
    });
    if (already) continue;

    const title = "Clock-out reminder";
    const message =
      names.length === 1
        ? `${names[0]} is still scanned in - remember to clock them out.`
        : `${names.length} of your team are still scanned in - remember to clock them out: ${names.join(", ")}`;

    await prisma.notification.create({
      data: { userId, type: "SCAN_OUT_REMINDER", title, message },
    });

    const pushTokens = await prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (pushTokens.length > 0) {
      await sendExpoPush(
        pushTokens.map((t) => t.token),
        { title, body: message, data: { type: "SCAN_OUT_REMINDER" } },
      );
    }

    foremenNotified++;
  }

  return NextResponse.json({
    ok: true,
    foremenNotified,
    foremenPending: byForeman.size,
    workDate: todayISO,
  });
}
