/**
 * What to do with a failed Resend send. Pure functions (no I/O) so the rules
 * are tested; queue.ts applies them.
 */

export type ResendFailure =
  /** Daily sending quota used up: pause the whole queue until 00:00 UTC. */
  | "daily_quota"
  /** Monthly quota used up (or no credits): pause until the 1st of next month. */
  | "monthly_quota"
  /** Too many requests per second: stop this batch, try again next run. */
  | "rate_limit"
  /** Key invalid/suspended/restricted, domain not verified, malformed request: pause 1 hour. */
  | "config"
  /** Resend rejected this recipient: the address is not valid. */
  | "invalid_email"
  /** Network error or 5xx: retry this row later, with backoff. */
  | "transient";

export type ResendErrorBody = { name?: string; message?: string } | null;

const HOUR_MS = 60 * 60 * 1000;
const MAX_BACKOFF_MS = 6 * HOUR_MS;

/** Error names are Resend's (https://resend.com/docs/api-reference/errors). */
export function classifyResendError(status: number | null, body: ResendErrorBody): ResendFailure {
  if (status === null || status >= 500) return "transient";
  const name = body?.name ?? "";
  if (status === 429) {
    if (name === "daily_quota_exceeded") return "daily_quota";
    if (name === "monthly_quota_exceeded") return "monthly_quota";
    return "rate_limit";
  }
  if (status === 401 || status === 403) return "config";
  if (status === 400 || status === 422) {
    // Resend has no dedicated error for a bad recipient: it is a validation_error that names the `to` field.
    if (name === "validation_error" && /\bto\b|recipient/i.test(body?.message ?? "")) return "invalid_email";
    return "config";
  }
  return "transient";
}

/** When the whole queue may try again after `failure`, or null when only this run stops. */
export function pauseUntil(failure: ResendFailure, now: Date): Date | null {
  switch (failure) {
    case "daily_quota":
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    case "monthly_quota":
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    case "config":
      return new Date(now.getTime() + HOUR_MS);
    default:
      return null;
  }
}

/** Backoff for one row that failed transiently: 2, 4, 8… minutes, at most 6 hours. */
export function retryDelayMs(attempts: number): number {
  return Math.min(2 ** Math.max(attempts, 1) * 60_000, MAX_BACKOFF_MS);
}

export const DEFAULT_DAILY_LIMIT = 100;
export const BATCH_SIZE = 20;
export const SEND_GAP_MS = 600;

/** EMAIL_VALIDATION_DAILY_LIMIT: a whole number ≥ 0; anything else falls back to the default. */
export function dailyLimit(raw: string | undefined): number {
  const value = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isInteger(value) && value >= 0 ? value : DEFAULT_DAILY_LIMIT;
}

/** How many emails this run may send: the batch size, capped by what is left of today's limit. */
export function sendBudget(limit: number, sentToday: number, batch: number = BATCH_SIZE): number {
  return Math.max(0, Math.min(batch, limit - sentToday));
}

/** `last_event` values this module writes while a row waits in the queue. */
export const QUEUE_EVENT = {
  dailyQuota: "quota_diaria_excedida",
  monthlyQuota: "quota_mensal_excedida",
  config: "erro_configuracao_resend",
  rejected: "rejeitado_resend",
  retry: "falha_envio",
  suppressed: "suppressed",
} as const;
