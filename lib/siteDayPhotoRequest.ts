import { prisma } from "@/lib/prisma";

/**
 * Ensure there is at least one SiteDayPhotoRequest for the given SiteDay.
 *
 * - Used by attendance flows so that any SiteDay with scans
 *   automatically has a corresponding photo request.
 * - Best-effort: failures are expected to be handled by callers.
 */
export async function ensureSiteDayPhotoRequestForSiteDay(siteDayId: string) {
  if (!siteDayId) return null;

  const existing = await prisma.siteDayPhotoRequest.findFirst({
    where: { siteDayId },
    select: { id: true },
  });

  if (existing) return existing;

  try {
    return await prisma.siteDayPhotoRequest.create({
      data: {
        siteDayId,
        note: "Automatic request (first scan of day)",
      },
      select: { id: true },
    });
  } catch {
    // Best-effort only; ignore errors (e.g. rare race conditions).
    return null;
  }
}
