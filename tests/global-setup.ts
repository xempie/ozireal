import { execFileSync } from "node:child_process";
import postgres from "postgres";

/**
 * Build a dedicated test database, migrate it and seed it, once per run.
 *
 * Tests run against a REAL Postgres rather than a mock, because the things worth
 * testing here are things only a database can enforce: append-only triggers, check
 * constraints, and row-level security. A mock would pass every one of them while the
 * production database refused the same write.
 */

const ADMIN = process.env.TEST_ADMIN_URL ?? "postgres://ozirealty@127.0.0.1:5433/postgres";
const TEST_DB = "ozirealty_test";
export const TEST_URL =
  process.env.TEST_DATABASE_URL ?? `postgres://ozirealty@127.0.0.1:5433/${TEST_DB}`;

export default async function setup() {
  const admin = postgres(ADMIN, { max: 1, onnotice: () => {} });
  try {
    // Drop first so every run starts from a known state - a test suite that depends on
    // leftovers from the last run is a test suite that passes for the wrong reason.
    await admin.unsafe(
      `select pg_terminate_backend(pid) from pg_stat_activity
       where datname = '${TEST_DB}' and pid <> pg_backend_pid()`,
    );
    await admin.unsafe(`drop database if exists ${TEST_DB}`);
    await admin.unsafe(`create database ${TEST_DB}`);
  } finally {
    await admin.end();
  }

  const env = { ...process.env, DATABASE_URL: TEST_URL, PGDATABASE: TEST_DB };

  execFileSync("bash", ["scripts/db-apply.sh"], { env, stdio: "pipe" });
  execFileSync("node", ["node_modules/tsx/dist/cli.mjs", "src/db/seed/index.ts"], {
    env,
    stdio: "pipe",
  });

  process.env.DATABASE_URL = TEST_URL;
}
