import "server-only";
import type { Locale } from "@/i18n/config";
import { authEmail, authEmailTranslator, type AuthEmail } from "./email";

/** How long an organization invitation stays valid: the plugin's expiry and the sentence in the email read the same number. */
export const INVITATION_EXPIRES_DAYS = 7;

/**
 * What each auth email says, in the language of whoever made the request
 * (localeFromRequest). Kept apart from server.ts so it can be tested without
 * a database: Better Auth's hooks only pick the language and send.
 */

/** Sign-up: confirm the address. */
export function verificationEmail(locale: Locale, input: { user: { email: string; name: string }; url: string }): AuthEmail {
  const t = authEmailTranslator(locale);
  return authEmail({
    locale,
    to: input.user.email,
    subject: t("verification.subject"),
    intro: t("verification.intro", { name: input.user.name }),
    action: t("verification.action"),
    url: input.url,
  });
}

/** "Forgot password": the link to choose a new one. */
export function resetPasswordEmail(locale: Locale, input: { user: { email: string }; url: string }): AuthEmail {
  const t = authEmailTranslator(locale);
  return authEmail({
    locale,
    to: input.user.email,
    subject: t("resetPassword.subject"),
    intro: t("resetPassword.intro"),
    action: t("resetPassword.action"),
    url: input.url,
  });
}

/** An invitation to an organization. `locale` is the inviter's: the invitee has no language on record. */
export function invitationEmail(
  locale: Locale,
  input: { to: string; url: string; organizationName: string; inviterName: string; inviterEmail: string },
): AuthEmail {
  const t = authEmailTranslator(locale);
  const names = { inviter: input.inviterName, org: input.organizationName };
  return authEmail({
    locale,
    to: input.to,
    subject: t("invitation.subject", names),
    intro: t("invitation.intro", { ...names, inviterEmail: input.inviterEmail }),
    action: t("invitation.action"),
    url: input.url,
    outro: t("invitation.outro", { days: INVITATION_EXPIRES_DAYS }),
  });
}
