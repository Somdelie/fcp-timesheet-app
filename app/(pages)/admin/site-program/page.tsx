import { JobProgramPlanner } from "@/components/site-program-planner";
import {
  getSiteProgramme,
  listSitesForProgrammePlanner,
} from "@/actions/job-program";

export default async function SiteProgramPage() {
  const sites = (await listSitesForProgrammePlanner()) as Array<{
    id: string;
    name: string;
    code: string | null;
    client: string | null;
    latestProgramme: {
      id: string;
      title: string;
      plannedStartDate: string | null;
      plannedFinishDate: string | null;
      updatedAt: string;
      itemCount: number;
    } | null;
  }>;
  const selectedSiteId =
    sites.find((site) => site.latestProgramme)?.id ?? sites[0]?.id ?? "";
  const initialProgramme = selectedSiteId
    ? await getSiteProgramme(selectedSiteId)
    : null;

  return (
    <JobProgramPlanner
      sites={sites}
      initialSiteId={selectedSiteId}
      initialProgramme={initialProgramme}
    />
  );
}
