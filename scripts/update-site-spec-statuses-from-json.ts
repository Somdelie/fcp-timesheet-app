import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { normalizeDatabaseUrl } from "../lib/database-url";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: normalizeDatabaseUrl(connectionString),
  }),
});

type JsonSiteSpecRow = {
  jobNumber?: unknown;
  siteName?: unknown;
  specificationStatus?: unknown;
};

type TargetSpecStatus =
  | "NOT_REQUESTED"
  | "NOT_REQUIRED"
  | "REQUESTED"
  | "RECEIVED"
  | "ACTIONED";

const statusMap: Record<string, TargetSpecStatus> = {
  COMPLETED: "ACTIONED",
  ACTIONED: "ACTIONED",
  RECEIVED: "RECEIVED",
  REQUESTED: "REQUESTED",
  IN_PROGRESS: "REQUESTED",
  PENDING_INFORMATION: "NOT_REQUESTED",
  NOT_REQUIRED: "NOT_REQUIRED",
  NOT_NEEDED: "NOT_REQUIRED",
};

const protectedDbStatuses = new Set(["ACTIONED", "RECEIVED", "REQUESTED"]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function specAvailableFromStatus(status: TargetSpecStatus) {
  return status === "RECEIVED" || status === "ACTIONED";
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

async function main() {
  const raw = await readFile("jobs_specification_status.json", "utf8");
  const rows = JSON.parse(raw) as JsonSiteSpecRow[];
  console.log(`Read ${rows.length} JSON rows.`);

  const unmappedJsonStatuses = new Map<string, number>();
  const missingSites: Array<{ code: string; name: string; status: string }> = [];
  const updated: Array<{
    code: string;
    name: string;
    from: string;
    to: TargetSpecStatus;
  }> = [];
  const skippedProtected: Array<{
    code: string;
    name: string;
    dbStatus: string;
    jsonStatus: string;
  }> = [];

  const renamedNotNeeded = await prisma.site.updateMany({
    where: { specStatus: "NOT_NEEDED" as TargetSpecStatus },
    data: {
      specStatus: "NOT_REQUIRED" as TargetSpecStatus,
      specAvailable: false,
    },
  });
  console.log(`Renamed ${renamedNotNeeded.count} NOT_NEEDED rows.`);

  const mappedRows = rows
    .map((row) => {
      const code = clean(row.jobNumber);
      const name = clean(row.siteName);
      const jsonStatus = clean(row.specificationStatus).toUpperCase();
      const targetStatus = statusMap[jsonStatus];

      if (!code || !targetStatus) {
        if (jsonStatus) bump(unmappedJsonStatuses, jsonStatus);
        return null;
      }

      return { code, name, jsonStatus, targetStatus };
    })
    .filter(Boolean) as Array<{
      code: string;
      name: string;
      jsonStatus: string;
      targetStatus: TargetSpecStatus;
    }>;

  const codes = Array.from(new Set(mappedRows.map((row) => row.code)));
  const sites = await prisma.site.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true, name: true, specStatus: true },
  });
  const sitesByCode = new Map(sites.map((site) => [site.code, site]));
  const updates: Array<{
    id: string;
    code: string;
    name: string;
    from: string;
    to: TargetSpecStatus;
  }> = [];

  for (const row of mappedRows) {
    const site = sitesByCode.get(row.code);

    if (!site) {
      missingSites.push({
        code: row.code,
        name: row.name,
        status: row.jsonStatus,
      });
      continue;
    }

    const currentStatus = String(site.specStatus);
    if (protectedDbStatuses.has(currentStatus)) {
      skippedProtected.push({
        code: row.code,
        name: site.name,
        dbStatus: currentStatus,
        jsonStatus: row.jsonStatus,
      });
      continue;
    }

    if (currentStatus === row.targetStatus) continue;

    updates.push({
      id: site.id,
      code: row.code,
      name: site.name,
      from: currentStatus,
      to: row.targetStatus,
    });
  }

  console.log(`Prepared ${updates.length} site updates.`);

  for (const update of updates) {
    await prisma.site.update({
      where: { id: update.id },
      data: {
        specStatus: update.to as any,
        specAvailable: specAvailableFromStatus(update.to),
      },
    });

    updated.push({
      code: update.code,
      name: update.name,
      from: update.from,
      to: update.to,
    });
  }

  console.log(
    JSON.stringify(
      {
        rowsRead: rows.length,
        renamedNotNeededRows: renamedNotNeeded.count,
        updatedRows: updated.length,
        skippedProtectedRows: skippedProtected.length,
        missingSiteRows: missingSites.length,
        unmappedJsonStatuses: Object.fromEntries(unmappedJsonStatuses),
        updatedSample: updated.slice(0, 20),
        skippedProtectedSample: skippedProtected.slice(0, 20),
        missingSiteSample: missingSites.slice(0, 20),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
