import { prisma } from "@/lib/prisma";
import CreateFinishingScheduleDialog from "@/components/finishing-schedules/CreateFinishingScheduleDialog";
import FinishingSchedulesTable, {
  type ScheduleRow,
} from "@/components/finishing-schedules/FinishingSchedulesTable";

export const metadata = { title: "Finishing Schedules" };

export default async function FinishingSchedulesPage() {
  const [schedules, sites] = await Promise.all([
    prisma.siteFinishingSchedule.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        site: { select: { id: true, name: true, code: true } },
        areas: {
          select: {
            id: true,
            _count: { select: { items: true } },
          },
        },
      },
    }),
    prisma.site.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: ScheduleRow[] = schedules.map((s) => ({
    id: s.id,
    contractNo: s.contractNo,
    client: s.client,
    contractManager: s.contractManager,
    startDate: s.startDate ? s.startDate.toISOString() : null,
    completionDate: s.completionDate ? s.completionDate.toISOString() : null,
    site: s.site,
    areaCount: s.areas.length,
    itemCount: s.areas.reduce((sum, a) => sum + a._count.items, 0),
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Finishing Schedules
        </h1>
        <CreateFinishingScheduleDialog sites={sites} />
      </div>

      <FinishingSchedulesTable data={rows} />
    </div>
  );
}
