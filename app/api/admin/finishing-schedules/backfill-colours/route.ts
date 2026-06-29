import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureSitePaintColorFromOrderItem } from "@/lib/procurement/sitePaintColorSeeder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackfillStatus = "queued" | "running" | "complete" | "failed";

type BackfillJob = {
  id: string;
  status: BackfillStatus;
  total: number;
  processed: number;
  seeded: number;
  created: number;
  updated: number;
  duplicates: number;
  skipped: number;
  failed: number;
  currentSite: string | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

const globalForJobs = globalThis as typeof globalThis & {
  __siteColourBackfillJobs?: Map<string, BackfillJob>;
};

const jobs =
  globalForJobs.__siteColourBackfillJobs ??
  new Map<string, BackfillJob>();

globalForJobs.__siteColourBackfillJobs = jobs;

async function requireBackfillAuth() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  return !!session && (role === "ADMIN" || role === "OFFICE");
}

function serializeJob(job: BackfillJob) {
  const percent = job.total
    ? Math.min(100, Math.round((job.processed / job.total) * 100))
    : job.status === "complete"
      ? 100
      : 0;

  return { ...job, percent };
}

async function runBackfill(job: BackfillJob) {
  job.status = "running";

  try {
    const items = await prisma.siteProductOrderItem.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        productId: true,
        note: true,
        product: { select: { name: true } },
        order: {
          select: {
            id: true,
            siteId: true,
            reference: true,
            supplierId: true,
            supplier: { select: { name: true } },
            site: { select: { code: true, name: true } },
          },
        },
      },
    });

    job.total = items.length;

    for (const item of items) {
      job.currentSite =
        item.order.site.code && item.order.site.name
          ? `${item.order.site.code} - ${item.order.site.name}`
          : item.order.site.name;

      try {
        const result = await ensureSitePaintColorFromOrderItem(prisma, {
          siteId: item.order.siteId,
          productId: item.productId,
          rawDescription: item.note ?? item.product.name,
          supplierId: item.order.supplierId,
          supplierName: item.order.supplier?.name ?? null,
          sourceOrderId: item.order.id,
          sourceOrderItemId: item.id,
          orderReference: item.order.reference,
          sourceFile: "finishing schedule colour backfill",
        });

        if (!result.ok) {
          job.failed += 1;
        } else if (!result.seeded) {
          job.skipped += 1;
        } else {
          job.seeded += 1;
          if (result.row?.status === "CREATED") job.created += 1;
          else if (result.row?.status === "UPDATED") job.updated += 1;
          else if (result.row?.status === "DUPLICATE") job.duplicates += 1;
        }
      } catch {
        job.failed += 1;
      } finally {
        job.processed += 1;
      }
    }

    job.status = "complete";
    job.currentSite = null;
    job.finishedAt = new Date().toISOString();
  } catch (error) {
    job.status = "failed";
    job.error =
      error instanceof Error ? error.message : "Backfill failed unexpectedly.";
    job.finishedAt = new Date().toISOString();
  }
}

export async function POST() {
  if (!(await requireBackfillAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = Array.from(jobs.values()).find(
    (job) => job.status === "queued" || job.status === "running",
  );

  if (active) {
    return NextResponse.json({ job: serializeJob(active) });
  }

  const job: BackfillJob = {
    id: crypto.randomUUID(),
    status: "queued",
    total: 0,
    processed: 0,
    seeded: 0,
    created: 0,
    updated: 0,
    duplicates: 0,
    skipped: 0,
    failed: 0,
    currentSite: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  };

  jobs.set(job.id, job);
  void runBackfill(job);

  return NextResponse.json({ job: serializeJob(job) }, { status: 202 });
}

export async function GET(req: NextRequest) {
  if (!(await requireBackfillAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  const job = jobId
    ? jobs.get(jobId)
    : Array.from(jobs.values()).at(-1) ?? null;

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job: serializeJob(job) });
}
