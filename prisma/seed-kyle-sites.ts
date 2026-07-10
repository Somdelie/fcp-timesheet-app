import { prisma } from "@/lib/prisma";

const supervisorEmail = "kyle@firstclassprojects.co.za";

const sites = [
  { code: "2108", name: "90 MADELINE" },
  { code: "2764", name: "34 MADELINE" },
  { code: "2159", name: "40 MADELINE" },
  { code: "4126", name: "15 DIAGONAL" },
  { code: "3590", name: "40 ALEXANDRA" },
  { code: "2114", name: "24 SUTHERLAND" },
  { code: "3138", name: "233 JAN SMUTS" },
  { code: "3973", name: "29 ALEXANDRA" },
  { code: "5229", name: "103 PARKHURST" },
  { code: "5011", name: "18A PARKHURST" },
  { code: "2115", name: "19 JAN SMUTS" },
  { code: "6076", name: "31 MACKAY" },
  { code: "5592", name: "63 HAMILTON" },
  { code: "4735", name: "15 SUTHERLAND" },
  { code: "5847", name: "50 PARKMORE" },
  { code: "6652", name: "17 SUTHERLAND" },
  { code: "5644", name: "1 PARKVIEW" },
  { code: "6701", name: "14 LADIES MILE" },
  { code: "6783", name: "HUES" },
  { code: "5603", name: "9 MORNINGHILL" },
] as const;

async function main() {
  const supervisor = await prisma.supervisor.findFirst({
    where: {
      user: {
        email: {
          equals: supervisorEmail,
          mode: "insensitive",
        },
      },
    },
    select: {
      id: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!supervisor) {
    throw new Error(`Supervisor not found: ${supervisorEmail}`);
  }

  let created = 0;
  let updated = 0;
  let assigned = 0;
  let alreadyAssigned = 0;

  for (const input of sites) {
    const existingSite = await prisma.site.findUnique({
      where: { code: input.code },
      select: { id: true },
    });

    const site = await prisma.site.upsert({
      where: {
        code: input.code,
      },
      update: {
        name: input.name,
        jobStatus: "NOT_STARTED",
        isActive: true,
      },
      create: {
        code: input.code,
        name: input.name,
        client: null,
        specStatus: "NOT_REQUESTED" as any,
        jobStatus: "NOT_STARTED",
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (existingSite) {
      updated += 1;
    } else {
      created += 1;
    }

    const existingAssignment = await prisma.supervisorSiteAssignment.findFirst({
      where: {
        supervisorId: supervisor.id,
        siteId: site.id,
        endsOn: null,
      },
      select: {
        id: true,
      },
    });

    if (existingAssignment) {
      alreadyAssigned += 1;
      console.log(
        `Already assigned: ${site.code} - ${site.name} to ${supervisor.user.name}`,
      );
      continue;
    }

    await prisma.supervisorSiteAssignment.create({
      data: {
        supervisorId: supervisor.id,
        siteId: site.id,
        startsOn: new Date("2026-07-01T00:00:00.000Z"),
      },
    });

    assigned += 1;

    console.log(
      `Assigned: ${site.code} - ${site.name} to ${supervisor.user.name}`,
    );
  }

  console.log("\nCompleted Kyle site seed.");
  console.log(`Created sites: ${created}`);
  console.log(`Updated existing sites: ${updated}`);
  console.log(`New assignments: ${assigned}`);
  console.log(`Already assigned: ${alreadyAssigned}`);
}

main()
  .catch((error) => {
    console.error("Kyle site seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
