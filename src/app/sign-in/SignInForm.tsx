"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, Field, InfoCallout, SecondaryButton, SubmitButton, linkClass, quietLinkClass } from "@/components/auth/fields";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";

/**
 * A mailto asking the instance's admin for an invite, carrying the email typed into the form when there is one.
 * Deliberately left in English: it is written to the people who run the instance, not shown to the person signing in.
 */
function accessRequestHref(to: string, email: string) {
  const body = [
    "Hi,",
    "",
    "I'd like an account on your AgentSDR. Could you send me an invite?",
    "",
    `Work email: ${email.trim()}`,
  ].join("\n");
  const subject = "I need access to AgentSDR";
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SignInForm({
  googleEnabled,
  from,
  signupAvailable = true,
  accessRequestEmail = null,
}: {
  googleEnabled: boolean;
  from: string | null;
  /** False on an invite-only instance: accounts come from invitations, so "Create one" is not offered. */
  signupAvailable?: boolean;
  /** Where "Need access?" writes to (ACCESS_REQUEST_EMAIL). Without it the sentence is shown without a link. */
  accessRequestEmail?: string | null;
}) {
  const t = useTranslations("auth.signIn");
  const tc = useTranslations("auth.common");
  const target = from || "/analytics";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setUnverified(false);
    setResent(false);
    setLoading(true);
    const { data, error: err } = await authClient.signIn.email({ email, password, callbackURL: target });
    if (!err) {
      // An AI assistant (OAuth) sign-in answers with the next step of that flow.
      const next = data as { redirect?: boolean; url?: unknown } | null;
      window.location.href = next?.redirect === true && typeof next.url === "string" ? next.url : target;
      return;
    }
    if (err.code === "EMAIL_NOT_VERIFIED") setUnverified(true);
    else if (err.code === "INVALID_EMAIL_OR_PASSWORD") setError(t("errors.invalidCredentials"));
    // err.message comes from Better Auth on the server, in English; only the fallback is translated.
    else setError(err.message || t("errors.generic"));
    setLoading(false);
  }

  async function resend() {
    setResending(true);
    const { error: err } = await authClient.sendVerificationEmail({ email, callbackURL: target });
    setResending(false);
    if (err) setError(err.message || t("errors.resendFailed"));
    else setResent(true);
  }

  const q = from ? `?from=${encodeURIComponent(from)}` : "";

  return (
    <AuthShell
      title={t("title")}
      footer={
        signupAvailable
          ? t.rich("noAccount", {
              link: (chunks) => (
                <Link href={`/sign-up${q}`} className={linkClass}>
                  {chunks}
                </Link>
              ),
            })
          : t.rich("needAccess", {
              link: (chunks) =>
                accessRequestEmail ? (
                  <a href={accessRequestHref(accessRequestEmail, email)} className={linkClass}>
                    {chunks}
                  </a>
                ) : (
                  chunks
                ),
            })
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field
          label={t("email")}
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label={t("password")}
          labelAside={
            <Link href="/forgot-password" className={quietLinkClass}>
              {t("forgotPassword")}
            </Link>
          }
          type="password"
          autoComplete="current-password"
          placeholder={t("passwordPlaceholder")}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <ErrorCallout>{error}</ErrorCallout>}
        {unverified && (
          <div className="flex flex-col gap-3">
            <ErrorCallout>{t("unverified")}</ErrorCallout>
            {resent ? (
              <InfoCallout>{t("verificationSent")}</InfoCallout>
            ) : (
              <SecondaryButton onClick={resend} loading={resending} disabled={!email}>
                {t("resendVerification")}
              </SecondaryButton>
            )}
          </div>
        )}
        <div className="pt-1">
          <SubmitButton loading={loading} loadingLabel={t("signingIn")}>
            {t("submit")}
          </SubmitButton>
        </div>
      </form>
      {googleEnabled && (
        <>
          <OrDivider label={tc("orContinueWith")} />
          <GoogleButton callbackURL={target} onError={setError} label={tc("google")} />
        </>
      )}
    </AuthShell>
  );
}
