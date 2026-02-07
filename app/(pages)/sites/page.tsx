// app/(pages)/sites/page.tsx
import SitesList from "@/components/sites/SitesList";
import { listSites } from "@/actions/sites";

export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; show?: "active" | "all" }>;
}) {
  const sp = await searchParams;
  const q = sp?.q ?? "";
  const show = sp?.show ?? "active";

  const res = await listSites({ q, show, take: 300 });
  const sites = res.ok ? res.sites : [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <SitesList initialSites={sites} />
    </div>
  );
}
