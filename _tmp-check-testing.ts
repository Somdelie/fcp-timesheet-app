import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  const now = new Date();
  console.log("Server 'now':", now.toISOString());
  console.log("startOfTodayLocal():", startOfTodayLocal().toISOString());

  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { qrCodeValue: { contains: "89C1AF8D650A1D8E", mode: "insensitive" } },
        { firstName: { contains: "testing", mode: "insensitive" } },
        { lastName: { contains: "ndlovu", mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, qrCodeValue: true, isActive: true },
  });
  console.log("Matching employees:", employees);

  for (const emp of employees) {
    const recentScans = await prisma.attendanceScan.findMany({
      where: { employeeId: emp.id },
      orderBy: { scannedAt: "desc" },
      take: 5,
      select: {
        id: true,
        workDate: true,
        scannedAt: true,
        direction: true,
        scannedOutAt: true,
        scanOutMethod: true,
        siteDay: { select: { foremanId: true } },
      },
    });
    console.log(`\nScans for ${emp.firstName} ${emp.lastName} (${emp.id}, code=${emp.qrCodeValue}):`);
    for (const s of recentScans) {
      console.log({
        id: s.id,
        workDate: s.workDate.toISOString(),
        scannedAt: s.scannedAt.toISOString(),
        direction: s.direction,
        scannedOutAt: s.scannedOutAt?.toISOString() ?? null,
        scanOutMethod: s.scanOutMethod,
        siteDayForemanId: s.siteDay.foremanId,
      });
    }

    const workDate = startOfTodayLocal();
    const matchingScan = await prisma.attendanceScan.findFirst({
      where: { employeeId: emp.id, workDate, direction: "IN" },
      select: { id: true, scannedOutAt: true },
    });
    console.log("scan-out-face query result for 'today':", matchingScan);
  }

  await prisma.$disconnect();
}

main();
