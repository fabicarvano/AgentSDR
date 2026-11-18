import "server-only";

import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { LeadExecutor } from "@/lib/leads/records";
import { people } from "@/lib/leads/schema";
import { suppressionList } from "@/lib/outreach/schema";
import { inOrg, runInOrganization } from "@/lib/tenancy/scope";
import {
  BATCH_SIZE,
  QUEUE_EVENT,
  SEND_GAP_MS,
  dailyLimit,
  pauseUntil,
  retryDelayMs,
  sendBudget,
  type ResendFailure,
} from "./resendErrors";
import { emailValidations } from "./schema";
import { sendValidationEmail } from "./sender";

const WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * Puts a Person's email in the validation queue. Runs inside the caller's
 * transaction, so the row exists exactly when the person does, and sends
 * nothing: processEmailValidationQueue() does, at a controlled pace.
 * One row per person; a second call changes nothing.
 */
export async function enqueueEmailValidation(
  tx: Pick<LeadExecutor, "insert">,
  input: { personId: string; organizationId: string; email: string },
): Promise<void> {
  await tx
    .insert(emailValidations)
    .values({ organizationId: input.organizationId, personId: input.personId, email: input.email.trim().toLowerCase(), status: "na_fila" })
    .onConflictDoNothing({ target: emailValidations.personId });
}

export type QueueSummary = {
  sent: number;
  rejected: number;
  suppressed: number;
  retried: number;
  /** Why the run ended early, if it did. */
  stopped: "daily_limit" | "no_api_key" | ResendFailure | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends queued validation emails: a small batch per run, at most
 * EMAIL_VALIDATION_DAILY_LIMIT per UTC day. Platform-wide (every organization
 * in one pass, like the other scheduler jobs); each row is handled inside its
 * own organization's scope. Quota and configuration errors from Resend pause
 * the whole queue (next_attempt_at) instead of failing row by row.
 */
export async function processEmailValidationQueue(now: Date = new Date()): Promise<QueueSummary> {
  const summary: QueueSummary = { sent: 0, rejected: 0, suppressed: 0, retried: 0, stopped: null };
  if (!process.env.RESEND_API_KEY) {
    console.warn("[emailValidation] RESEND_API_KEY is not set: the validation queue is not being sent");
    return { ...summary, stopped: "no_api_key" };
  }

  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [{ count: sentToday }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailValidations)
    .where(gte(emailValidations.sentAt, startOfDay));
  const budget = sendBudget(dailyLimit(process.env.EMAIL_VALIDATION_DAILY_LIMIT), sentToday, BATCH_SIZE);
  if (budget === 0) return { ...summary, stopped: "daily_limit" };

  const due = await db
    .select()
    .from(emailValidations)
    .where(and(eq(emailValidations.status, "na_fila"), or(isNull(emailValidations.nextAttemptAt), lte(emailValidations.nextAttemptAt, now))))
    .orderBy(emailValidations.createdAt)
    .limit(budget);

  for (const [index, row] of due.entries()) {
    if (index > 0) await sleep(SEND_GAP_MS);
    const outcome = await runInOrganization(row.organizationId, async () => {
      const at = new Date();
      const [suppressed] = await db
        .select({ id: suppressionList.id })
        .from(suppressionList)
        .where(and(inOrg(suppressionList), eq(suppressionList.email, row.email)))
        .limit(1);
      if (suppressed) {
        await db
          .update(emailValidations)
          .set({ status: "invalido", resolvedAt: at, lastEvent: QUEUE_EVENT.suppressed, lastEventAt: at, updatedAt: at })
          .where(and(inOrg(emailValidations), eq(emailValidations.id, row.id)));
        return "suppressed" as const;
      }

      const [person] = await db
        .select({ firstName: people.firstName, fullName: people.fullName })
        .from(people)
        .where(and(inOrg(people), eq(people.id, row.personId)))
        .limit(1);
      const result = await sendValidationEmail(row.email, person?.firstName ?? person?.fullName ?? null);

      if (result.ok) {
        const sentAt = new Date();
        await db
          .update(emailValidations)
          .set({
            status: "validando",
            resendEmailId: result.resendEmailId,
            sentAt,
            expiresAt: new Date(sentAt.getTime() + WINDOW_MS),
            lastEvent: null,
            lastEventAt: null,
            nextAttemptAt: null,
            updatedAt: sentAt,
          })
          .where(and(inOrg(emailValidations), eq(emailValidations.id, row.id)));
        return "sent" as const;
      }

      console.error(`[emailValidation] send failed (${result.failure}, status ${result.status ?? "none"}): ${result.detail}`);
      if (result.failure === "invalid_email") {
        await db
          .update(emailValidations)
          .set({ status: "invalido", resolvedAt: at, lastEvent: QUEUE_EVENT.rejected, lastEventAt: at, updatedAt: at })
          .where(and(inOrg(emailValidations), eq(emailValidations.id, row.id)));
        // An address Resend refuses as malformed is as unusable as a hard bounce: keep every campaign from trying it.
        await db
          .insert(suppressionList)
          .values({ organizationId: row.organizationId, email: row.email, reason: "bounced", note: "email validation: rejected by Resend" })
          .onConflictDoNothing({ target: [suppressionList.organizationId, suppressionList.email] });
        return "rejected" as const;
      }
      if (result.failure === "transient") {
        await db
          .update(emailValidations)
          .set({
            attempts: row.attempts + 1,
            nextAttemptAt: new Date(at.getTime() + retryDelayMs(row.attempts + 1)),
            lastEvent: QUEUE_EVENT.retry,
            lastEventAt: at,
            updatedAt: at,
          })
          .where(and(inOrg(emailValidations), eq(emailValidations.id, row.id)));
        return "retried" as const;
      }
      return result.failure; // daily_quota | monthly_quota | config | rate_limit: handled below, row stays queued
    });

    if (outcome === "sent" || outcome === "rejected" || outcome === "suppressed" || outcome === "retried") {
      summary[outcome] += 1;
      continue;
    }

    // The failure is about the account, not this row: stop the run, and for
    // quota/config errors hold the whole queue until it can work again.
    summary.stopped = outcome;
    const until = pauseUntil(outcome, new Date());
    if (until) {
      const event =
        outcome === "daily_quota" ? QUEUE_EVENT.dailyQuota : outcome === "monthly_quota" ? QUEUE_EVENT.monthlyQuota : QUEUE_EVENT.config;
      await db
        .update(emailValidations)
        .set({ nextAttemptAt: until, lastEvent: event, lastEventAt: new Date(), updatedAt: new Date() })
        .where(eq(emailValidations.status, "na_fila"));
      console.error(`[emailValidation] queue paused until ${until.toISOString()} (${outcome})`);
    }
    break;
  }
  return summary;
}
