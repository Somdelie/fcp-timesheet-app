import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { siteWhereFor } from "@/lib/site-scope";
import { calcSiteCosts } from "@/lib/procurement";
import { toISODate } from "@/lib/fortnight";
import { formatCurrency } from "@/lib/formatCurrency";
import SiteAssignmentsPanel from "@/components/sites/SiteAssignmentsPanel";
import SiteTotalsPanel from "@/components/sites/SiteTotalsPanel";
import SiteMaterialOrdersPanel from "@/components/sites/SiteMaterialOrdersPanel";
import SiteMaterialsPanel from "@/components/sites/SiteMaterialsPanel";
import SiteDocumentsPanel from "@/components/sites/SiteDocumentsPanel";
import SiteDetailsSections from "@/components/sites/SiteDetailsSections";
import EditSiteLocationDialog from "@/components/sites/EditSiteLocationDialog";
import SiteForemanRatesPanel from "@/components/sites/SiteForemanRatesPanel";
import SiteFinishingSchedulePanel from "@/components/finishing-schedules/SiteFinishingSchedulePanel";
import { ArrowLeft, CheckCircle, MapPin, Hash, User } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SiteManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const auth = await requireServerAuth();

  const site = await prisma.site.findFirst({
    where: { id, ...siteWhereFor(auth) },
    select: {
      id: true,
      name: true,
      code: true,
      client: true,
      location: true,
      address: true,
      latitude: true,
      longitude: true,
      isActive: true,
      siteClaimDate: true,
      amountClaimed: true,
      jobStatus: true,
      specStatus: true,
      specAvailable: true,
      finishingScheduleDone: true,
      createdAt: true,
      finishingSchedules: {
        where: { isActive: true },
        select: { id: true },
        take: 1,
      },
      supervisorAssignments: {
        where: { endsOn: null },
        select: {
          supervisor: { select: { userId: true } },
        },
        orderBy: { startsOn: "desc" },
        take: 1,
      },
      foremanAssignments: {
        where: { endsOn: null },
        select: {
          foreman: { select: { userId: true } },
        },
        orderBy: { startsOn: "desc" },
        take: 1,
      },
    },
  });

  // All-time project costs (historical + live app combined)
  const costSummary = await calcSiteCosts(undefined, undefined, [id]);
  const siteCosts = costSummary.rows.find((r) => r.siteId === id);

  if (!site) {
    return (
      <div className="bg-linear-to-br from-slate-50 to-slate-100/50 dark:from-slate-950 dark:to-slate-900/50 flex items-center justify-center px-4">
        <div className="rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Site Not Found
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            The site you're looking for doesn't exist or you don't have access
            to it.
          </p>
          <Link
            href="/sites"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sites
          </Link>
        </div>
      </div>
    );
  }

  // IMPORTANT: Options must be User.id (not Supervisor.id / Foreman.id)
  const [supervisors, foremen, adminUsers] = await Promise.all([
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
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "OFFICE"] } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

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

  const adminOptions = adminUsers.map((u) => ({
    id: u.id,
    name: u.name ?? u.email ?? "Unknown",
    email: u.email ?? "",
  }));

  const hasCoords =
    typeof site.latitude === "number" && typeof site.longitude === "number";
  const siteLocation = site.location?.trim();
  const siteAddress = site.address?.trim();
  const activeSupervisorUserId =
    site.supervisorAssignments[0]?.supervisor.userId ?? null;
  const activeForemanUserId =
    site.foremanAssignments[0]?.foreman.userId ?? null;

  return (
    <div>
      <div className="mx-auto w-full max-w-7xl py-3">
        {/* Header Card */}
        <div className="mb-3 rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/sites"
                  className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {site.name}
                </h1>
                {/* {site.isActive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Active
                  </span>
                )} */}
              </div>

              <div className="mt-4 flex flex-wrap gap-4">
                {site.code && (
                  <div className="flex items-center">
                    <Hash className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                      Job Number:{" "}
                      <span className="font-mono text-slate-900 dark:text-slate-200">
                        {site.code}
                      </span>
                    </span>
                  </div>
                )}
                {site.client && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Client:{" "}
                      <span className="text-slate-900 dark:text-slate-200">
                        {site.client}
                      </span>
                    </span>
                  </div>
                )}
                {siteAddress && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Address: {siteAddress}
                    </span>
                  </div>
                )}

                {!siteAddress && siteLocation && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {siteLocation}
                    </span>
                  </div>
                )}

                {hasCoords && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Pin:{" "}
                      <span className="font-mono text-slate-900 dark:text-slate-200">
                        {site.latitude!.toFixed(6)},{" "}
                        {site.longitude!.toFixed(6)}
                      </span>
                    </span>
                  </div>
                )}

                {!siteLocation && !siteAddress && !hasCoords && (
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-500">
                    No address/pin set yet.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
              <EditSiteLocationDialog
                siteId={site.id}
                initialName={site.name}
                initialCode={site.code}
                initialClient={site.client}
                initialLocation={site.location}
                initialAddress={site.address ?? site.location}
                initialLatitude={site.latitude}
                initialLongitude={site.longitude}
                initialSiteClaimDate={
                  site.siteClaimDate
                    ? toISODate(site.siteClaimDate as Date)
                    : null
                }
                initialAmountClaimed={Number(site.amountClaimed ?? 0)}
                initialJobStatus={site.jobStatus}
                initialSpecStatus={site.specStatus}
                initialSpecAvailable={site.specAvailable}
                initialFinishingScheduleDone={site.finishingScheduleDone}
                initialHasFinishingScheduleInSystem={
                  site.finishingSchedules.length > 0
                }
                initialSupervisorUserId={activeSupervisorUserId}
                initialForemanUserId={activeForemanUserId}
                canEditCoreDetails={auth.role === "ADMIN"}
                supervisorOptions={supervisorOptions}
                foremanOptions={foremanOptions}
              />

              <div className="min-w-44 rounded border border-slate-200/50 bg-slate-50/50 p-3 text-right dark:border-slate-700/50 dark:bg-slate-800/30">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Total Project Cost
                </p>
                <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">
                  {formatCurrency(siteCosts?.projectCost ?? 0)}
                </p>
              </div>

              <div className="min-w-64 rounded border border-slate-200/50 bg-slate-50/50 p-3 dark:border-slate-700/50 dark:bg-slate-800/30">
                <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Wages: {formatCurrency(siteCosts?.wagesCost ?? 0)}
                  </span>
                  <span>
                    Material: {formatCurrency(siteCosts?.materialCost ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <SiteDetailsSections
          assignments={
            <SiteAssignmentsPanel
              siteId={site.id}
              supervisorOptions={supervisorOptions}
              foremanOptions={foremanOptions}
              adminOptions={adminOptions}
            />
          }
          dayRateOverrides={
            auth.role === "ADMIN" ? (
              <SiteForemanRatesPanel
                siteId={site.id}
                foremanOptions={foremanOptions}
              />
            ) : undefined
          }
          documents={<SiteDocumentsPanel siteId={site.id} />}
          materials={<SiteMaterialsPanel siteId={site.id} />}
          materialOrders={
            <SiteMaterialOrdersPanel
              siteId={site.id}
              siteCode={site.code}
              siteName={site.name}
            />
          }
          projectCosts={<SiteTotalsPanel siteId={site.id} />}
          finishingSchedule={<SiteFinishingSchedulePanel siteId={site.id} />}
        />
      </div>
    </div>
  );
}
