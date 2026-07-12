import { prisma } from "../lib/prisma";

type CardUpdate = {
  name: string;
  qrCodeValue: string;
};

const cardUpdates: CardUpdate[] = [
  { name: "Felix Rivombo", qrCodeValue: "EMP-555D2970A70DD020" },
  { name: "Hector Mashimbye", qrCodeValue: "83E52E6B308D0CD4" },
  { name: "Thokozani Motha", qrCodeValue: "796889A33F6632C6" },
  { name: "Tankiso Moletsane", qrCodeValue: "83C14E110A0CC373" },
  { name: "Thabang Kapa", qrCodeValue: "96FBEE5F9891B7D8" },
  { name: "Thulani Majola", qrCodeValue: "8317B9CC955B812A" },
  { name: "Loyiso Mofukeng", qrCodeValue: "07BA3A95A62D3142" },
  { name: "Dingani Zondo", qrCodeValue: "37269B7F51971F44" },
  { name: "Sibusiso Makhafhula", qrCodeValue: "6B30ECD0F07E428A" },
  { name: "Walter Mabasa", qrCodeValue: "EC596F8E49128F94" },
];

// Known spelling normalizations from source messages.
const NAME_ALIASES: Record<string, string> = {
  "sibusiso makhafhula": "sibusiso makhafula",
};

function normalizeName(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  // Match admin bulk-seed logic.
  const lastName = parts.pop() ?? "";
  return { firstName: parts.join(" "), lastName };
}

function normalizeQr(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

async function resolveEmployeeByName(rawName: string) {
  const normalized = normalizeName(rawName);
  const aliasNormalized = NAME_ALIASES[normalized] ?? normalized;

  const all = await prisma.employee.findMany({
    select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
  });

  const direct = all.find(
    (e) => normalizeName(`${e.firstName} ${e.lastName}`) === aliasNormalized,
  );
  if (direct) return direct;

  const split = splitName(aliasNormalized);
  if (!split.firstName && !split.lastName) return null;

  const bySplit = await prisma.employee.findFirst({
    where: {
      AND: [
        { firstName: { equals: split.firstName, mode: "insensitive" } },
        { lastName: { equals: split.lastName, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
  });

  return bySplit;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const preview: Array<{
    name: string;
    targetQr: string;
    action: string;
    detail: string;
    employeeId?: string;
    createFirstName?: string;
    createLastName?: string;
  }> = [];

  for (const row of cardUpdates) {
    const targetQr = normalizeQr(row.qrCodeValue);
    const employee = await resolveEmployeeByName(row.name);

    if (!employee) {
      const takenBy = await prisma.employee.findFirst({
        where: { qrCodeValue: targetQr },
        select: { id: true, firstName: true, lastName: true },
      });

      if (takenBy) {
        preview.push({
          name: row.name,
          targetQr,
          action: "SKIP",
          detail: `Card already assigned to ${takenBy.firstName} ${takenBy.lastName}`,
        });
        continue;
      }

      const normalized = normalizeName(row.name);
      const aliasNormalized = NAME_ALIASES[normalized] ?? normalized;
      const split = splitName(aliasNormalized);

      if (!split.firstName || !split.lastName) {
        preview.push({
          name: row.name,
          targetQr,
          action: "SKIP",
          detail: "Invalid name format for employee creation",
        });
        continue;
      }

      preview.push({
        name: row.name,
        targetQr,
        action: "CREATE_EMPLOYEE",
        detail: `Create employee ${split.firstName} ${split.lastName} with card ${targetQr}`,
        createFirstName: split.firstName,
        createLastName: split.lastName,
      });
      continue;
    }

    if (normalizeQr(employee.qrCodeValue) === targetQr) {
      preview.push({
        name: row.name,
        targetQr,
        action: "NO_CHANGE",
        detail: `${employee.firstName} ${employee.lastName} already has this card`,
        employeeId: employee.id,
      });
      continue;
    }

    const takenBy = await prisma.employee.findFirst({
      where: {
        qrCodeValue: targetQr,
        id: { not: employee.id },
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (takenBy) {
      preview.push({
        name: row.name,
        targetQr,
        action: "SKIP",
        detail: `Card already assigned to ${takenBy.firstName} ${takenBy.lastName}`,
        employeeId: employee.id,
      });
      continue;
    }

    preview.push({
      name: row.name,
      targetQr,
      action: "UPDATE_CARD",
      detail: `${employee.firstName} ${employee.lastName}: ${employee.qrCodeValue} -> ${targetQr}`,
      employeeId: employee.id,
    });
  }

  console.log(
    `${apply ? "Applying" : "Previewing"} ${cardUpdates.length} card updates`,
  );
  for (const row of preview) {
    console.log(`- [${row.action}] ${row.name} | ${row.detail}`);
  }

  if (!apply) return;

  let updated = 0;
  let created = 0;
  for (const row of preview) {
    if (row.action === "UPDATE_CARD" && row.employeeId) {
      await prisma.employee.update({
        where: { id: row.employeeId },
        data: { qrCodeValue: row.targetQr, isActive: true },
      });
      updated += 1;
      continue;
    }

    if (row.action === "CREATE_EMPLOYEE") {
      const firstName = row.createFirstName?.trim();
      const lastName = row.createLastName?.trim();
      if (!firstName || !lastName) continue;

      await prisma.employee.create({
        data: {
          firstName,
          lastName,
          qrCodeValue: row.targetQr,
          isActive: true,
        },
      });
      created += 1;
    }
  }

  console.log(
    `\nDone. Updated ${updated} employee cards. Created ${created} employees.`,
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
