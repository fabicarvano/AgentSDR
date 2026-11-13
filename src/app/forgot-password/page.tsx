"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, InfoCallout, SubmitButton, linkClass } from "@/components/auth/fields";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const tc = useTranslations("auth.common");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    // The outcome is never shown, so the page can't be used to probe which emails have accounts.
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }).catch(() => null);
    setLoading(false);
    setDone(true);
  }

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <Link href="/sign-in" className={linkClass}>
          {tc("backToSignIn")}
        </Link>
      }
    >
      {done ? (
        <InfoCallout>{t("done", { email })}</InfoCallout>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t("email")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <SubmitButton loading={loading} loadingLabel={t("sending")}>
            {t("submit")}
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
