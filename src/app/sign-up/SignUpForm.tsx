"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";
import { useAuthError } from "@/i18n/useAuthError";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, Field, InfoCallout, SecondaryButton, SubmitButton, linkClass } from "@/components/auth/fields";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";

/** Keep equal to emailAndPassword.minPasswordLength in src/lib/auth/server.ts. */
const MIN_PASSWORD_LENGTH = 8;

export function SignUpForm({ googleEnabled, from, inviteOnly = false }: { googleEnabled: boolean; from: string | null; inviteOnly?: boolean }) {
  const t = useTranslations("auth.signUp");
  const tc = useTranslations("auth.common");
  const authError = useAuthError();
  const target = from || "/analytics";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(tc("passwordTooShort", { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    setLoading(true);
    const { error: err } = await authClient.signUp.email({ name, email, password, callbackURL: target });
    setLoading(false);
    if (err) {
      setError(
        err.code === "USER_ALREADY_EXISTS" || err.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
          ? t("errors.alreadyExists")
          : authError(err, tc("genericError")),
      );
      return;
    }
    setSent(true);
  }

  async function resend() {
    setResending(true);
    setError("");
    const { error: err } = await authClient.sendVerificationEmail({ email, callbackURL: target });
    setResending(false);
    if (err) setError(authError(err, tc("resendFailed")));
    else setResent(true);
  }

  const q = from ? `?from=${encodeURIComponent(from)}` : "";
  const footer = t.rich("haveAccount", {
    link: (chunks) => (
      <Link href={`/sign-in${q}`} className={linkClass}>
        {chunks}
      </Link>
    ),
  });

  if (sent) {
    return (
      <AuthShell title={t("sentTitle")} subtitle={t("sentSubtitle", { email })} footer={footer}>
        <div className="flex flex-col gap-3">
          {inviteOnly && <InfoCallout>{t("sentInviteOnly", { email })}</InfoCallout>}
          {error && <ErrorCallout>{error}</ErrorCallout>}
          {resent ? (
            <InfoCallout>{t("resent")}</InfoCallout>
          ) : (
            <SecondaryButton onClick={resend} loading={resending}>
              {t("resend")}
            </SecondaryButton>
          )}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("title")} footer={footer}>
      {inviteOnly && (
        <div className="mb-5">
          <InfoCallout>{t("inviteOnly")}</InfoCallout>
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label={t("name")} type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label={t("email")} type="email" autoComplete="email" placeholder={t("emailPlaceholder")} required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label={t("password")}
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          hint={tc("passwordHint", { count: MIN_PASSWORD_LENGTH })}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <ErrorCallout>{error}</ErrorCallout>}
        <div className="pt-1">
          <SubmitButton loading={loading} loadingLabel={t("submitting")}>
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
