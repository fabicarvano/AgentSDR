/**
 * "What's new" pop-up: creates user_release_dismissals, one row per user with
 * the version of the release notes (content/releases.json) they dismissed.
 * Matches src/lib/releases/schema.ts; an auth-level table in
 * src/lib/tenancy/registry.ts.
 *
 * Run with:  bun scripts/add-user-release-dismissals.ts
 * In Docker: docker compose exec app agentsdr-entrypoint bun scripts/add-user-release-dismissals.ts
 *            (the entrypoint supplies DATABASE_URL for the bundled database)
 *
 * Until it exists only the pop-up fails (the API answers 500 and the
 * component ignores it); sign-in and everything else keep working.
 *
 * Additive and re-runnable: the statement is guarded with IF NOT EXISTS.
 */
import { SQL } from "bun";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set — check .env.local");
  process.exit(1);
}

const db = new SQL(databaseUrl, { max: 1, tls: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false } });

try {
  await db.unsafe(`SET lock_timeout = '5s'`);
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS user_release_dismissals (
      user_id uuid NOT NULL,
      version text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT user_release_dismissals_pkey PRIMARY KEY (user_id),
      CONSTRAINT user_release_dismissals_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  const [row] = await db`select to_regclass('public.user_release_dismissals') is not null as present`;
  console.log(`user_release_dismissals ${row.present ? "present" : "MISSING"}`);
  if (!row.present) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.close();
}
