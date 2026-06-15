import "dotenv/config";
import { normalizeDatabaseUrl } from "./lib/database-url";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL. Set it in your environment (or .env) before running Prisma.",
  );
}

const prismaConfig = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: normalizeDatabaseUrl(DATABASE_URL),
  },
};

export default prismaConfig;
