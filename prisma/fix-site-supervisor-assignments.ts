// prisma/fix-site-supervisor-assignments.ts
import { prisma } from "@/lib/prisma";

const siteSupervisors = [
  ["6770", "mawesi@firstclassprojects.co.za"],
  ["6771", "nic@firstclassprojects.co.za"],
  ["6772", "thousand@firstclassprojects.co.za"],
  ["6773", "owen@firstclassprojects.co.za"],
  ["6774", "geofrey@firstclassprojects.co.za"],
  ["6775", "lucas@firstclassprojects.co.za"],
  ["6776", "geofrey@firstclassprojects.co.za"],
  ["6777", "nic@firstclassprojects.co.za"],
  ["6778", "thousand@firstclassprojects.co.za"],
  ["6779", "mawesi@firstclassprojects.co.za"],
  ["6780", "temba@firstclassprojects.co.za"],
  ["6781", "geofrey@firstclassprojects.co.za"],
  ["6782", "lucas@firstclassprojects.co.za"],
  ["6783", "griffith@firstclassprojects.co.za"],
  ["6784", "temba@firstclassprojects.co.za"],
  ["6785", "geofrey@firstclassprojects.co.za"],
  ["6786", "temba@firstclassprojects.co.za"],
  ["6787", "lucas@firstclassprojects.co.za"],
  ["6788", "sean@firstclassprojects.co.za"],
  ["6789", "geofrey@firstclassprojects.co.za"],
  ["6790", "geofrey@firstclassprojects.co.za"],
  ["6791", "owen@firstclassprojects.co.za"],
  ["6792", "nic@firstclassprojects.co.za"],
  ["6793", "geofrey@firstclassprojects.co.za"],
  ["6794", "owen@firstclassprojects.co.za"],
  ["6795", "geofrey@firstclassprojects.co.za"],
  ["6796", "nic@firstclassprojects.co.za"],
  ["6797", "nic@firstclassprojects.co.za"],
  ["6798", "geofrey@firstclassprojects.co.za"],
  ["6799", "lawrence@firstclassprojects.co.za"],
  ["6800", "tshepo@firstclassprojects.co.za"],
  ["6801", "lucas@firstclassprojects.co.za"],
  ["6802", "geofrey@firstclassprojects.co.za"],
  ["6803", "lucas@firstclassprojects.co.za"],
  ["6804", "owen@firstclassprojects.co.za"],
  ["6805", "lucas@firstclassprojects.co.za"],
  ["6806", "lucas@firstclassprojects.co.za"],
  ["6807", "thousand@firstclassprojects.co.za"],
  ["6808", "lawrence@firstclassprojects.co.za"],
  ["6809", "griffith@firstclassprojects.co.za"],
  ["6810", "owen@firstclassprojects.co.za"],
  ["6811", "nic@firstclassprojects.co.za"],
  ["6812", "owen@firstclassprojects.co.za"],
  ["6813", "thousand@firstclassprojects.co.za"],
  ["6814", "thousand@firstclassprojects.co.za"],
  ["6815", "mawesi@firstclassprojects.co.za"],
  ["6816", "thousand@firstclassprojects.co.za"],
  ["6817", "griffith@firstclassprojects.co.za"],
  ["6818", "temba@firstclassprojects.co.za"],
  ["6819", "lucas@firstclassprojects.co.za"],
  ["6820", "griffith@firstclassprojects.co.za"],
  ["6821", "lucas@firstclassprojects.co.za"],
  ["6822", "lawrence@firstclassprojects.co.za"],
  ["6823", "lucas@firstclassprojects.co.za"],
  ["6824", "mawesi@firstclassprojects.co.za"],
  ["6825", "thousand@firstclassprojects.co.za"],
  ["6826", "mawesi@firstclassprojects.co.za"],
  ["6827", "mawesi@firstclassprojects.co.za"],
  ["6828", "mawesi@firstclassprojects.co.za"],
  ["6829", "nic@firstclassprojects.co.za"],
  ["6830", "lucas@firstclassprojects.co.za"],
  ["6831", "lucas@firstclassprojects.co.za"],
  ["6832", "lawrence@firstclassprojects.co.za"],
  ["6833", "owen@firstclassprojects.co.za"],
  ["6834", "lawrence@firstclassprojects.co.za"],
  ["6835", "mawesi@firstclassprojects.co.za"],
] as const;

async function main() {
  let assigned = 0;
  let missingSites = 0;
  let missingSupervisors = 0;

  for (const [code, email] of siteSupervisors) {
    const site = await prisma.site.findUnique({
      where: { code },
      select: { id: true, code: true, name: true },
    });

    if (!site) {
      console.log(`Missing site: ${code}`);
      missingSites++;
      continue;
    }

    const supervisor = await prisma.supervisor.findFirst({
      where: {
        user: {
          email: { equals: email, mode: "insensitive" },
        },
      },
      select: { id: true, user: { select: { name: true, email: true } } },
    });

    if (!supervisor) {
      console.log(`Missing supervisor: ${email} for site ${code}`);
      missingSupervisors++;
      continue;
    }

    await prisma.site.update({
      where: { id: site.id },
      data: {
        jobStatus: "NOT_STARTED",
        isActive: true,
      },
    });

    const existing = await prisma.supervisorSiteAssignment.findFirst({
      where: {
        supervisorId: supervisor.id,
        siteId: site.id,
        endsOn: null,
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.supervisorSiteAssignment.create({
        data: {
          supervisorId: supervisor.id,
          siteId: site.id,
        },
      });
    }

    assigned++;
    console.log(
      `Assigned ${site.code} - ${site.name} to ${supervisor.user.name ?? supervisor.user.email}`,
    );
  }

  console.log("Done.");
  console.log(`Assigned/confirmed: ${assigned}`);
  console.log(`Missing sites: ${missingSites}`);
  console.log(`Missing supervisors: ${missingSupervisors}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
