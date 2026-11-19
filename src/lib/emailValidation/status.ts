import { and, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inOrg } from "@/lib/tenancy/scope";
import { emailValidations } from "./schema";

/**
 * Validation status per person for a page of the people list: one query for
 * the whole page, never one per row.
 *
 * The table only exists where scripts/create-email-validations.ts has run, so
 * a missing table is read as "no validation record" instead of failing the
 * list. The existence check is its own statement: a failed SELECT would abort
 * the surrounding transaction, while to_regclass just answers NULL.
 */
/** Once the table exists it stays: only "absent" is asked again. */
let tableExists = false;

const same = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export async function emailValidationStatuses(people: Array<{ id: string; email: string | null }>): Promise<Map<string, string>> {
  const statuses = new Map<string, string>();
  const withEmail = people.filter((person) => person.email);
  if (!withEmail.length) return statuses;
  if (!tableExists) {
    const [{ present }] = await db.execute<{ present: boolean }>(sql`select to_regclass('public.email_validations') is not null as present`);
    if (!present) return statuses;
    tableExists = true;
  }
  const personIds = withEmail.map((person) => person.id);
  const current = new Map(withEmail.map((person) => [person.id, person.email]));
  const rows = await db
    .select({ personId: emailValidations.personId, status: emailValidations.status, email: emailValidations.email })
    .from(emailValidations)
    .where(and(inOrg(emailValidations), inArray(emailValidations.personId, personIds)));
  // The record belongs to the address it was sent to: if the person's email changed since, it says nothing about the new one.
  for (const row of rows) if (same(row.email, current.get(row.personId) ?? null)) statuses.set(row.personId, row.status);
  return statuses;
}
