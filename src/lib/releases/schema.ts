import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/lib/auth/schema";

/**
 * The "What's new" release notes (content/releases.json) a person dismissed:
 * one row per user, holding the version. A table of its own, not a column on
 * `users`, because Better Auth selects every column of `users` that the
 * schema declares: a column missing from the database would break sign-in for
 * everyone, while a missing table only fails the pop-up. Built by
 * scripts/add-user-release-dismissals.ts; an auth-level table in
 * src/lib/tenancy/registry.ts (a person's own row, no organization).
 */
export const userReleaseDismissals = pgTable("user_release_dismissals", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
