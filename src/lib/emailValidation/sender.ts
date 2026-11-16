import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { people } from "@/lib/leads/schema";
import { suppressionList } from "@/lib/outreach/schema";
import { runInOrganization, inOrg } from "@/lib/tenancy/scope";
import { emailValidations } from "./schema";

const WINDOW_MS = 72 * 60 * 60 * 1000;
const DEFAULT_FROM = "noreply@restricaonuncamais.com.br";

/**
 * Subject, plain text and a minimal HTML part of the validation email,
 * addressed by first name. The HTML is the same text with only the signature
 * formatted: a lighter message is less likely to land in spam, and the HTML
 * part is what lets Resend track opens.
 */
function buildMessage(name: string | null) {
  // Single line: the name goes into the subject header.
  const firstName = (name ?? "").replace(/\s+/g, " ").trim().split(" ")[0] || "tudo bem";
  const subject = `${firstName}, saiba como melhorar seu score de crédito`;
  const lines = [
    `Olá, ${firstName}!`,
    "Preparamos dicas simples para você melhorar seu score de crédito e sair da restrição.",
    "Em breve enviaremos mais novidades. Fique de olho na sua caixa de entrada!",
  ];
  const signature = "Equipe Restrição Nunca Mais";
  const escape = (value: string) =>
    value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const text = `${lines.join("\n")}\n\n${signature}`;
  const html = `${lines.map((line) => `<p>${escape(line)}</p>`).join("")}<p><strong>${signature}</strong></p>`;
  return { subject, text, html };
}

/**
 * Sends one validation email for a Person and starts the 72h watch. Resend's
 * webhook (webhook.ts) resolves the status; expiry.ts closes what stays silent.
 * Safe to call more than once per person: a row already there ends it.
 */
export async function triggerEmailValidation(personId: string, organizationId: string): Promise<void> {
  return runInOrganization(organizationId, async () => {
    const [person] = await db
      .select({ id: people.id, email: people.email, firstName: people.firstName, fullName: people.fullName })
      .from(people)
      .where(and(inOrg(people), eq(people.id, personId)))
      .limit(1);
    const email = person?.email?.trim().toLowerCase();
    if (!person || !email) return;

    const [existing] = await db
      .select({ id: emailValidations.id })
      .from(emailValidations)
      .where(and(inOrg(emailValidations), eq(emailValidations.personId, personId)))
      .limit(1);
    if (existing) return;

    const [suppressed] = await db
      .select({ id: suppressionList.id })
      .from(suppressionList)
      .where(and(inOrg(suppressionList), eq(suppressionList.email, email)))
      .limit(1);
    if (suppressed) {
      const now = new Date();
      await db
        .insert(emailValidations)
        .values({ organizationId, personId, email, status: "invalido", resolvedAt: now, lastEvent: "suppressed", lastEventAt: now })
        .onConflictDoNothing({ target: emailValidations.personId });
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[emailValidation] RESEND_API_KEY is not set: validation email not sent");
      return;
    }

    // Claim the person first (unique person_id) so two concurrent calls cannot both send.
    const [claimed] = await db
      .insert(emailValidations)
      .values({ organizationId, personId, email, status: "validando" })
      .onConflictDoNothing({ target: emailValidations.personId })
      .returning({ id: emailValidations.id });
    if (!claimed) return;

    const message = buildMessage(person.firstName ?? person.fullName);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_VALIDATION_FROM || DEFAULT_FROM,
          to: [email],
          ...message,
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend refused the email (${response.status}): ${(await response.text()).slice(0, 200)}`);
      }
      const body = (await response.json()) as { id?: string };
      const now = new Date();
      await db
        .update(emailValidations)
        .set({ resendEmailId: body.id ?? null, sentAt: now, expiresAt: new Date(now.getTime() + WINDOW_MS), updatedAt: now })
        .where(and(inOrg(emailValidations), eq(emailValidations.id, claimed.id)));
    } catch (error) {
      // Nothing was sent: release the claim so a later call can retry.
      await db.delete(emailValidations).where(and(inOrg(emailValidations), eq(emailValidations.id, claimed.id)));
      throw error;
    }
  });
}

// Callers create people inside a transaction that may not have committed yet:
// try again a little later, and stop silently if the person never appears.
const RETRY_DELAYS_MS = [3_000, 30_000, 5 * 60_000];

/**
 * Fire-and-forget entry point for code that inserts a Person. Waits for the
 * surrounding transaction to commit, never throws and never blocks the caller.
 */
export function queueEmailValidation(personId: string, organizationId: string): void {
  const attempt = (index: number) => {
    const timer = setTimeout(() => {
      triggerEmailValidation(personId, organizationId)
        .then(async () => {
          if (index + 1 >= RETRY_DELAYS_MS.length) return;
          const [found] = await db
            .select({ id: emailValidations.id })
            .from(emailValidations)
            .where(eq(emailValidations.personId, personId))
            .limit(1);
          // No row yet: the person was not visible (uncommitted) or has no email. Check again later.
          if (!found) attempt(index + 1);
        })
        .catch((error) => console.error("[emailValidation] trigger failed:", error));
    }, RETRY_DELAYS_MS[index]);
    timer.unref?.();
  };
  attempt(0);
}
