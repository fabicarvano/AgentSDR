/**
 * How the email slot of the Reach column looks for each email_validations
 * status. Pure on purpose: LeadCells renders it, reachEmail.test.ts pins it.
 * Colour is never the only signal: every state has its own badge and wording.
 */

export type EmailBadge = "clock" | "check" | "fire" | "x" | "question";

/** Key under leads.cells.reach.status in the catalogs. */
export type EmailStatusKey = "unverified" | "verifying" | "validated" | "validatedPresumed" | "validatedHot" | "invalid" | "unconfirmed";

export type EmailReach = { statusKey: EmailStatusKey; colorClass: string; badge: EmailBadge | null };

const UNVERIFIED: EmailReach = { statusKey: "unverified", colorClass: "text-text-soft-400", badge: null };

const BY_STATUS: Record<string, EmailReach> = {
  // Queued mail is waiting to be sent: from the person's side it is "being verified".
  na_fila: { statusKey: "verifying", colorClass: "text-warning-base", badge: "clock" },
  validando: { statusKey: "verifying", colorClass: "text-warning-base", badge: "clock" },
  valido: { statusKey: "validated", colorClass: "text-success-base", badge: "check" },
  valido_presumido: { statusKey: "validatedPresumed", colorClass: "text-green-400", badge: "check" },
  valido_ativo: { statusKey: "validatedHot", colorClass: "text-green-700", badge: "fire" },
  invalido: { statusKey: "invalid", colorClass: "text-error-base", badge: "x" },
  temporario: { statusKey: "unconfirmed", colorClass: "text-warning-base", badge: "question" },
  indeterminado: { statusKey: "unconfirmed", colorClass: "text-warning-base", badge: "question" },
};

/** `null` (no record, or no table) and any status this build does not know read as "not verified". */
export function emailReach(status: string | null | undefined): EmailReach {
  return (status ? BY_STATUS[status] : undefined) ?? UNVERIFIED;
}
