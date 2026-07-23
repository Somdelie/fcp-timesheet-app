import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

function splitName(fullName: string | null | undefined) {
  const cleaned = (fullName ?? "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "Foreman",
    lastName: parts.slice(1).join(" "),
  };
}

function makeQrCode() {
  return `EMP-${randomBytes(8).toString("hex").toUpperCase()}`;
}

async function main() {
  const foremen = await prisma.foreman.findMany({
    select: {
      id: true,
      userId: true,
      defaultDayRate: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let alreadyLinked = 0;
  let linkedByName = 0;
  let createdProfiles = 0;
  let skipped = 0;

  for (const foreman of foremen) {
    const userName = foreman.user?.name ?? "";
    const userEmail = foreman.user?.email ?? "";

    const existingLinked = await prisma.employee.findUnique({
      where: { userId: foreman.userId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (existingLinked) {
      alreadyLinked += 1;
      continue;
    }

    const { firstName, lastName } = splitName(userName);

    // Try to link an existing unlinked employee with same name first.
    const existingByName = await prisma.employee.findFirst({
      where: {
        userId: null,
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (existingByName) {
      if (APPLY) {
        await prisma.employee.update({
          where: { id: existingByName.id },
          data: {
            userId: foreman.userId,
            isActive: true,
            defaultDayRate: foreman.defaultDayRate,
          },
        });
      }

      linkedByName += 1;
      console.log(
        `${APPLY ? "LINKED" : "[dry-run] LINK"} | ${userName} <${userEmail}> -> existing employee ${existingByName.firstName} ${existingByName.lastName}`,
      );
      continue;
    }

    const qrCodeValue = makeQrCode();

    if (APPLY) {
      await prisma.employee.create({
        data: {
          firstName,
          lastName,
          qrCodeValue,
          defaultDayRate: foreman.defaultDayRate,
          user: { connect: { id: foreman.userId } },
          createdByUser: { connect: { id: foreman.userId } },
          isActive: true,
        },
      });
    }

    createdProfiles += 1;
    console.log(
      `${APPLY ? "CREATED" : "[dry-run] CREATE"} | ${userName} <${userEmail}> | qr=${qrCodeValue}`,
    );

    if (!foreman.user) {
      skipped += 1;
    }
  }

  console.log("\nDone.");
  console.log(`Mode: ${APPLY ? "apply" : "dry-run"}`);
  console.log(`Already linked: ${alreadyLinked}`);
  console.log(`Linked existing by name: ${linkedByName}`);
  console.log(`Created new employee profiles: ${createdProfiles}`);
  console.log(`Skipped: ${skipped}`);
}

main()
  .catch((error) => {
    console.error("fix-missing-foreman-employee-profiles failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
