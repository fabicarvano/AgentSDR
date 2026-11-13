"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, Field, SubmitButton } from "@/components/auth/fields";
import { MIN_PASSWORD_LENGTH, validateSetupInput } from "@/lib/auth/setupInput";

export function SetupForm() {
  const t = useTranslations("auth.setup");
  const tc = useTranslations("auth.common");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    // The organization's time zone starts as the browser's (Settings → Organization changes it).
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parsed = validateSetupInput({ name, organizationName, email, password, timeZone });
    // parsed.error and data.error are English messages written in lib/ and the API route: translated in a later batch.
    if (!parsed.ok) return setError(parsed.error);
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; signedIn?: boolean };
      if (res.status === 409) return void window.location.assign("/sign-in");
      if (!res.ok) {
        setError(data.error || tc("genericError"));
        return setLoading(false);
      }
      // If the account was made but the automatic sign-in failed, sign in by hand.
      window.location.assign(data.signedIn ? "/analytics" : "/sign-in");
    } catch {
      setError(t("unreachable"));
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t("name")} type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label={t("organizationName")} type="text" autoComplete="organization" required value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
        <Field label={t("email")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label={t("password")}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          hint={tc("passwordHint", { count: MIN_PASSWORD_LENGTH })}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <ErrorCallout>{error}</ErrorCallout>}
        <SubmitButton loading={loading} loadingLabel={t("submitting")}>
          {t("submit")}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
