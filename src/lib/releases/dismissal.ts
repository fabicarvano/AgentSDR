import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userReleaseDismissals } from "./schema";

// user_release_dismissals is an auth-level table (tenancy AUTH_TABLES): the row
// is the person's own, not organization data, so there is no organization
// filter here — the userId always comes from the session, never from the
// request body.

/** The version of the release notes this person last dismissed, or null. */
export async function getDismissedRelease(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ version: userReleaseDismissals.version })
    .from(userReleaseDismissals)
    .where(eq(userReleaseDismissals.userId, userId))
    .limit(1);
  return row?.version ?? null;
}

export async function setDismissedRelease(userId: string, version: string): Promise<void> {
  await db
    .insert(userReleaseDismissals)
    .values({ userId, version })
    .onConflictDoUpdate({ target: userReleaseDismissals.userId, set: { version, updatedAt: sql`now()` } });
}
