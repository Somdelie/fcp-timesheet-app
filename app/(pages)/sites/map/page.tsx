import SitesMap, { SiteMapMarker } from "@/components/sites/SiteMap";
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { siteWhereFor } from "@/lib/site-scope";

export const revalidate = 300;

export default async function SitesMapPage() {
  const auth = await requireServerAuth();
  const scope = siteWhereFor(auth);

  const sites = await prisma.site.findMany({
    where: { ...scope, isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      code: true,
      location: true,
      latitude: true,
      longitude: true,
      isActive: true,
    },
  });

  const markers: SiteMapMarker[] = sites
    .filter(
      (s) => typeof s.latitude === "number" && typeof s.longitude === "number",
    )
    .map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      lat: s.latitude as number,
      lng: s.longitude as number,
      region: s.location ?? undefined,
      status: s.isActive ? "active" : "warning",
    }));

  return <SitesMap sites={markers} />;
}
