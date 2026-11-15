"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import { Callout, Field } from "@/components/settings/SettingsKit";
import { authClient } from "@/lib/auth/client";
import { useAsyncAction, useOrgAccess } from "./useOrgAccess";

// A URL scheme, not words: shown as it is in every language.
const URL_PLACEHOLDER = "https://";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

export function OrgGeneral() {
  const t = useTranslations("settingsOrg.general");
  const ts = useTranslations("settingsOrg.state");
  const tr = useTranslations("settingsOrg.roles");
  const { org, role, loading, error: loadError, can, reload } = useOrgAccess();
  const dialogs = useDialogs();
  const { busy, error, setError, run } = useAsyncAction();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logo, setLogo] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!org) return;
    // Seed the form once the organization arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(org.name);
    setSlug(org.slug);
    setLogo(org.logo ?? "");
  }, [org]);

  if (loading) return <p className="text-paragraph-sm text-text-sub-600">{ts("loading")}</p>;
  if (!org || !role) return <Callout tone="error">{loadError || ts("noActiveOrganization")}</Callout>;

  const canEdit = can({ organization: ["update"] });
  const dirty = name.trim() !== org.name || slugify(slug) !== org.slug || logo.trim() !== (org.logo ?? "");

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!org) return;
    setSaved(false);
    const finalSlug = slugify(slug);
    if (!name.trim() || !finalSlug) return setError(t("nameAndSlugRequired"));
    if (finalSlug !== org.slug) {
      const check = await authClient.organization.checkSlug({ slug: finalSlug });
      if (check.error || !check.data?.status) return setError(t("slugTaken"));
    }
    const ok = await run("save", () =>
      authClient.organization.update({
        organizationId: org.id,
        data: { name: name.trim(), slug: finalSlug, logo: logo.trim() || undefined },
      }),
    );
    if (ok) {
      // Refresh in place: a full page reload would turn the settings pop-up into the
      // standalone /settings page. The sidebar's Better Auth atoms refetch on their own
      // after /organization/update.
      await reload();
      setSaved(true);
    }
  }

  async function leave() {
    if (!org) return;
    const confirmed = await dialogs.confirm({
      title: t("leaveConfirmTitle", { name: org.name }),
      description: t("leaveConfirmDescription"),
      confirmLabel: t("leaveOrganization"),
      variant: "error",
    });
    if (!confirmed) return;
    const ok = await run("leave", () => authClient.organization.leave({ organizationId: org.id }));
    if (ok) window.location.assign("/onboarding");
  }

  return (
    <div className="flex flex-col gap-6">
      <Frame>
        <FrameHeader title={t("title")} description={t("yourRole", { role: tr(role) })} />
        <FramePanel>
          <form onSubmit={save} className="flex flex-col gap-4">
            <Field label={t("nameLabel")} htmlFor="org-name" required>
              <Input.Root size="medium">
                <Input.Wrapper>
                  <Input.Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
                </Input.Wrapper>
              </Input.Root>
            </Field>
            <Field label={t("slugLabel")} htmlFor="org-slug" description={t("slugDescription")} required>
              <Input.Root size="medium">
                <Input.Wrapper>
                  <Input.Input id="org-slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!canEdit} />
                </Input.Wrapper>
              </Input.Root>
            </Field>
            <Field label={t("logoLabel")} htmlFor="org-logo" optional>
              <Input.Root size="medium">
                <Input.Wrapper>
                  <Input.Input id="org-logo" type="url" placeholder={URL_PLACEHOLDER} value={logo} onChange={(e) => setLogo(e.target.value)} disabled={!canEdit} />
                </Input.Wrapper>
              </Input.Root>
            </Field>
            {error && <Callout tone="error">{error}</Callout>}
            {saved && <Callout tone="success">{t("saved")}</Callout>}
            {canEdit ? (
              <div>
                <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={!dirty || busy === "save"}>
                  {busy === "save" ? t("saving") : t("save")}
                </Button.Root>
              </div>
            ) : (
              <p className="text-paragraph-xs text-text-sub-600">{t("ownersOnly")}</p>
            )}
          </form>
        </FramePanel>
        <FrameFooter>{t("footer")}</FrameFooter>
      </Frame>

      {role !== "owner" && (
        <Frame>
          <FrameHeader title={t("leaveOrganization")} description={t("leaveDescription")} />
          <FramePanel className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-paragraph-sm text-text-sub-600">{t("leaveHint")}</p>
            <Button.Root variant="error" mode="stroke" size="small" disabled={busy === "leave"} onClick={leave}>
              {busy === "leave" ? t("leaving") : t("leaveOrganization")}
            </Button.Root>
          </FramePanel>
        </Frame>
      )}
    </div>
  );
}
