/**
 * Removes the email validation feature's table. The feature (a validation
 * email sent to every new Person, classified from Resend's webhook events) was
 * taken out of the app; scripts/create-email-validations.ts stays as the
 * record of how the table was built.
 *
 * Run with:  bun run scripts/drop-email-validations.ts
 *
 * Destructive: the rows are the only copy of each address's validation result.
 * Export them first if you want to keep them:
 *   \copy email_validations TO 'email_validations.csv' CSV HEADER
 *
 * Re-runnable: it does nothing when the table is already gone.
 */
import { Client } from "pg";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set, check .env.local");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("SET lock_timeout = '5s'");
    const { rows: before } = await client.query<{ rows: string }>(
      `SELECT CASE WHEN to_regclass('public.email_validations') IS NULL THEN '0' ELSE (SELECT count(*)::text FROM email_validations) END AS rows`,
    );
    await client.query("DROP TABLE IF EXISTS email_validations");
    console.log(`email_validations dropped (${before[0]?.rows ?? "0"} rows removed)`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
