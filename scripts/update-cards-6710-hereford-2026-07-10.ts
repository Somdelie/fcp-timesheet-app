import { prisma } from "../lib/prisma";

type CardUpdate = {
  firstName: string;
  lastName: string;
  qrCodeValue: string;
};

const cardUpdates: readonly CardUpdate[] = [
  {
    firstName: "Ntokozo",
    lastName: "Sibanda",
    qrCodeValue: "7753F4DB39F1B3EB",
  },
  {
    firstName: "Nduduzo",
    lastName: "Ncube",
    qrCodeValue: "E8CD77A978A96FA2",
  },
  {
    firstName: "Nduna",
    lastName: "Moyo",
    qrCodeValue: "05E0E4645007D1D6",
  },
  {
    firstName: "Xolisani",
    lastName: "Ncube",
    qrCodeValue: "E5B115037B1F23D7",
  },
  {
    firstName: "Willard",
    lastName: "Msebele",
    qrCodeValue: "52AB399DCC8C652E",
  },
  {
    firstName: "Godknows",
    lastName: "Msebele",
    qrCodeValue: "7E1A59B3CB618BB9",
  },
  {
    firstName: "Nomore",
    lastName: "Chimpap",
    qrCodeValue: "34031C0805D2030D",
  },
  {
    firstName: "Trust",
    lastName: "Tshuma",
    qrCodeValue: "87266AFECFA31690",
  },
  {
    firstName: "Langton",
    lastName: "Sibanda",
    qrCodeValue: "6A2393BE96F10578",
  },
  {
    firstName: "Matshidiso",
    lastName: "Kapok",
    qrCodeValue: "3E6249A2E2BABD34",
  },
  {
    firstName: "Gift",
    lastName: "Moyo",
    qrCodeValue: "667698EE662397B9",
  },
  {
    firstName: "Masonwabe",
    lastName: "Mabetu",
    qrCodeValue: "7583DB3450CBA484",
  },
] as const;

const NAME_ALIASES: Record<string, string> = {
  "xolisani ncube": "xolisani nc",
  "langton sibanda": "langton sib",
  "ntokozo sbanda": "ntokozo sibanda",
  "matshidiso kopan": "matshidiso kapok",
};

function normalizeName(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQr(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

async function main() {
  const apply = process.argv.includes("--apply");

  const preview: Array<{
    name: string;
    targetQr: string;
    action: "NO_CHANGE" | "UPDATE_CARD" | "CREATE_EMPLOYEE" | "SKIP";
    detail: string;
    employeeId?: string;
    createFirstName?: string;
    createLastName?: string;
  }> = [];

  for (const row of cardUpdates) {
    const rawFull = normalizeName(`${row.firstName} ${row.lastName}`);
    const resolvedFull = NAME_ALIASES[rawFull] ?? rawFull;
    const parts = resolvedFull.split(" ").filter(Boolean);
    const firstName = parts.slice(0, -1).join(" ") || parts[0] || "";
    const lastName = parts.at(-1) || "";
    const targetQr = normalizeQr(row.qrCodeValue);

    const employee = await prisma.employee.findFirst({
      where: {
        AND: [
          { firstName: { equals: firstName, mode: "insensitive" } },
          { lastName: { equals: lastName, mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
    });

    const cardOwner = await prisma.employee.findFirst({
      where: { qrCodeValue: targetQr },
      select: { id: true, firstName: true, lastName: true, qrCodeValue: true },
    });

    const displayName = `${row.firstName} ${row.lastName}`;

    if (employee) {
      if (normalizeQr(employee.qrCodeValue) === targetQr) {
        preview.push({
          name: displayName,
          targetQr,
          action: "NO_CHANGE",
          detail: `${employee.firstName} ${employee.lastName} already has this card`,
          employeeId: employee.id,
        });
        continue;
      }

      if (cardOwner && cardOwner.id !== employee.id) {
        preview.push({
          name: displayName,
          targetQr,
          action: "SKIP",
          detail: `Card already assigned to ${cardOwner.firstName} ${cardOwner.lastName}`,
          employeeId: employee.id,
        });
        continue;
      }

      preview.push({
        name: displayName,
        targetQr,
        action: "UPDATE_CARD",
        detail: `${employee.firstName} ${employee.lastName}: ${employee.qrCodeValue} -> ${targetQr}`,
        employeeId: employee.id,
      });
      continue;
    }

    if (cardOwner) {
      preview.push({
        name: displayName,
        targetQr,
        action: "SKIP",
        detail: `Card already assigned to ${cardOwner.firstName} ${cardOwner.lastName}`,
      });
      continue;
    }

    preview.push({
      name: displayName,
      targetQr,
      action: "CREATE_EMPLOYEE",
      detail: `Create employee ${firstName} ${lastName} with card ${targetQr}`,
      createFirstName: firstName,
      createLastName: lastName,
    });
  }

  console.log(
    `${apply ? "Applying" : "Previewing"} ${cardUpdates.length} Hereford card updates`,
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
      const first = row.createFirstName?.trim();
      const last = row.createLastName?.trim();
      if (!first || !last) continue;

      await prisma.employee.create({
        data: {
          firstName: first,
          lastName: last,
          qrCodeValue: row.targetQr,
          isActive: true,
        },
      });
      created += 1;
    }
  }

  console.log(
    `\nDone. Updated ${updated} cards. Created ${created} employees.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
