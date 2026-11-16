import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "@/lib/auth/schema";
import { people } from "@/lib/leads/schema";

export type EmailValidationStatus =
  | "validando"
  | "invalido"
  | "temporario"
  | "indeterminado"
  | "valido"
  | "valido_ativo"
  | "valido_presumido";

/**
 * What Resend's events say about one Person's email (scripts/create-email-validations.ts).
 * One row per person; `resendEmailId` is how the webhook finds it.
 */
export const emailValidations = pgTable(
  "email_validations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    status: text("status").notNull().default("validando").$type<EmailValidationStatus>(),
    resendEmailId: text("resend_email_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastEvent: text("last_event"),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    bounceType: text("bounce_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("email_validations_person_uq").on(t.personId),
    index("email_validations_organization_idx").on(t.organizationId),
    index("email_validations_person_idx").on(t.personId),
    index("email_validations_resend_email_idx").on(t.resendEmailId),
    index("email_validations_expires_idx").on(t.expiresAt),
  ],
);
