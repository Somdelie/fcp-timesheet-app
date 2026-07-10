import { prisma } from "@/lib/prisma";

const supervisorEmail = "nic@firstclassprojects.co.za";

// const assignments = [
//   ["ARMANDO CHILENGUE", "6751"],
//   ["ARMANDO CHILENGUE", "6762"],
//   ["David Nkwinika", "6714"],
//   ["David Nkwinika", "6664"],
//   ["Hemage Sola", "6734"],
//   ["Justice Mathye", "6471"],
//   ["Meluleki Moyo", "6751"],
//   ["Michael Mpofu", "6734"],
//   ["Mokgadi Pertunia Setata", "6792"],
//   ["Mongameli Ncube", "6714"],
//   ["Mutamba Mushe", "6599"],
//   ["Ndumiso Ndlovu", "6662"],
//   ["Nqobani Mzizi", "6252"],
//   ["Nqobani Mzizi", "6668"],
//   ["Nqobani Mzizi", "6714"],
//   ["Nqobani Mzizi", "6662"],
//   ["Nqobani Mzizi", "6777"],
//   ["NYIKO HLUNGWANI", "6511"],
//   ["NYIKO HLUNGWANI", "6779"],
//   ["Patience Sepuru", "6710"],
//   ["Priscilla Boloka", "6471"],
//   ["Samuel Ncube", "6751"],
//   ["Samuel Ncube", "6710"],
//   ["Sello Mmara", "6680"],
//   ["Thamsanqa Ndlovu", "6451"],
//   ["Thandazani Ndlovu", "6710"],
//   ["Thandazani Ndlovu", "6722"],
//   ["Thandazani Ndlovu", "6644"],
//   ["Tiiesetso Gift Malatji", "6511"],
//   ["Victor Kwinika", "6355"],
//   ["Vukosi Mkhari", "6714"],
//   ["Vusi Nyathi", "6511"],
//   ["Winter Rapaka", "6792"],
//   ["Yongama Portia Ntshisela", "6451"],
//   ["Zwelithini Ndlovu", "6792"],
//   ["Zwelithini Ndlovu", "6343"],
//   ["Zwelithini Ndlovu", "6706"],
//   ["Zwelithini Ndlovu", "6777"],
//   ["Zwelithini Ndlovu", "6156"],
// ] as const;
const assignments = [
  ["Alfred Sbanda", "6719"],
  ["Alfred Sbanda", "6745"],

  ["Alfred Shumba", "6745"],
  ["Alfred Shumba", "6747"],
  ["Alfred Shumba", "6826"],

  ["David Swathedi", "6411"],
  ["David Swathedi", "6474"],
  ["David Swathedi", "6745"],

  ["Jan Mbiza", "6606"],

  ["July Mabuza", "6606"],
  ["July Mabuza", "6769"],

  ["Limukani Ndlovu", "6606"],
  ["Limukani Ndlovu", "6005"],
  ["Limukani Ndlovu", "6105"],

  ["Meluleki Ndlovu", "6759"],
  ["Meluleki Ndlovu", "6489"],
  ["Meluleki Ndlovu", "6606"],

  ["Moment Dube", "6606"],

  ["Ronald Mafhara", "6606"],

  ["Siphiwe Ngomane", "6606"],
] as const;
function emailFromName(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "") + "@firstclassprojects.local"
  );
}

async function main() {
  const supervisor = await prisma.supervisor.findFirst({
    where: {
      user: { email: { equals: supervisorEmail, mode: "insensitive" } },
    },
    select: { id: true },
  });

  if (!supervisor) throw new Error(`Supervisor not found: ${supervisorEmail}`);

  for (const [foremanName, siteCode] of assignments) {
    const site = await prisma.site.findUnique({
      where: { code: siteCode },
      select: { id: true, name: true, code: true },
    });

    if (!site) {
      console.log(`Missing site ${siteCode} for ${foremanName}`);
      continue;
    }

    let user = await prisma.user.findFirst({
      where: { name: { equals: foremanName, mode: "insensitive" } },
      include: { foreman: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: foremanName,
          email: emailFromName(foremanName),
          password: "Password@2026",
          role: "FOREMAN",
        },
        include: { foreman: true },
      });
    } else if (user.role !== "FOREMAN") {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: "FOREMAN" },
        include: { foreman: true },
      });
    }

    const foreman =
      user.foreman ??
      (await prisma.foreman.create({
        data: { userId: user.id },
      }));

    await prisma.supervisorForeman.upsert({
      where: {
        supervisorId_foremanId_startsOn: {
          supervisorId: supervisor.id,
          foremanId: foreman.id,
          startsOn: new Date("2026-06-20T00:00:00.000Z"),
        },
      },
      update: {},
      create: {
        supervisorId: supervisor.id,
        foremanId: foreman.id,
        startsOn: new Date("2026-06-20T00:00:00.000Z"),
      },
    });

    const existingSiteAssignment = await prisma.foremanSiteAssignment.findFirst(
      {
        where: {
          foremanId: foreman.id,
          siteId: site.id,
          endsOn: null,
        },
      },
    );

    if (!existingSiteAssignment) {
      await prisma.foremanSiteAssignment.create({
        data: {
          foremanId: foreman.id,
          siteId: site.id,
          startsOn: new Date("2026-06-20T00:00:00.000Z"),
        },
      });
    }

    console.log(`Assigned ${site.code} ${site.name} to ${foremanName}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
