import { prisma } from "../lib/prisma";

const PERIOD_START = new Date("2026-04-25T00:00:00Z");
const PERIOD_END   = new Date("2026-05-09T00:00:00Z");
const SITE_CODES   = ["6663", "6664"];

async function main() {
  // ── Sites ──────────────────────────────────────────────────────────────────
  const sites = await prisma.site.findMany({
    where: { code: { in: SITE_CODES } },
    select: { id: true, code: true, name: true },
  });
  console.log("=== SITES ===");
  for (const s of sites) console.log(`  ${s.code}  ${s.id}  ${s.name}`);

  const byId = Object.fromEntries(sites.map(s => [s.id, s]));

  // ── David (foreman + employee) ─────────────────────────────────────────────
  const david = await prisma.employee.findFirst({
    where: {
      firstName: { contains: "David",    mode: "insensitive" },
      lastName:  { contains: "Nkwinika", mode: "insensitive" },
    },
    select: { id: true, firstName: true, lastName: true },
  });
  console.log("\n=== DAVID EMPLOYEE RECORD ===");
  console.log(david ?? "NOT FOUND");

  // ── SiteDays David has at these two sites ─────────────────────────────────
  const siteDays = await prisma.siteDay.findMany({
    where: {
      foremanId: "cmnsi4jgc000509jun9gzljc6",
      siteId:    { in: sites.map(s => s.id) },
      workDate:  { gte: PERIOD_START, lt: PERIOD_END },
    },
    select: {
      id: true, workDate: true, siteId: true,
      scans: {
        select: {
          id: true,
          employeeId: true,
          workDate: true,
          overtimeType: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ siteId: "asc" }, { workDate: "asc" }],
  });

  console.log("\n=== SITE DAYS + SCANS ===");
  console.log(`  (${siteDays.length} SiteDay records across both sites)\n`);

  for (const sd of siteDays) {
    const site = byId[sd.siteId];
    const date = sd.workDate.toISOString().slice(0, 10);
    const dow  = new Date(date + "T12:00:00Z").toLocaleDateString("en-ZA", { weekday: "short" });
    console.log(`  SiteDay ${sd.id}`);
    console.log(`    ${site?.code} ${site?.name}`);
    console.log(`    ${date} (${dow})  — ${sd.scans.length} scan(s)`);
    for (const scan of sd.scans) {
      const name = `${scan.employee?.firstName ?? "?"} ${scan.employee?.lastName ?? ""}`.trim();
      const isDavid = david && scan.employeeId === david.id ? " ← DAVID" : "";
      console.log(`      ${scan.id}  ${name}${isDavid}`);
    }
    console.log();
  }

  // ── Flat grid: who is where on which day ──────────────────────────────────
  console.log("=== ATTENDANCE GRID (Apr 25 – May 8) ===");
  const header = "Date       Dow  Site  Workers";
  console.log(header);
  console.log("-".repeat(70));

  const allScans = siteDays.flatMap(sd =>
    sd.scans.map(sc => ({
      date:    sc.workDate.toISOString().slice(0, 10),
      siteId:  sd.siteId,
      name:    `${sc.employee?.firstName ?? "?"} ${sc.employee?.lastName ?? ""}`.trim(),
      isDavid: david ? sc.employeeId === david.id : false,
    }))
  );

  // group by date+site
  const grid: Record<string, Record<string, string[]>> = {};
  for (const sc of allScans) {
    grid[sc.date] ??= {};
    grid[sc.date][sc.siteId] ??= [];
    grid[sc.date][sc.siteId].push(sc.isDavid ? `[D] ${sc.name}` : sc.name);
  }

  for (let d = new Date(PERIOD_START); d < PERIOD_END; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const dow = new Date(iso + "T12:00:00Z").toLocaleDateString("en-ZA", { weekday: "short" });
    const dayData = grid[iso];
    if (!dayData) {
      console.log(`${iso} ${dow}  (no data)`);
      continue;
    }
    for (const site of sites) {
      const workers = dayData[site.id] ?? [];
      if (workers.length === 0) continue;
      const davidMark = workers.some(w => w.startsWith("[D]")) ? "D+" : "0+";
      const crew = workers.filter(w => !w.startsWith("[D]"));
      console.log(`${iso} ${dow}  ${site.code}  ${davidMark}${crew.length}  | ${crew.join(", ") || "(foreman only)"}`);
    }
  }

  // ── David's own scan summary ───────────────────────────────────────────────
  if (david) {
    const davidScans = await prisma.attendanceScan.findMany({
      where: {
        employeeId: david.id,
        workDate:   { gte: PERIOD_START, lt: PERIOD_END },
      },
      select: { id: true, workDate: true, siteId: true, site: { select: { code: true, name: true } } },
      orderBy: { workDate: "asc" },
    });

    console.log(`\n=== DAVID'S OWN SCANS (${davidScans.length}) ===`);
    for (const s of davidScans) {
      const date = s.workDate.toISOString().slice(0, 10);
      const dow  = new Date(date + "T12:00:00Z").toLocaleDateString("en-ZA", { weekday: "short" });
      console.log(`  ${date} ${dow}  ${s.site?.code} ${s.site?.name}  scanId:${s.id}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
