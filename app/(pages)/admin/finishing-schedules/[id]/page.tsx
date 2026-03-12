import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import FinishingScheduleBuilder from "@/components/finishing-schedules/FinishingScheduleBuilder";

export default async function FinishingScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const schedule = await prisma.siteFinishingSchedule.findUnique({
    where: { id },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          code: true,
          siteMaterials: {
            orderBy: { product: { name: "asc" } },
            select: {
              id: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  supplier: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      areas: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          items: {
            orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
          },
        },
      },
    },
  });

  if (!schedule) notFound();

  return (
    <FinishingScheduleBuilder
      schedule={schedule}
      siteMaterials={schedule.site.siteMaterials}
    />
  );
}
