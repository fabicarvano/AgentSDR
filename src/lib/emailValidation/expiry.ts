import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Closes validations that stayed silent for 72h as "valido_presumido".
 * Platform-wide on purpose (every organization in one statement), like the
 * other scheduler jobs; it only reads and writes email_validations.
 * Returns how many rows it closed.
 */
export async function markExpiredValidations(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE email_validations
    SET status = 'valido_presumido', resolved_at = now(), updated_at = now()
    WHERE status = 'validando' AND expires_at < now()
  `);
  return result.length;
}
