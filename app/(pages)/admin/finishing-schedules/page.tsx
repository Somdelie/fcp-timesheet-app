import { prisma } from "@/lib/prisma";
import BackfillSiteColoursButton from "@/components/finishing-schedules/BackfillSiteColoursButton";
import CreateFinishingScheduleDialog from "@/components/finishing-schedules/CreateFinishingScheduleDialog";
import FinishingSchedulesTable, {
  type ScheduleRow,
} from "@/components/finishing-schedules/FinishingSchedulesTable";

export const metadata = { title: "Finishing Schedules" };

export default async function FinishingSchedulesPage() {
  const now = new Date();
  const [schedules, sites, suppliers] = await Promise.all([
    prisma.siteFinishingSchedule.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            code: true,
            supervisorAssignments: {
              where: {
                startsOn: { lte: now },
                OR: [{ endsOn: null }, { endsOn: { gt: now } }],
              },
              orderBy: { startsOn: "desc" },
              take: 1,
              select: {
                supervisor: {
                  select: {
                    user: { select: { name: true, email: true } },
                  },
                },
              },
            },
          },
        },
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
      select: {
        id: true,
        name: true,
        code: true,
        client: true,
        supervisorAssignments: {
          where: {
            startsOn: { lte: now },
            OR: [{ endsOn: null }, { endsOn: { gt: now } }],
          },
          orderBy: { startsOn: "desc" },
          take: 1,
          select: {
            supervisor: {
              select: {
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
        foremanAssignments: {
          where: {
            startsOn: { lte: now },
            OR: [{ endsOn: null }, { endsOn: { gt: now } }],
          },
          orderBy: { startsOn: "desc" },
          take: 1,
          select: {
            foreman: {
              select: {
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const siteOptions = sites.map((site) => {
    const supervisor = site.supervisorAssignments[0]?.supervisor.user ?? null;
    const foreman = site.foremanAssignments[0]?.foreman.user ?? null;

    return {
      id: site.id,
      name: site.name,
      code: site.code,
      client: site.client,
      contractNo: site.code,
      fcpContractManager: supervisor?.name ?? supervisor?.email ?? null,
      fcpSiteForeman: foreman?.name ?? foreman?.email ?? null,
    };
  });

  const rows: ScheduleRow[] = schedules.map((s) => ({
    id: s.id,
    contractNo: s.contractNo,
    client: s.client,
    contractManager: s.contractManager,
    startDate: s.startDate ? s.startDate.toISOString() : null,
    completionDate: s.completionDate ? s.completionDate.toISOString() : null,
    site: {
      id: s.site.id,
      name: s.site.name,
      code: s.site.code,
      supervisorName:
        s.site.supervisorAssignments[0]?.supervisor.user?.name ??
        s.site.supervisorAssignments[0]?.supervisor.user?.email ??
        null,
    },
    areaCount: s.areas.length,
    itemCount: s.areas.reduce((sum, a) => sum + a._count.items, 0),
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Finishing Schedules
        </h1>
        <div className="flex items-start gap-3">
          <BackfillSiteColoursButton />
          <CreateFinishingScheduleDialog
            sites={siteOptions}
            suppliers={suppliers}
          />
        </div>
      </div>

      <FinishingSchedulesTable data={rows} />
    </div>
  );
}
