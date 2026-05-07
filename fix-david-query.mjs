import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client/index.js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find David Nkwinika
  const employee = await prisma.employee.findFirst({
    where: { firstName: { contains: "David", mode: "insensitive" }, lastName: { contains: "Nkwinika", mode: "insensitive" } },
    select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
  });
  console.log("Employee:", employee);
  if (!employee) { console.log("Employee not found"); return; }

  // Find sites 6663 and 6664
  const sites = await prisma.site.findMany({
    where: { code: { in: ["6663", "6664"] } },
    select: { id: true, code: true, name: true },
  });
  console.log("Sites:", sites);

  // Get recent timesheet period
  const period = await prisma.timesheetPeriod.findFirst({
    orderBy: { startDate: "desc" },
    select: { id: true, startDate: true, endDate: true },
  });
  console.log("Latest period:", period);

  // Get David's scans for the last 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 45);
  const scans = await prisma.attendanceScan.findMany({
    where: {
      employeeId: employee.id,
      workDate: { gte: cutoff },
    },
    select: {
      id: true,
      workDate: true,
      siteId: true,
      overtimeType: true,
      site: { select: { code: true, name: true } },
      siteDay: { select: { foremanId: true } },
    },
    orderBy: { workDate: "asc" },
  });

  console.log(`\nDavid's scans (last 45 days): ${scans.length} records`);
  for (const s of scans) {
    const date = s.workDate.toISOString().slice(0, 10);
    console.log(`  ${date} | site: ${s.site?.code ?? s.siteId} ${s.site?.name ?? ""} | overtime: ${s.overtimeType}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
