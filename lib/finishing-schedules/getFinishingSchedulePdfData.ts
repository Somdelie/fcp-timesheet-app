import { prisma } from "@/lib/prisma";

/**
 * Fetch a finishing schedule with all nested relations for PDF generation.
 * Returns null if not found.
 */
export async function getFinishingSchedulePdfData(scheduleId: string) {
  return prisma.siteFinishingSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      site: true,
      areas: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          items: {
            orderBy: [{ sortOrder: "asc" }],
          },
        },
      },
    },
  });
}

export type FinishingScheduleWithRelations = NonNullable<
  Awaited<ReturnType<typeof getFinishingSchedulePdfData>>
>;
