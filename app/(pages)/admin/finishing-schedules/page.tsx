import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { DownloadFinishingSchedulePdfButton } from "@/components/finishing-schedules/pdf/DownloadFinishingSchedulePdfButton";
import CreateFinishingScheduleDialog from "@/components/finishing-schedules/CreateFinishingScheduleDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Finishing Schedules" };

function fmt(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Finishing Schedules
        </h1>
        <CreateFinishingScheduleDialog sites={sites} />
      </div>

      {schedules.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          No finishing schedules yet. Create one from a site&apos;s detail page.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Contract No</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Contract Manager</TableHead>
                <TableHead className="text-center">Areas</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s) => {
                const totalItems = s.areas.reduce(
                  (sum, a) => sum + a._count.items,
                  0,
                );
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/sites/${s.site.id}`}
                        className="text-primary hover:underline"
                      >
                        {s.site.name}
                        {s.site.code && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {s.site.code}
                          </Badge>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>{s.contractNo || "—"}</TableCell>
                    <TableCell>{s.client || "—"}</TableCell>
                    <TableCell>{s.contractManager || "—"}</TableCell>
                    <TableCell className="text-center">
                      {s.areas.length}
                    </TableCell>
                    <TableCell className="text-center">{totalItems}</TableCell>
                    <TableCell>{fmt(s.startDate)}</TableCell>
                    <TableCell>{fmt(s.completionDate)}</TableCell>
                    <TableCell className="text-right">
                      <DownloadFinishingSchedulePdfButton
                        scheduleId={s.id}
                        label="PDF"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
