import { prisma } from "@/lib/prisma";
import { DownloadFinishingSchedulePdfButton } from "@/components/finishing-schedules/pdf/DownloadFinishingSchedulePdfButton";

export const dynamic = "force-dynamic";

export default async function DevFinishingSchedulePdfPage() {
  const schedules = await prisma.siteFinishingSchedule.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { site: { select: { name: true, code: true } } },
  });

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold">
        Finishing Schedule PDF – Dev Test
      </h1>

      {schedules.length === 0 ? (
        <p className="text-muted-foreground">
          No finishing schedules found. Create one first.
        </p>
      ) : (
        <ul className="space-y-4">
          {schedules.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded border p-4"
            >
              <div>
                <p className="font-medium">
                  {s.site?.name ?? "Unknown site"}{" "}
                  <span className="text-muted-foreground text-sm">
                    ({s.site?.code})
                  </span>
                </p>
                <p className="text-muted-foreground text-xs">ID: {s.id}</p>
              </div>
              <DownloadFinishingSchedulePdfButton scheduleId={s.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
