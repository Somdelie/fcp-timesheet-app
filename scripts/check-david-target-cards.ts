import { prisma } from "../lib/prisma";

const cards = [
  "45BC57FE60D39843",
  "E09E1AF2E40448D8",
  "B5D18DB3EE220754",
  "973BA10701772C96",
  "A020015F9C941278",
  "96876795889B79B7",
  "D4000B9DE58F94E1",
  "BMR001",
];

async function main() {
  const rows = await prisma.employee.findMany({
    where: { qrCodeValue: { in: cards } },
    select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
