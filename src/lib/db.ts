import { config } from "dotenv";
// Force-load .env, overriding any system-level DATABASE_URL (e.g. the
// sandbox's default SQLite URL) so Prisma picks up the Supabase connection.
config({ override: true });

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
