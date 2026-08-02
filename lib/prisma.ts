import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { normalizeDatabaseUrl } from "@/lib/database-url";
import { joburgTodayISO } from "@/lib/dateUtc";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

function extractWorkDate(data: unknown): Date | undefined {
  if (!data || typeof data !== "object") return undefined;
  const raw = (data as { workDate?: unknown }).workDate;
  if (raw instanceof Date) return raw;
  if (raw && typeof raw === "object" && "set" in raw) {
    const set = (raw as { set?: unknown }).set;
    return set instanceof Date ? set : undefined;
  }
  return undefined;
}

// Belt-and-suspenders guard against future-dated attendance: the supervisor
// scan API already rejects a future workDateISO (lib/supervisorScanPeriod.ts),
// but that only protects requests going through the API. One-off DB scripts
// (e.g. attendance backfill/seed scripts) write through this same prisma
// client and previously had no such protection — that's how a "seed" script
// once created a real MANUAL scan two days ahead of the actual work date.
function assertWorkDateNotFuture(workDate: Date | undefined) {
  if (!workDate) return;
  const workDateISO = workDate.toISOString().slice(0, 10);
  const todayISO = joburgTodayISO();
  if (workDateISO > todayISO) {
    throw new Error(
      `Refusing to write AttendanceScan with future workDate ${workDateISO} (today is ${todayISO} in Africa/Johannesburg).`,
    );
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: normalizeDatabaseUrl(connectionString!),
  });
  const base = new PrismaClient({ adapter });

  const extended = base.$extends({
    query: {
      attendanceScan: {
        create({ args, query }) {
          assertWorkDateNotFuture(extractWorkDate(args.data));
          return query(args);
        },
        createMany({ args, query }) {
          const rows = Array.isArray(args.data) ? args.data : [args.data];
          for (const row of rows) assertWorkDateNotFuture(extractWorkDate(row));
          return query(args);
        },
        upsert({ args, query }) {
          assertWorkDateNotFuture(extractWorkDate(args.create));
          assertWorkDateNotFuture(extractWorkDate(args.update));
          return query(args);
        },
        update({ args, query }) {
          assertWorkDateNotFuture(extractWorkDate(args.data));
          return query(args);
        },
        updateMany({ args, query }) {
          assertWorkDateNotFuture(extractWorkDate(args.data));
          return query(args);
        },
      },
    },
  });

  // $extends returns a differently-typed client (breaks every helper typed as
  // PrismaClient / Prisma.TransactionClient across the codebase). The object
  // still behaves identically at runtime — including inside interactive
  // $transaction callbacks — so it's safe to hand back under the original type.
  return extended as unknown as PrismaClient;
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cache across hot-reloads in dev and across invocations in production serverless
globalForPrisma.prisma = prisma;

export { prisma };
