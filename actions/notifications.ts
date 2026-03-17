"use server";

import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";

export type NotificationItem = {
  id: string;
  type: "CLAIM_DUE" | "COST_THRESHOLD" | "TASK_DUE" | "WEATHER_ALERT";
  title: string;
  message: string;
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

  // 2. Sites where total costs (wages + materials) >= R150,000
  const costSites = await prisma.site.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      attendanceScans: { select: { dayRateAtScan: true } },
      siteProductOrders: {
        select: {
          items: { select: { unitPriceAtOrder: true, quantity: true } },
        },
      },
    },
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

  const COST_THRESHOLD = 150_000;

  for (const site of costSites) {
    const totalWages = site.attendanceScans.reduce(
      (sum, scan) => sum + (Number(scan.dayRateAtScan) || 0),
      0,
    );
    const totalMaterialCost = site.siteProductOrders.reduce(
      (sum, order) =>
        sum +
        (order.items ?? []).reduce(
          (s2, item) =>
            s2 + (Number(item.unitPriceAtOrder) || 0) * (item.quantity || 0),
          0,
        ),
      0,
    );
    const totalCost = totalWages + totalMaterialCost;

    if (totalCost >= COST_THRESHOLD) {
      const formatted = new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
      }).format(totalCost);

      notifications.push({
        id: `cost-${site.id}`,
        type: "COST_THRESHOLD",
        title: "Site Costs Reached R150,000",
        message: `Site "${site.name}" has reached ${formatted} in total costs.`,
        siteName: site.name,
        siteId: site.id,
      });
    }
  }

  // 3. Scheduler tasks due within the next 20 minutes
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
  return notifications;
}
