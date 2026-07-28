// prisma/seed-appoint-foreman-assistants.ts
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_DAY_RATE = 250;

const FOREMAN_ASSISTANTS = [
  {
    foremanName: "Fanuel Ngwenya",
    assistants: [
      {
        name: "Mbusiseni Ndlovu",
        email: "mbusiseni@gmail.com",
        password: "Mbusiseni@2026",
      },
      {
        name: "Balungile Fube",
        email: "balungile@gmail.com",
        password: "Balungile@2026",
      },
    ],
  },
  {
    foremanName: "Israel Dube",
    assistants: [
      {
        name: "Hloniphani Nksla",
        email: "nkala@gmail.com",
        password: "Noala@2026",
      },
    ],
  },
  {
    foremanName: "Fortune Ncube",
    assistants: [
      {
        name: "Ephias Moyo",
        email: "ephias@gmail.com",
        password: "Ephias@2026",
      },
    ],
  },
] as const;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function makeEmployeeQrCode() {
  return `EMP-${randomBytes(8).toString("hex").toUpperCase()}`;
}

async function findForemanByName(name: string) {
  return prisma.foreman.findFirst({
    where: {
      user: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    },
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

async function ensureAssistantUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, name: true },
  });

  if (existingUser) {
    if (existingUser.role !== "FOREMAN") {
      throw new Error(
        `User ${email} exists with role ${existingUser.role}. Expected FOREMAN for assistant login.`,
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: input.name,
        password: passwordHash,
      },
    });

    return { userId: existingUser.id, created: false };
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      password: passwordHash,
      role: "FOREMAN",
    },
    select: { id: true },
  });

  return { userId: user.id, created: true };
}

async function ensureAssistantForeman(userId: string) {
  const existing = await prisma.foreman.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (existing) return { foremanId: existing.id, created: false };

  const created = await prisma.foreman.create({
    data: { user: { connect: { id: userId } } },
    select: { id: true },
  });

  return { foremanId: created.id, created: true };
}

async function ensureAssistantEmployee(userId: string, fullName: string) {
  const existingLinked = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (existingLinked) {
    await prisma.employee.update({
      where: { id: existingLinked.id },
      data: {
        isActive: true,
        defaultDayRate: DEFAULT_DAY_RATE,
      },
    });

    return { employeeId: existingLinked.id, created: false };
  }

  const { firstName, lastName } = splitName(fullName);

  const existingByName = await prisma.employee.findFirst({
    where: {
      userId: null,
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existingByName) {
    await prisma.employee.update({
      where: { id: existingByName.id },
      data: {
        userId,
        isActive: true,
        defaultDayRate: DEFAULT_DAY_RATE,
      },
    });

    return { employeeId: existingByName.id, created: false };
  }

  const employee = await prisma.employee.create({
    data: {
      firstName,
      lastName,
      qrCodeValue: makeEmployeeQrCode(),
      defaultDayRate: DEFAULT_DAY_RATE,
      user: { connect: { id: userId } },
      createdByUser: { connect: { id: userId } },
      isActive: true,
    },
    select: { id: true },
  });

  return { employeeId: employee.id, created: true };
}

async function linkAssistantToForeman(foremanId: string, employeeId: string) {
  await prisma.foremanAssistant.upsert({
    where: {
      foremanId_employeeId: {
        foremanId,
        employeeId,
      },
    },
    update: {
      endsOn: null,
    },
    create: {
      foreman: { connect: { id: foremanId } },
      employee: { connect: { id: employeeId } },
      startsOn: new Date(),
      endsOn: null,
    },
  });
}

async function main() {
  let linksCreatedOrUpdated = 0;

  for (const group of FOREMAN_ASSISTANTS) {
    const foreman = await findForemanByName(group.foremanName);

    if (!foreman) {
      throw new Error(`Foreman not found: ${group.foremanName}`);
    }

    if (
      normalizeName(foreman.user?.name) !== normalizeName(group.foremanName)
    ) {
      throw new Error(
        `Matched foreman name mismatch. Expected ${group.foremanName}, got ${foreman.user?.name ?? "(no name)"}`,
      );
    }

    console.log(
      `\nForeman: ${foreman.user?.name ?? group.foremanName} (${foreman.id})`,
    );

    for (const assistant of group.assistants) {
      const { userId, created: userCreated } =
        await ensureAssistantUser(assistant);
      const {
        foremanId: assistantForemanId,
        created: assistantForemanCreated,
      } = await ensureAssistantForeman(userId);
      const { employeeId, created: employeeCreated } =
        await ensureAssistantEmployee(userId, assistant.name);

      await linkAssistantToForeman(foreman.id, employeeId);

      linksCreatedOrUpdated += 1;

      console.log(
        [
          `  • Assistant: ${assistant.name}`,
          `email=${normalizeEmail(assistant.email)}`,
          `assistantForemanId=${assistantForemanId}`,
          `employeeId=${employeeId}`,
          userCreated ? "user=created" : "user=updated",
          assistantForemanCreated
            ? "assistantForeman=created"
            : "assistantForeman=existing",
          employeeCreated ? "employee=created" : "employee=existing-or-linked",
          "link=upserted",
        ].join(" | "),
      );
    }
  }

  console.log(
    `\nDone. Assistant links created/updated: ${linksCreatedOrUpdated}`,
  );
}

main()
  .catch((error) => {
    console.error("seed-appoint-foreman-assistants failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
