"use client";

import { useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import * as Button from "@/components/alignui/button";
import * as Checkbox from "@/components/alignui/checkbox";
import * as Input from "@/components/alignui/input";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import { Callout } from "@/components/settings/SettingsKit";
import type { ApiKeySummary } from "@/lib/publicApi/keys";
import { ALL_API_SCOPES, type ApiScope } from "@/lib/publicApi/scopes";
import { useApiErrorText } from "@/i18n/useApiErrorText";

/** The message-key name of each scope (the catalog's keys are camelCase). A new scope in scopes.ts fails the type check here. */
const SCOPE_KEYS = {
  "crm:read": "crmRead",
  "crm:write": "crmWrite",
  "crm:send": "crmSend",
  "campaigns:read": "campaignsRead",
  "campaigns:write": "campaignsWrite",
} as const satisfies Record<ApiScope, string>;

/**
 * Settings → API keys: create, copy once, revoke. The key itself is only in
 * the create response, so it is shown until the person dismisses it and
 * never again (src/lib/publicApi/keys.ts).
 */
export function ApiKeysSettings({ initialKeys }: { initialKeys: ApiKeySummary[] }) {
  const t = useTranslations("settingsOrg.apiKeys");
  const apiErrorText = useApiErrorText();
  const format = useFormatter();
  const dialogs = useDialogs();
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<ApiScope>>(() => new Set(ALL_API_SCOPES));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const when = (iso: string | null): string =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : t("never");

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy("create");
    setError("");
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes: ALL_API_SCOPES.filter((scope) => scopes.has(scope)) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(apiErrorText(data, t("createFailed")));
      setKeys((current) => [data.apiKey as ApiKeySummary, ...current]);
      setCreated({ key: data.key as string, name: (data.apiKey as ApiKeySummary).name });
      setCopied(false);
      setName("");
    } catch {
      setError(t("networkError"));
    } finally {
      setBusy(null);
    }
  }

  async function revoke(key: ApiKeySummary) {
    const confirmed = await dialogs.confirm({
      title: t("revokeTitle", { name: key.name }),
      description: t("revokeDescription"),
      confirmLabel: t("revokeConfirm"),
      variant: "error",
    });
    if (!confirmed) return;
    setBusy(`revoke-${key.id}`);
    setError("");
    try {
      const res = await fetch(`/api/settings/api-keys/${key.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(apiErrorText(data, t("revokeFailed")));
      const now = new Date().toISOString();
      setKeys((current) => current.map((k) => (k.id === key.id ? { ...k, revokedAt: k.revokedAt ?? now } : k)));
    } catch {
      setError(t("networkError"));
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
    } catch {
      setError(t("copyFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Callout tone="info">
        {/* The header sample is code: it stays as written, and is passed in because a literal "<" would break the message. */}
        {t.rich("intro", { header: "Authorization: Bearer <key>", code: (chunks) => <code>{chunks}</code> })}
      </Callout>
      {error && <Callout tone="error">{error}</Callout>}

      {created && (
        <Callout
          tone="success"
          title={t("createdTitle", { name: created.name })}
          action={
            <Button.Root variant="neutral" mode="ghost" size="xsmall" onClick={() => setCreated(null)}>
              {t("done")}
            </Button.Root>
          }
        >
          <p>{t("createdBody")}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-bg-white-0 px-2.5 py-1.5 text-paragraph-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
              {created.key}
            </code>
            <Button.Root variant="primary" mode="filled" size="xsmall" onClick={() => void copy()}>
              {copied ? t("copied") : t("copy")}
            </Button.Root>
          </div>
        </Callout>
      )}

      <Frame>
        <FrameHeader title={t("createTitle")} description={t("createDescription")} />
        <FramePanel>
          <form onSubmit={create} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
            <Input.Root size="small" className="flex-1">
              <Input.Wrapper>
                <Input.Input
                  aria-label={t("keyName")}
                  placeholder={t("keyName")}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Input.Wrapper>
            </Input.Root>
            <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={busy === "create" || !name.trim() || scopes.size === 0}>
              {busy === "create" ? t("creating") : t("create")}
            </Button.Root>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-label-xs text-text-sub-600">{t("scopesLegend")}</legend>
              {ALL_API_SCOPES.map((scope) => (
                <label key={scope} className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox.Root
                    className="mt-0.5"
                    checked={scopes.has(scope)}
                    onCheckedChange={(checked) => setScopes((current) => {
                      const next = new Set(current);
                      if (checked === true) next.add(scope);
                      else next.delete(scope);
                      return next;
                    })}
                  />
                  <span className="min-w-0">
                    <span className="block text-label-sm text-text-strong-950">
                      {t(`scopes.${SCOPE_KEYS[scope]}.label`)} <code className="text-paragraph-xs text-text-soft-400">{scope}</code>
                    </span>
                    <span className="block text-paragraph-xs text-text-sub-600">{t(`scopes.${SCOPE_KEYS[scope]}.description`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </form>
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title={t("keysTitle")} description={t("keysActive", { count: keys.filter((k) => !k.revokedAt).length })} />
        <FramePanel>
          {keys.length === 0 ? (
            <p className="text-paragraph-sm text-text-sub-600">{t("empty")}</p>
          ) : (
            <ul className="divide-y divide-stroke-soft-200">
              {keys.map((key) => (
                <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-label-sm text-text-strong-950">
                      {key.name}
                      {key.revokedAt && <span className="ml-2 text-paragraph-xs text-text-soft-400">{t("revoked")}</span>}
                    </p>
                    <p className="text-paragraph-xs text-text-sub-600">
                      {t.rich("keyMeta", { prefix: key.keyPrefix, created: when(key.createdAt), lastUsed: when(key.lastUsedAt), code: (chunks) => <code>{chunks}</code> })}
                    </p>
                    <p className="text-paragraph-xs text-text-soft-400">
                      {key.scopes.length === ALL_API_SCOPES.length
                        ? t("fullAccess")
                        : key.scopes.map((scope) => t(`scopes.${SCOPE_KEYS[scope]}.label`)).join(" · ") || t("noAccess")}
                    </p>
                  </div>
                  {!key.revokedAt && (
                    <Button.Root
                      variant="error"
                      mode="ghost"
                      size="xsmall"
                      disabled={busy === `revoke-${key.id}`}
                      onClick={() => void revoke(key)}
                    >
                      {t("revoke")}
                    </Button.Root>
                  )}
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>
    </div>
  );
}
