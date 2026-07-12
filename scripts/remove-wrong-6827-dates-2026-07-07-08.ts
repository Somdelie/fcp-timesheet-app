import { prisma } from "../lib/prisma";

// Remove the incorrectly seeded scans we created on 07-07 and 07-08 for site 6827.
// The real scans from the QR system are already on 07-09 and 07-10 (shown in the timesheet).

async function main() {
  const apply = process.argv.includes("--apply");

  const site = await prisma.site.findFirst({
    where: { code: "6827" },
    select: { id: true, code: true, name: true },
  });
  if (!site) throw new Error("Site 6827 not found");

  const scans = await prisma.attendanceScan.findMany({
    where: {
      siteId: site.id,
      workDate: {
        gte: new Date("2026-07-07T00:00:00.000Z"),
        lte: new Date("2026-07-08T00:00:00.000Z"),
      },
    },
    select: {
      id: true,
      workDate: true,
      scanType: true,
      manualReason: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { workDate: "asc" },
  });

  console.log(
    `\n${apply ? "Applying" : "Previewing"} cleanup for incorrectly seeded scans on 6827 (07-07 and 07-08)`,
  );
  console.log(`Scans found: ${scans.length}`);

  for (const s of scans) {
    console.log(
      `  ${apply ? "DELETE" : "WOULD DELETE"} ${s.workDate.toISOString().slice(0, 10)} | ${s.employee.firstName} ${s.employee.lastName} | ${s.scanType}${s.manualReason ? " | " + s.manualReason.slice(0, 60) : ""}`,
    );
    if (apply) {
      await prisma.attendanceScan.delete({ where: { id: s.id } });
    }
  }

  console.log(
    `\nDone. ${apply ? "Deleted" : "Would delete"} ${scans.length} scans.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
