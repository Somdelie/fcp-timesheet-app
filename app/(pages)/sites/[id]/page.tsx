import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { siteWhereFor } from "@/lib/site-scope";
import SiteAssignmentsPanel from "@/components/sites/SiteAssignmentsPanel";
import SiteBookingPanel from "@/components/sites/SiteBookingPanel";
import SiteTotalsPanel from "@/components/sites/SiteTotalsPanel";
import { ArrowLeft, CheckCircle, MapPin, Hash } from "lucide-react";
import Link from "next/link";

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
      location: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!site) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100/50 dark:from-slate-950 dark:to-slate-900/50 flex items-center justify-center px-4">
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
  const [supervisors, foremen] = await Promise.all([
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
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100/50 dark:from-slate-950 dark:to-slate-900/50">
      <div className="mx-auto w-full max-w-7xl py-8 px-4 sm:px-6">
        {/* Header Navigation */}
        <div className="mb-8">
          <Link
            href="/sites"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sites
          </Link>
        </div>

        {/* Header Card */}
        <div className="mb-3 rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/40 backdrop-blur-sm p-4 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {site.name}
                </h1>
                {site.isActive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Active
                  </span>
                )}
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
                {site.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {site.location}
                    </span>
                  </div>
                )}
                <div className="flex items-center">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Site ID:{" "}
                    <span className="font-mono text-slate-900 dark:text-slate-200">
                      {site.id}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full sm:w-auto">
              <SiteTotalsPanel siteId={site.id} />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          <SiteAssignmentsPanel
            siteId={site.id}
            supervisorOptions={supervisorOptions}
            foremanOptions={foremanOptions}
          />

          {/* <SiteBookingPanel siteId={site.id} /> */}
        </div>
      </div>
    </div>
  );
}
