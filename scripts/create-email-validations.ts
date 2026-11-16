/**
 * Email validation via Resend: one row per Person, tracking what Resend's
 * webhook events say about a validation email. Matches
 * src/lib/emailValidation/schema.ts and src/lib/tenancy/registry.ts.
 *
 * Run with:  bun run scripts/create-email-validations.ts
 *
 * - status: validando | invalido | temporario | indeterminado | valido | valido_ativo | valido_presumido
 * - person_id is unique: one validation per person.
 * - resend_email_id is how the (public) webhook finds the row and its organization.
 *
 * Additive and re-runnable: every statement is guarded.
 */
import { Client } from "pg";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS email_validations (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id uuid NOT NULL REFERENCES organizations(id),
     person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
     email text NOT NULL,
     status text NOT NULL DEFAULT 'validando',
     resend_email_id text,
     sent_at timestamptz,
     resolved_at timestamptz,
     expires_at timestamptz,
     last_event text,
     last_event_at timestamptz,
     bounce_type text,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS email_validations_person_uq ON email_validations (person_id)`,
  `CREATE INDEX IF NOT EXISTS email_validations_organization_idx ON email_validations (organization_id)`,
  `CREATE INDEX IF NOT EXISTS email_validations_person_idx ON email_validations (person_id)`,
  `CREATE INDEX IF NOT EXISTS email_validations_resend_email_idx ON email_validations (resend_email_id)`,
  `CREATE INDEX IF NOT EXISTS email_validations_expires_idx ON email_validations (expires_at)`,
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set, check .env.local");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("SET lock_timeout = '5s'");
    await client.query("SET statement_timeout = '2min'");
    for (const statement of STATEMENTS) await client.query(statement);
    const { rows } = await client.query<{ present: boolean }>(
      `SELECT to_regclass('public.email_validations') IS NOT NULL AS present`,
    );
    console.log(`email_validations ${rows[0]?.present ? "present" : "MISSING"}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
