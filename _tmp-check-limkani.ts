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

  const employeeId = "cmm4ttcr7000309lb12oa4goc"; // Limkani Nyoni

  const recentScans = await prisma.attendanceScan.findMany({
    where: { employeeId },
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
  console.log("\nMost recent scans for Limkani Nyoni:");
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

  // Exactly what the scan-out-face endpoint queries
  const workDate = startOfTodayLocal();
  const matchingScan = await prisma.attendanceScan.findFirst({
    where: { employeeId, workDate, direction: "IN" },
    select: { id: true, scannedOutAt: true },
  });
  console.log("\nWhat scan-out-face's query finds for 'today':", matchingScan);

  await prisma.$disconnect();
}

main();
