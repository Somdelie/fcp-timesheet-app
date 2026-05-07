import { prisma } from "../lib/prisma";

async function main() {
  const employee = await prisma.employee.findFirst({
    where: { firstName: { contains: "David", mode: "insensitive" }, lastName: { contains: "Nkwinika", mode: "insensitive" } },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) { console.log("Not found"); return; }

  // Get all scans for the two sites in April-May
  const scans = await prisma.attendanceScan.findMany({
    where: {
      employeeId: employee.id,
      workDate: { gte: new Date("2026-04-01"), lte: new Date("2026-05-31") },
    },
    select: { id: true, workDate: true, siteId: true, site: { select: { code: true } } },
    orderBy: { workDate: "asc" },
  });

  // Find any periods that cover this range
  const periods = await prisma.timesheetPeriod.findMany({
    where: {
      startDate: { gte: new Date("2026-04-01") },
      endDate: { lte: new Date("2026-05-31") },
    },
    orderBy: { startDate: "asc" },
    select: { startDate: true, endDate: true },
  });
  console.log("Periods in Apr-May 2026:", periods.map(p => `${p.startDate.toISOString().slice(0,10)} → ${p.endDate.toISOString().slice(0,10)}`));

  // Print all scans
  console.log("\nAll David scans Apr-May 2026:");
  for (const s of scans) {
    const d = s.workDate.toISOString().slice(0, 10);
    const dow = new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short" });
    console.log(`  ${d} (${dow}) → ${s.site?.code} | id:${s.id}`);
  }

  // Group by 14-day windows starting from first scan
  const allDates = scans.map(s => s.workDate.toISOString().slice(0, 10));
  const firstDate = allDates[0];
  if (!firstDate) return;

  // Build grid for Apr 10 - May 7 (28 days = 2 fortnights)
  const start = new Date("2026-04-10T00:00:00Z");
  console.log("\n=== Grid: Apr 10 - May 7 ===");
  console.log("Date       | Day | Site");
  for (let i = 0; i < 28; i++) {
    const d = new Date(start.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dow = new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short" });
    const scan = scans.find(s => s.workDate.toISOString().slice(0, 10) === iso);
    const site = scan?.site?.code ?? "-";
    const marker = i === 13 ? " ← period boundary" : "";
    console.log(`  ${iso} | ${dow} | ${site}${marker}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
