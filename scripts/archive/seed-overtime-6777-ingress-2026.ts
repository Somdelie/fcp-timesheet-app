import { prisma } from "../lib/prisma";

const SITE_CODE = "6777";
const FOREMAN_NAME = "Zwelithini Ndlovu";
const PRICE_LABEL = "Overtime";
const CREATED_BY_EMAIL = "admin@cautiousndlovu.co.za";
const BATCH_REF = "manual-overtime-6777-ingress-2026-05-20-06-26";

type OvertimeSeedRow = {
  workDate: string;
  code: string;
  hours: number;
};

const rows: OvertimeSeedRow[] = [
  { workDate: "2026-05-20", code: "Z+11", hours: 1 },
  { workDate: "2026-05-21", code: "Z+8", hours: 1 },
  { workDate: "2026-05-22", code: "Z+8", hours: 1 },
  { workDate: "2026-06-23", code: "Z+8", hours: 1 },
  { workDate: "2026-06-24", code: "Z+8", hours: 1 },
  { workDate: "2026-06-25", code: "Z+8", hours: 1 },
  { workDate: "2026-06-26", code: "Z+8", hours: 1 },
  { workDate: "2026-05-27", code: "Z+8", hours: 1 },
  { workDate: "2026-05-28", code: "Z+7", hours: 1 },
  { workDate: "2026-05-29", code: "Z+7", hours: 1 },
  { workDate: "2026-06-01", code: "Z+7", hours: 1 },
  { workDate: "2026-06-02", code: "Z+7", hours: 1 },
  { workDate: "2026-06-03", code: "Z+7", hours: 1 },
];

function dateUTC(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function employeeCountFromCode(code: string) {
  const match = code.trim().match(/^([^+]+)\+(\d+)$/);
  if (!match) throw new Error(`Invalid overtime code "${code}".`);

  const foremanPart = match[1].trim();
  const extraEmployees = Number(match[2]);
  return foremanPart === "0" ? extraEmployees : extraEmployees + 1;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const [site, price, foreman, createdBy] = await Promise.all([
    prisma.site.findUnique({
      where: { code: SITE_CODE },
      select: { id: true, code: true, name: true },
    }),
    prisma.overtimePrice.findFirst({
      where: { label: PRICE_LABEL, isActive: true },
      select: { id: true, label: true, rate: true },
    }),
    prisma.foreman.findFirst({
      where: { user: { name: { equals: FOREMAN_NAME, mode: "insensitive" } } },
      select: { id: true, user: { select: { name: true } } },
    }),
    prisma.user.findFirst({
      where: { email: CREATED_BY_EMAIL },
      select: { id: true, name: true, email: true },
    }),
  ]);

  if (!site) throw new Error(`Site ${SITE_CODE} not found.`);
  if (!price) throw new Error(`Active overtime price "${PRICE_LABEL}" not found.`);
  if (!foreman) throw new Error(`Foreman "${FOREMAN_NAME}" not found.`);
  if (!createdBy) throw new Error(`Admin user ${CREATED_BY_EMAIL} not found.`);

  const rate = Number(price.rate);
  console.log(
    `${apply ? "Applying" : "Previewing"} ${rows.length} overtime rows for ${site.code} - ${site.name}`,
  );
  console.log(`Foreman: ${foreman.user.name}`);
  console.log(`Price: ${price.label} @ R${rate}/hr`);

  for (const row of rows) {
    const employees = employeeCountFromCode(row.code);
    const totalCost = rate * employees * row.hours;
    console.log(
      `${row.workDate} ${row.code}: ${employees} employee${employees === 1 ? "" : "s"} x ${row.hours}h = R${totalCost.toFixed(2)}`,
    );
  }

  if (!apply) return;

  await prisma.$transaction(
    async (tx) => {
      await tx.overtimeEntry.deleteMany({
        where: {
          siteId: site.id,
          note: { contains: BATCH_REF },
        },
      });

      for (const row of rows) {
        const employees = employeeCountFromCode(row.code);
        await tx.overtimeEntry.create({
          data: {
            site: { connect: { id: site.id } },
            foreman: { connect: { id: foreman.id } },
            workDate: dateUTC(row.workDate),
            overtimePrice: { connect: { id: price.id } },
            rateAtCreation: rate,
            numberOfEmployees: employees,
            hoursWorked: row.hours,
            totalCost: rate * employees * row.hours,
            note: `${BATCH_REF}; ${FOREMAN_NAME}; ${row.code}`,
            createdByUser: { connect: { id: createdBy.id } },
          },
        });
      }
    },
    { timeout: 30000 },
  );

  const totalEmployeeHours = rows.reduce(
    (sum, row) => sum + employeeCountFromCode(row.code) * row.hours,
    0,
  );
  console.log(
    `Seeded ${rows.length} rows, ${totalEmployeeHours} employee-hours, R${(totalEmployeeHours * rate).toFixed(2)} total cost.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
