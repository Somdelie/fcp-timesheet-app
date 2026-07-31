import { prisma } from "../lib/prisma";
import { computeDayRateAtScan } from "../lib/employeeDayRate";
import { getBlockedAttendanceScanEmployeeIds } from "../lib/attendanceScanBlocks";
import { writeAuditEvent } from "../lib/audit";

// One-off backfill: manual scans for real, confirmed-missing days from the
// previous fortnight (2026-07-04 .. 2026-07-17), sourced from the foreman's
// WhatsApp attendance notes and cross-checked against AttendanceScan before
// running. Each entry is the worker's OWN record, only for the specific
// day(s) they were confirmed present with no scan on file.

const ADMIN_USER_ID = "cmm1oolr7000078pvxhcb8gvx"; // Cautious Ndlovu (ADMIN)
const REASON = "Confirmed via foreman's WhatsApp attendance note; scan missed on site.";

type Entry = { employeeName: string; date: string; siteCode: string; foremanName: string };

const entries: Entry[] = [
  // Claitos Dube crew
  { employeeName: "Claitos Dube", date: "2026-07-04", siteCode: "6658", foremanName: "Claitos Dube" },
  { employeeName: "Claitos Dube", date: "2026-07-06", siteCode: "6801", foremanName: "Claitos Dube" },
  { employeeName: "Claitos Dube", date: "2026-07-07", siteCode: "6801", foremanName: "Claitos Dube" },
  { employeeName: "Bernard Ncube", date: "2026-07-04", siteCode: "6658", foremanName: "Claitos Dube" },
  { employeeName: "Bernard Ncube", date: "2026-07-06", siteCode: "6801", foremanName: "Claitos Dube" },
  { employeeName: "Bernard Ncube", date: "2026-07-07", siteCode: "6801", foremanName: "Claitos Dube" },
  { employeeName: "Bazibi Moyo", date: "2026-07-04", siteCode: "6658", foremanName: "Claitos Dube" },
  { employeeName: "Bazibi Moyo", date: "2026-07-06", siteCode: "6801", foremanName: "Claitos Dube" },
  { employeeName: "Bazibi Moyo", date: "2026-07-07", siteCode: "6801", foremanName: "Claitos Dube" },
  { employeeName: "Mxolisi Nyoni", date: "2026-07-04", siteCode: "6658", foremanName: "Claitos Dube" },
  { employeeName: "Thamani Zulu", date: "2026-07-07", siteCode: "6605", foremanName: "Claitos Dube" },

  // Ndodana Sibanda crew
  { employeeName: "Brendon Ndlovu", date: "2026-07-06", siteCode: "6782", foremanName: "Ndodana Sibanda" },
  { employeeName: "Brendon Ndlovu", date: "2026-07-07", siteCode: "6782", foremanName: "Ndodana Sibanda" },
  { employeeName: "Brendon Ndlovu", date: "2026-07-08", siteCode: "6782", foremanName: "Ndodana Sibanda" },
  { employeeName: "Busani Ndlovu", date: "2026-07-06", siteCode: "6782", foremanName: "Ndodana Sibanda" },
  { employeeName: "Michael Sibanda", date: "2026-07-09", siteCode: "6782", foremanName: "Ndodana Sibanda" },
  { employeeName: "Michael Sibanda", date: "2026-07-10", siteCode: "6782", foremanName: "Ndodana Sibanda" },
  { employeeName: "Michael Sibanda", date: "2026-07-11", siteCode: "6782", foremanName: "Ndodana Sibanda" },
  { employeeName: "Coster Ncube", date: "2026-07-10", siteCode: "6782", foremanName: "Ndodana Sibanda" },
  { employeeName: "Coster Ncube", date: "2026-07-11", siteCode: "6782", foremanName: "Ndodana Sibanda" },
  { employeeName: "Coster Ncube", date: "2026-07-17", siteCode: "6821", foremanName: "Ndodana Sibanda" },
  { employeeName: "Calvin Mtileni", date: "2026-07-12", siteCode: "6782", foremanName: "Ndodana Sibanda" },
];

