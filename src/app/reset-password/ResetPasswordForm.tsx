"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";
import { useAuthError } from "@/i18n/useAuthError";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, Field, InfoCallout, SubmitButton, linkClass } from "@/components/auth/fields";

/** Keep equal to emailAndPassword.minPasswordLength in src/lib/auth/server.ts. */
const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm({ token, invalid }: { token: string | null; invalid: boolean }) {
  const t = useTranslations("auth.resetPassword");
  const tc = useTranslations("auth.common");
  const authError = useAuthError();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN_PASSWORD_LENGTH) return setError(tc("passwordTooShort", { count: MIN_PASSWORD_LENGTH }));
    if (password !== confirm) return setError(t("mismatch"));
    if (!token) return;
    setLoading(true);
    const { error: err } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (err) setError(err.code === "INVALID_TOKEN" ? t("linkInvalid") : authError(err, tc("genericError")));
    else setDone(true);
  }

  if (invalid) {
    return (
      <AuthShell title={t("expiredTitle")} subtitle={t("expiredSubtitle")}>
        <Link href="/forgot-password" className={linkClass}>
          {t("requestNew")}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("title")}>
      {done ? (
        <div className="flex flex-col gap-3">
          <InfoCallout>{t("updated")}</InfoCallout>
          <Link href="/sign-in" className={linkClass}>
            {t("continueToSignIn")}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field
            label={t("newPassword")}
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            hint={tc("passwordHint", { count: MIN_PASSWORD_LENGTH })}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Field label={t("confirmPassword")} type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <ErrorCallout>{error}</ErrorCallout>}
          <SubmitButton loading={loading} loadingLabel={t("saving")}>
            {t("submit")}
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
