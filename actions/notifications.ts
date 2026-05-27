"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";

export type NotificationItem = {
  id: string;

  // Mix of scheduled notifications (computed) and persisted DB notifications (Prisma NotificationType)
  type:
    | "CLAIM_DUE"
    | "TASK_DUE"
    | "WEATHER_ALERT"
    | "PHOTO_REQUESTED"
    | "PHOTO_REJECTED"
    | "TIMESHEET_SUBMITTED"
    | "TIMESHEET_APPROVED"
    | "TIMESHEET_REJECTED"
    | "SITE_FINISHED"
    | "MATERIAL_ORDER"
    | "PAINT_50_PERCENT"
    | "PAINT_90_PERCENT"
    | "GENERAL";

  title: string;
  message: string;

  // UI currently doesn’t display these, but keep for future deep-linking / context.
  siteName: string;
  siteId: string;
};

// WMO code description for alerts
function wmoLabel(code: number): string {
  if (code <= 3) return "";
  if (code <= 49) return "Fog";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 84) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "";
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const auth = await requireServerAuth();

  const now = new Date();
  const tomorrowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const tomorrowEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2),
  );

  // 1. Sites where siteClaimDate is due tomorrow
  const claimDueSites = await prisma.site.findMany({
    where: {
      isActive: true,
      siteClaimDate: { gte: tomorrowStart, lt: tomorrowEnd },
    },
    select: { id: true, name: true, siteClaimDate: true },
  });

  const notifications: NotificationItem[] = [];

  for (const site of claimDueSites) {
    notifications.push({
      id: `claim-${site.id}`,
      type: "CLAIM_DUE",
      title: "Claim Date Due Tomorrow",
      message: `Site "${site.name}" has a claim date due tomorrow.`,
      siteName: site.name,
      siteId: site.id,
    });
  }

  // 2. Scheduler tasks due within the next 20 minutes
  const in20Min = new Date(now.getTime() + 20 * 60 * 1000);

  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const todayEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );

  const upcomingTasks = await prisma.schedulerTask.findMany({
    where: {
      userId: auth.userId,
      date: { gte: todayStart, lt: todayEnd },
      time: { not: null },
      column: { not: "done" },
    },
    select: { id: true, title: true, time: true, category: true },
  });

  for (const task of upcomingTasks) {
    if (!task.time) continue;

    // Parse "HH:mm" time and build a full Date for today
    const [hours, minutes] = task.time.split(":").map(Number);
    const taskDateTime = new Date(now);
    taskDateTime.setHours(hours, minutes, 0, 0);

    // Notify if the task is within 20 min from now (and not already past)
    if (taskDateTime >= now && taskDateTime <= in20Min) {
      notifications.push({
        id: `task-${task.id}`,
        type: "TASK_DUE",
        title: "Task Starting Soon",
        message: `"${task.title}" is due at ${task.time}.`,
        siteName: "",
        siteId: "",
      });
    }
  }

  // 4. Weather alerts – check tomorrow's forecast for heavy rain / storms
  try {
    const params = new URLSearchParams({
      latitude: "-26.2041",
      longitude: "28.0473",
      daily: [
        "weather_code",
        "precipitation_sum",
        "precipitation_probability_max",
      ].join(","),
      timezone: "Africa/Johannesburg",
      forecast_days: "2",
    });
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      { next: { revalidate: 900 } },
    );
    if (weatherRes.ok) {
      const weather = await weatherRes.json();
      const daily = weather.daily;
      // Index 1 = tomorrow
      if (daily && daily.time?.length > 1) {
        const code = daily.weather_code[1] as number;
        const precipMm = daily.precipitation_sum[1] as number;
        const precipProb = daily.precipitation_probability_max[1] as number;
        const tomorrowDate = daily.time[1] as string;
        const label = wmoLabel(code);

        // Alert if heavy rain (>10mm), thunderstorm (code>=95), or high probability rain (>60% & >5mm)
        const isHeavy = precipMm >= 10;
        const isStorm = code >= 95;
        const isLikelyRain = precipProb >= 60 && precipMm >= 5;

        if (isHeavy || isStorm || isLikelyRain) {
          const formatted = new Date(
            tomorrowDate + "T00:00:00",
          ).toLocaleDateString("en-ZA", {
            weekday: "long",
            day: "numeric",
            month: "short",
          });
          const detail = isStorm
            ? `Thunderstorms expected (${precipMm.toFixed(1)}mm, ${precipProb}% chance)`
            : `${label || "Rain"} expected – ${precipMm.toFixed(1)}mm (${precipProb}% chance)`;

          notifications.push({
            id: `weather-${tomorrowDate}`,
            type: "WEATHER_ALERT",
            title: `Heavy Weather – ${formatted}`,
            message: `${detail}. Plan outdoor work accordingly.`,
            siteName: "",
            siteId: "",
          });
        }
      }
    }
  } catch {
    // Weather fetch failed – skip silently
  }

  // 5. Persisted DB notifications (event-driven: photo rejection, timesheet submitted/rejected, etc.)
  // These drive the in-app bell and are also sent via Expo push.
  const dbNotifications = await prisma.notification.findMany({
    where: { userId: auth.userId },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      siteId: true,
      isRead: true,
      linkUrl: true,
      site: { select: { id: true, name: true } },
    },
  });

  const mappedDb = dbNotifications.map((n) => ({
    id: `db-${n.id}`,
    type: n.type as NotificationItem["type"],
    title: n.title,
    message: n.message,
    siteName: n.site?.name ?? "",
    siteId: n.siteId ?? "",
  }));

  return [...mappedDb, ...notifications];
}