function norm(s: string) {
  return s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function dateUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function main() {
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
  });
  const foremen = await prisma.foreman.findMany({
    include: { user: { select: { name: true } } },
  });
  const sites = await prisma.site.findMany({ select: { id: true, name: true, code: true } });

  const created: string[] = [];
  const skipped: string[] = [];
  const siteDayCache = new Map<string, string>();

  for (const entry of entries) {
    const employee = employees.find((e) => norm(`${e.firstName} ${e.lastName}`) === norm(entry.employeeName));
    const foreman = foremen.find((f) => norm(f.user.name ?? "") === norm(entry.foremanName));
    const site = sites.find((s) => s.code === entry.siteCode);

    if (!employee || !foreman || !site) {
      skipped.push(`${entry.employeeName} | ${entry.date} | RESOLUTION FAILED (employee=${!!employee}, foreman=${!!foreman}, site=${!!site})`);
      continue;
    }

    const workDate = dateUTC(entry.date);

    const blocked = await getBlockedAttendanceScanEmployeeIds({ siteId: site.id, employeeIds: [employee.id] });
    if (blocked.get(employee.id)) {
      skipped.push(`${entry.employeeName} | ${entry.date} | BLOCKED: ${blocked.get(employee.id)!.message}`);
      continue;
    }

    const existing = await prisma.attendanceScan.findFirst({ where: { employeeId: employee.id, workDate } });
    if (existing) {
      skipped.push(`${entry.employeeName} | ${entry.date} | ALREADY HAS A SCAN (id ${existing.id})`);
      continue;
    }

    const rateResult = await computeDayRateAtScan({
      employeeId: employee.id,
      foremanId: foreman.id,
      siteId: site.id,
      workDate,
    });

    const siteDayKey = `${site.id}|${foreman.id}|${entry.date}`;
    let siteDayId = siteDayCache.get(siteDayKey);
    if (!siteDayId) {
      const existingSiteDay = await prisma.siteDay.findFirst({
        where: { siteId: site.id, foremanId: foreman.id, workDate },
        select: { id: true },
      });
      if (existingSiteDay) {
        siteDayId = existingSiteDay.id;
      } else {
        const newSiteDay = await prisma.siteDay.create({
          data: { site: { connect: { id: site.id } }, foreman: { connect: { id: foreman.id } }, workDate },
          select: { id: true },
        });
        siteDayId = newSiteDay.id;
      }
      siteDayCache.set(siteDayKey, siteDayId);
    }

    const scan = await prisma.attendanceScan.create({
      data: {
        siteDay: { connect: { id: siteDayId } },
        employee: { connect: { id: employee.id } },
        workDate,
        site: { connect: { id: site.id } },
        dayRateAtScan: rateResult.dayRate as any,
        team: rateResult.team,
        qrPayload: employee.qrCodeValue ?? null,
        scanType: "MANUAL",
        manualReason: REASON,
        addedByForemanId: foreman.id,
      },
      select: { id: true, scannedAt: true, dayRateAtScan: true },
    });

    await writeAuditEvent({
      actorUserId: ADMIN_USER_ID,
      action: "MANUAL_SCAN",
      entity: "AttendanceScan",
      entityId: scan.id,
      metadata: {
        title: "Manual scan created (fortnight backfill)",
        description: `${entry.employeeName} scanned at ${site.name} (${entry.foremanName}) for ${entry.date}`,
        employeeId: employee.id,
        employeeName: entry.employeeName,
        siteId: site.id,
        siteName: site.name,
        foremanId: foreman.id,
        foremanName: entry.foremanName,
        workDate: entry.date,
        reason: REASON,
        href: "/admin/attendance-scans",
      },
    });

    created.push(`${entry.employeeName} | ${entry.date} | ${site.name} [${site.code}] | dayRate=${rateResult.dayRate} | scanId=${scan.id}`);
  }

  console.log(`\nCreated: ${created.length}`);
  created.forEach((l) => console.log(`  + ${l}`));
  console.log(`\nSkipped: ${skipped.length}`);
  skipped.forEach((l) => console.log(`  - ${l}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
