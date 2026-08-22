import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://ozirealty@127.0.0.1:5433/ozirealty",
  },
  verbose: true,
  strict: true,
} satisfies Config;
