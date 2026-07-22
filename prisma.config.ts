import "dotenv/config";
import { defineConfig } from "prisma/config";
import { normalizeDatabaseUrl } from "./lib/database-url";

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Missing DIRECT_URL and DATABASE_URL. Set at least one before running Prisma.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    url: normalizeDatabaseUrl(databaseUrl),
  },
});
