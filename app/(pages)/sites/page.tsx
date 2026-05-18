// app/(pages)/sites/page.tsx
import SitesList from "@/components/sites/SitesList";
import { listSites } from "@/actions/sites";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; show?: "active" | "all" }>;
}) {
  const sp = await searchParams;
  const q = sp?.q ?? "";
  const show = sp?.show ?? "active";

  const [sitesRes, supervisors, foremen] = await Promise.all([
    listSites({ q, show }),
    prisma.user.findMany({
      where: { role: "SUPERVISOR" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "FOREMAN" },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const sites = sitesRes.ok ? sitesRes.sites : [];

  const supervisorOptions = supervisors.map((u) => ({
    id: u.id,
    name: u.name ?? u.email ?? "Unknown",
    email: u.email ?? "",
  }));

  const foremanOptions = foremen.map((u) => ({
    id: u.id,
    name: u.name ?? u.email ?? "Unknown",
    email: u.email ?? "",
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <SitesList
        initialSites={sites}
        supervisorOptions={supervisorOptions}
        foremanOptions={foremanOptions}
      />
    </div>
  );
}
