import { prisma } from "@/lib/prisma";
prisma.employee
  .findMany({
    where: {
      OR: [
        { firstName: { contains: "Thomas", mode: "insensitive" } },
        { lastName: { contains: "Mathe", mode: "insensitive" } },
        { firstName: { contains: "Akani", mode: "insensitive" } },
        { firstName: { contains: "Sbusiso", mode: "insensitive" } },
        { firstName: { contains: "Boikanyo", mode: "insensitive" } },
        { firstName: { contains: "Kamuhelo", mode: "insensitive" } },
        { firstName: { contains: "Tshiamo", mode: "insensitive" } },
        { firstName: { contains: "Khulumani", mode: "insensitive" } },
        { firstName: { contains: "Shadreck", mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true },
  })
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    prisma.$disconnect();
  });
