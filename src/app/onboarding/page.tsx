"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { authClient, useListOrganizations, useSession } from "@/lib/auth/client";
import { slugify } from "@/lib/auth/slug";
import { useAuthError } from "@/i18n/useAuthError";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, Field, SecondaryButton, SubmitButton } from "@/components/auth/fields";

export default function OnboardingPage() {
  const t = useTranslations("auth.onboarding");
  const authError = useAuthError();
  const { data: session, isPending } = useSession();
  const { data: orgs } = useListOrganizations();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) window.location.href = "/sign-in?from=/onboarding";
  }, [isPending, session]);

  function onName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    const finalSlug = slugify(slug);
    if (!name.trim() || !finalSlug) return setError(t("nameRequired"));
    setLoading(true);
    const check = await authClient.organization.checkSlug({ slug: finalSlug });
    if (check.error || !check.data?.status) {
      setError(t("slugTaken"));
      return setLoading(false);
    }
    const created = await authClient.organization.create({ name: name.trim(), slug: finalSlug });
    if (created.error || !created.data) {
      setError(authError(created.error, t("createFailed")));
      return setLoading(false);
    }
    const active = await authClient.organization.setActive({ organizationId: created.data.id });
    if (active.error) {
      setError(authError(active.error, t("switchAfterCreateFailed")));
      return setLoading(false);
    }
    window.location.assign("/analytics");
  }

  async function switchTo(id: string) {
    setError("");
    setSwitching(id);
    const { error: err } = await authClient.organization.setActive({ organizationId: id });
    if (err) {
      setError(authError(err, t("switchFailed")));
      return setSwitching(null);
    }
    window.location.assign("/analytics");
  }

  const hasOrgs = !!orgs && orgs.length > 0;

  return (
    <AuthShell
      title={hasOrgs ? t("chooseTitle") : t("createTitle")}
      subtitle={hasOrgs ? t("chooseSubtitle") : t("createSubtitle")}
    >
      <div className="flex flex-col gap-4">
        {hasOrgs && (
          <div className="flex flex-col gap-2">
            {orgs.map((o) => (
              <SecondaryButton key={o.id} onClick={() => switchTo(o.id)} loading={switching === o.id} disabled={!!switching}>
                {o.name}
              </SecondaryButton>
            ))}
            <div className="mt-2 text-xs uppercase tracking-widest text-slate-600">{t("orCreateNew")}</div>
          </div>
        )}
        <form onSubmit={create} className="flex flex-col gap-4">
          <Field label={t("organizationName")} type="text" autoComplete="organization" required value={name} onChange={(e) => onName(e.target.value)} />
          <Field
            label={t("slug")}
            type="text"
            autoComplete="off"
            required
            hint={t("slugHint")}
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
          />
          {error && <ErrorCallout>{error}</ErrorCallout>}
          <SubmitButton loading={loading} loadingLabel={t("submitting")} disabled={!!switching}>
            {t("submit")}
          </SubmitButton>
        </form>
      </div>
    </AuthShell>
  );
}
