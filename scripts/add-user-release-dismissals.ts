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
 * Additive and re-runnable: every statement is guarded.
 */
import { SQL } from "bun";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS user_release_dismissals (
     user_id uuid NOT NULL,
     version text NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT user_release_dismissals_pkey PRIMARY KEY (user_id),
     CONSTRAINT user_release_dismissals_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   )`,
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — check .env.local");
  const sql = new SQL(url, {
    max: 1,
    tls: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  });
  try {
    await sql.unsafe("SET lock_timeout = '5s'");
    await sql.unsafe("SET statement_timeout = '2min'");
    for (const statement of STATEMENTS) await sql.unsafe(statement);
    const [{ present }] = await sql`select to_regclass('public.user_release_dismissals') is not null as present`;
    console.log(`user_release_dismissals ${present ? "present" : "MISSING"}`);
    if (!present) process.exitCode = 1;
  } finally {
    await sql.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
