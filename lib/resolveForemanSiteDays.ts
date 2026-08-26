import { prisma } from "./prisma";

/**
 * Shared by the scan-out-pending and scan-out-identify routes: resolve
 * which SiteDay rows are in scope for a request. An explicit siteId keeps
 * the original single-site behavior (foreman picked a site, re-checked
 * against their assignment); omitting it spans every site the foreman is
 * currently assigned to - the auto-detect path used when there's no site
 * to pick from ahead of time (an assistant scanning out on a foreman's
 * behalf, see resolveActingForeman).
 */
export async function resolveForemanSiteDays(
  actingForemanId: string,
  siteId: string | null,
  workDate: Date,
): Promise<
  | { id: string; site: { id: string; name: string } }[]
  | { error: string; status: number }
> {
  if (siteId) {
    const siteAssignment = await prisma.foremanSiteAssignment.findFirst({
      where: {
        foremanId: actingForemanId,
        siteId,
        startsOn: { lte: new Date() },
        OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!siteAssignment) {
      return { error: "You are not assigned to this site.", status: 403 };
    }

    const siteDay = await prisma.siteDay.findFirst({
      where: { foremanId: actingForemanId, siteId, workDate },
      select: { id: true, site: { select: { id: true, name: true } } },
    });
    return siteDay ? [siteDay] : [];
  }

  const assignments = await prisma.foremanSiteAssignment.findMany({
    where: {
      foremanId: actingForemanId,
      startsOn: { lte: new Date() },
      OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
    },
    select: { siteId: true },
  });
  const siteIds = Array.from(new Set(assignments.map((a) => a.siteId)));
  if (siteIds.length === 0) return [];

  return prisma.siteDay.findMany({
    where: { foremanId: actingForemanId, siteId: { in: siteIds }, workDate },
    select: { id: true, site: { select: { id: true, name: true } } },
  });
}
