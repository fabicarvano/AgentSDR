"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { RiArrowDownSLine, RiCheckLine, RiExternalLinkLine, RiEyeLine, RiEyeOffLine, RiFileCopyLine, RiFileUploadLine } from "@remixicon/react";

import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { DocsLink } from "@/components/page/DocsLink";
import { useDialogs } from "@/components/DialogProvider";
import { Callout, Field } from "@/components/settings/SettingsKit";
import type { Messages } from "@/i18n/catalog";
import {
  PLATFORM_INTEGRATIONS,
  type LangfusePromptUpload,
  type PlatformField,
  type PlatformIntegration,
  type PlatformKey,
  type PlatformStatus,
  type SetupStep,
  type UnipileWebhookRegistration,
} from "@/lib/platform/catalog";
import { cn } from "@/utils/cn";
import { useApiErrorText } from "@/i18n/useApiErrorText";

/**
 * One platform integration as its channel's Connection section shows it
 * (Settings → Email / LinkedIn / WhatsApp → Connection): the card with its
 * status, Edit and Disconnect, and the guided setup dialog. `note` explains a
 * connection shared with another channel (Unipile powers LinkedIn and
 * WhatsApp).
 *
 * The catalog is imported here rather than passed from the page: it carries
 * functions (keyFile.read), which cannot cross the server/client boundary.
 */
export function PlatformConnection({
  platformKey,
  status,
  note,
  webhookUrl,
}: {
  platformKey: PlatformKey;
  status: PlatformStatus | null;
  note?: string;
  /**
   * A URL to paste into the provider's webhook settings (Cal.com), built on
   * the server with the organization in it. Undefined: none; null: this
   * deployment has no public URL to build it from.
   */
  webhookUrl?: string | null;
}) {
  const integration = PLATFORM_INTEGRATIONS.find((candidate) => candidate.key === platformKey)!;
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {note && <Callout tone="info">{note}</Callout>}
      <PlatformCard integration={integration} status={status} webhookUrl={webhookUrl} onEdit={() => setEditing(true)} />
      {editing && <IntegrationDialog key={integration.key} integration={integration} status={status} onClose={() => setEditing(false)} />}
    </div>
  );
}

/**
 * The texts of an integration (description, the features it enables, the setup steps, the fields' label and
 * help, the key-file button) live in the catalog under settingsChannels.integrations.<platform key>, not in
 * src/lib/platform/catalog.ts: that registry is read by server code and stays in English. `_integrationsCovered`
 * fails tsc when a platform has no entry. Features, steps and fields are looked up by position / field key, which
 * tsc cannot check (the registry is not `as const`), so one without an entry shows the registry's English.
 * Example values (placeholders such as pk-lf-…) are not text and come from the registry.
 */
type IntegrationEntry = {
  description: string;
  settingsLabel: string;
  enables: Record<string, string>;
  setupSteps: Record<string, string>;
  fields: Record<string, { label: string; help?: string }>;
};
const _integrationsCovered: Record<PlatformKey, IntegrationEntry> = {} as Messages["settingsChannels"]["integrations"];
void _integrationsCovered;

function useIntegrationTexts(integration: PlatformIntegration) {
  const ti = useTranslations("settingsChannels.integrations");
  const k = integration.key;
  const lookup = (key: string, fallback: string): string => (ti.has(key as never) ? ti(key as never) : fallback);
  return {
    description: ti(`${k}.description`),
    enables: integration.enables.map((feature, index) => lookup(`${k}.enables.item${index + 1}`, feature)),
    setupSteps: integration.setupSteps.map((step, index): SetupStep => {
      const text = lookup(`${k}.setupSteps.step${index + 1}`, typeof step === "string" ? step : step.text);
      return typeof step === "string" ? text : { ...step, text };
    }),
    field: (field: PlatformField) => ({
      label: lookup(`${k}.fields.${field.key}.label`, field.label),
      help: field.help === undefined ? undefined : lookup(`${k}.fields.${field.key}.help`, field.help),
    }),
    keyFileLabel: integration.keyFile ? lookup(`${k}.keyFile.label`, integration.keyFile.label) : undefined,
  };
}

/** A connection that is planned but not built yet: shown so people know it is coming. */
export type ComingSoonConnection = { name: string; description: string; iconUrl: string; enables: string[] };

export function ComingSoonCard({ connection }: { connection: ComingSoonConnection }) {
  const t = useTranslations("settingsChannels.platformConnection");
  return (
    <Frame>
      <FramePanel className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <PlatformLogo src={connection.iconUrl} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-label-md text-text-strong-950">{connection.name}</h3>
              <Badge.Root size="medium" variant="lighter" color="purple">{t("comingSoon")}</Badge.Root>
            </div>
            <p className="mt-1 text-paragraph-sm text-text-sub-600">{connection.description}</p>
            <p className="mt-1 text-paragraph-xs text-text-soft-400">{t("willPower", { features: connection.enables.join(", ") })}</p>
          </div>
        </div>
        <Button.Root variant="neutral" mode="stroke" size="small" disabled className="shrink-0">
          {t("comingSoon")}
        </Button.Root>
      </FramePanel>
    </Frame>
  );
}

function PlatformCard({
  integration,
  status,
  webhookUrl,
  onEdit,
}: {
  integration: PlatformIntegration;
  status: PlatformStatus | null;
  webhookUrl?: string | null;
  onEdit: () => void;
}) {
  const t = useTranslations("settingsChannels.platformConnection");
  const texts = useIntegrationTexts(integration);
  const format = useFormatter();
  const formatVerified = useFormatVerified();
  const router = useRouter();
  const dialogs = useDialogs();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const connected = status?.connected ?? false;

  const shownValues = integration.fields.filter((field) => !field.secret && status?.values[field.key]);

  async function disconnect() {
    const confirmed = await dialogs.confirm({
      title: t("disconnectDialog.title", { name: integration.name }),
      description: t("disconnectDialog.description", { features: format.list(texts.enables, { type: "conjunction" }) }),
      confirmLabel: t("disconnect"),
      variant: "error",
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/integrations/${integration.key}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      startTransition(() => router.refresh());
    } catch {
      await dialogs.alert({ title: t("disconnectDialog.errorTitle", { name: integration.name }), description: t("disconnectDialog.errorDescription"), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame>
      <FramePanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <PlatformLogo src={integration.iconUrl} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-label-md text-text-strong-950">{integration.name}</h3>
                <Badge.Root size="medium" variant="lighter" color={connected ? "green" : "gray"}>
                  {connected ? t("connected") : t("notConnected")}
                </Badge.Root>
              </div>
              <p className="mt-1 text-paragraph-sm text-text-sub-600">{texts.description}</p>
              <p className="mt-1 text-paragraph-xs text-text-soft-400">{t("powers", { features: texts.enables.join(", ") })}</p>
              {connected && integration.guideUrl && (
                <DocsLink href={integration.guideUrl} appearance="inline" className="mt-1.5 text-paragraph-xs">
                  {t("setupGuideLink")}
                </DocsLink>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!connected && integration.guideUrl && <DocsLink href={integration.guideUrl} />}
            {connected && (
              <Button.Root variant="error" mode="ghost" size="small" disabled={busy} onClick={disconnect}>
                {t("disconnect")}
              </Button.Root>
            )}
            <Button.Root variant={connected ? "neutral" : "primary"} mode={connected ? "stroke" : "filled"} size="small" onClick={onEdit}>
              {connected ? t("edit") : t("connect")}
            </Button.Root>
          </div>
        </div>

        {connected && (shownValues.length > 0 || status?.verifiedAt) && (
          <dl className="grid gap-x-6 gap-y-2 border-t border-stroke-soft-200 pt-3 text-paragraph-xs sm:grid-cols-2">
            {shownValues.map((field) => (
              <div key={field.key} className="min-w-0">
                <dt className="text-text-soft-400">{texts.field(field).label}</dt>
                <dd className="truncate text-text-strong-950">{status?.values[field.key]}</dd>
              </div>
            ))}
            {status?.verifiedAt && (
              <div>
                <dt className="text-text-soft-400">{t("lastVerified")}</dt>
                <dd className="text-text-strong-950">{formatVerified(status.verifiedAt)}</dd>
              </div>
            )}
          </dl>
        )}

        {connected && integration.key === "unipile" && <UnipileWebhooks registration={status?.webhooks ?? null} />}
        {connected && integration.key === "langfuse" && <LangfusePrompts upload={status?.prompts ?? null} />}
        {webhookUrl !== undefined && (
          <section className="flex flex-col gap-1.5 border-t border-stroke-soft-200 pt-3">
            <span className="text-label-xs text-text-strong-950">{t("webhookUrl")}</span>
            {webhookUrl ? (
              <>
                <CopyValue value={webhookUrl} />
                <p className="text-paragraph-xs text-text-soft-400">
                  {t("webhookUrlHint", { name: integration.name })}
                </p>
              </>
            ) : (
              <p className="text-paragraph-xs text-text-soft-400">{t("webhookUrlMissing")}</p>
            )}
          </section>
        )}
      </FramePanel>
    </Frame>
  );
}

/**
 * The prompts AgentSDR uploads to a Langfuse project when it is saved:
 * how many it created, or why it could not. Saving again retries.
 */
function LangfusePrompts({ upload }: { upload: LangfusePromptUpload | null }) {
  const t = useTranslations("settingsChannels.platformConnection");
  const formatVerified = useFormatVerified();
  const badge =
    upload?.status === "uploaded"
      ? { color: "green" as const, text: t("langfuse.uploaded") }
      : upload?.status === "failed"
        ? { color: "red" as const, text: t("langfuse.failed") }
        : { color: "gray" as const, text: t("langfuse.notUploaded") };
  return (
    <section className="flex flex-col gap-1 border-t border-stroke-soft-200 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-label-sm text-text-strong-950">{t("langfuse.title")}</h4>
        <Badge.Root size="small" variant="lighter" color={badge.color}>
          {badge.text}
        </Badge.Root>
      </div>
      <p className="text-paragraph-xs text-text-sub-600">
        {upload?.status === "uploaded"
          ? upload.existing
            ? t("langfuse.uploadedWithExistingDescription", { when: formatVerified(upload.at), created: upload.created, existing: upload.existing })
            : t("langfuse.uploadedDescription", { when: formatVerified(upload.at), created: upload.created })
          : upload?.status === "failed"
            ? t("langfuse.failedDescription", { message: upload.message ?? t("langfuse.failedFallback") })
            : t("langfuse.notUploadedDescription")}
      </p>
    </section>
  );
}

type WebhookSetup = { endpoints: { key: string; label: string; url: string }[] | null; secret: string };

/**
 * Unipile's webhooks, which AgentSDR registers itself on save: whether that
 * worked, a way to run it again, and, on request, the URLs and the secret
 * for registering them by hand.
 */
function UnipileWebhooks({ registration }: { registration: UnipileWebhookRegistration | null }) {
  const t = useTranslations("settingsChannels.platformConnection");
  const apiErrorText = useApiErrorText();
  const formatVerified = useFormatVerified();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useState(registration);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState<WebhookSetup | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [secretShown, setSecretShown] = useState(false);

  async function register() {
    setRegistering(true);
    setError("");
    try {
      const res = await fetch("/api/settings/integrations/unipile/webhooks", { method: "POST" });
      const body = (await res.json().catch(() => null)) as (UnipileWebhookRegistration & { error?: string }) | null;
      if (!res.ok || !body) throw new Error(apiErrorText(body, t("unipile.registerError")));
      setCurrent(body);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unipile.registerError"));
    } finally {
      setRegistering(false);
    }
  }

  async function toggleSetup() {
    if (setup) {
      setSetup(null);
      setSecretShown(false);
      return;
    }
    setLoadingSetup(true);
    setError("");
    try {
      const res = await fetch("/api/settings/integrations/unipile/webhooks", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as (WebhookSetup & { error?: string }) | null;
      if (!res.ok || !body) throw new Error(apiErrorText(body, t("unipile.loadError")));
      setSetup(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unipile.loadError"));
    } finally {
      setLoadingSetup(false);
    }
  }

  const badge =
    current?.status === "registered"
      ? { color: "green" as const, text: t("unipile.registeredCount", { count: current.items?.length ?? 0 }) }
      : current?.status === "failed"
        ? { color: "red" as const, text: t("unipile.failed") }
        : current?.status === "skipped"
          ? { color: "orange" as const, text: t("unipile.skipped") }
          : { color: "gray" as const, text: t("unipile.notRegisteredYet") };

  return (
    <section className="flex flex-col gap-3 border-t border-stroke-soft-200 pt-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-label-sm text-text-strong-950">{t("unipile.title")}</h4>
            <Badge.Root size="small" variant="lighter" color={badge.color}>
              {badge.text}
            </Badge.Root>
          </div>
          <p className="mt-1 text-paragraph-xs text-text-sub-600">
            {current?.status === "registered"
              ? t("unipile.registeredDescription", { when: formatVerified(current.at) })
              : current?.message
                ? current.message
                : t("unipile.defaultDescription")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button.Root variant="neutral" mode="ghost" size="small" disabled={loadingSetup} onClick={() => void toggleSetup()}>
            {setup ? t("unipile.hideUrls") : loadingSetup ? t("unipile.loading") : t("unipile.showUrls")}
          </Button.Root>
          <Button.Root variant="neutral" mode="stroke" size="small" disabled={registering} onClick={() => void register()}>
            {registering ? t("unipile.registering") : current?.status === "registered" ? t("unipile.registerAgain") : t("unipile.register")}
          </Button.Root>
        </div>
      </div>

      {error && <Callout tone="error">{error}</Callout>}

      {setup && (
        <div className="flex flex-col gap-3 rounded-lg bg-bg-weak-50 p-3">
          <p className="text-paragraph-xs text-text-sub-600">
            {t.rich("unipile.manualHint", { code: (chunks) => <code className="font-mono">{chunks}</code> })}
          </p>
          {setup.endpoints ? (
            <ul className="flex flex-col gap-2">
              {setup.endpoints.map((endpoint) => (
                <li key={endpoint.key} className="flex flex-col gap-1">
                  <span className="text-label-xs text-text-strong-950">{endpoint.label}</span>
                  <CopyValue value={endpoint.url} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-paragraph-xs text-text-sub-600">{t("unipile.endpointsMissing")}</p>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-label-xs text-text-strong-950">{t("unipile.secret")}</span>
            <CopyValue value={setup.secret} masked={!secretShown} onToggleMask={() => setSecretShown((shown) => !shown)} />
          </div>
        </div>
      )}
    </section>
  );
}

/** A value on one line with Copy; optionally masked behind a show/hide toggle. */
function CopyValue({ value, masked = false, onToggleMask }: { value: string; masked?: boolean; onToggleMask?: () => void }) {
  const t = useTranslations("settingsChannels.platformConnection");
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the value is selectable text (once shown).
    }
  }
  return (
    <div className="flex items-start gap-2 rounded-md bg-bg-white-0 p-2 ring-1 ring-inset ring-stroke-soft-200">
      <code className="min-w-0 flex-1 select-all break-all font-mono text-paragraph-xs text-text-strong-950">
        {masked ? "•".repeat(Math.min(value.length, 32)) : value}
      </code>
      {onToggleMask && (
        <Button.Root type="button" variant="neutral" mode="ghost" size="xxsmall" onClick={onToggleMask} aria-label={masked ? t("showSecret") : t("hideSecret")}>
          <Button.Icon as={masked ? RiEyeLine : RiEyeOffLine} />
        </Button.Root>
      )}
      <Button.Root type="button" variant="neutral" mode="ghost" size="xxsmall" onClick={() => void copy()}>
        <Button.Icon as={copied ? RiCheckLine : RiFileCopyLine} />
        {copied ? t("copied") : t("copy")}
      </Button.Root>
    </div>
  );
}

/** "How to connect", closed until asked for — the fields' own hints carry most people through. */
function SetupGuide({ integration }: { integration: PlatformIntegration }) {
  const t = useTranslations("settingsChannels.platformConnection");
  const texts = useIntegrationTexts(integration);
  const [open, setOpen] = useState(false);
  const id = `setup-guide-${integration.key}`;
  return (
    <section className="rounded-lg bg-bg-weak-50">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
      >
        <span className="text-label-sm text-text-strong-950">
          {t("guide.title")}
          <span className="ml-1.5 text-paragraph-xs text-text-soft-400">{t("guide.steps", { count: integration.setupSteps.length })}</span>
        </span>
        <RiArrowDownSLine aria-hidden="true" className={cn("size-5 shrink-0 text-text-soft-400 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <ol id={id} className="space-y-1.5 px-3.5 pb-3.5">
          {texts.setupSteps.map((step, index) => (
            <li key={index} className="flex gap-2 text-paragraph-sm text-text-sub-600">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-bg-white-0 text-label-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
                {index + 1}
              </span>
              <SetupStepText step={step} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SetupStepText({ step }: { step: SetupStep }) {
  const t = useTranslations("settingsChannels.platformConnection");
  const [copied, setCopied] = useState(false);
  if (typeof step === "string") return <span className="min-w-0 flex-1">{step}</span>;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the value is selectable text, so it can still be copied by hand.
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span>{step.text}</span>
      <div className="flex items-start gap-2 rounded-md bg-bg-white-0 p-2 ring-1 ring-inset ring-stroke-soft-200">
        <code className="min-w-0 flex-1 select-all break-all font-mono text-paragraph-xs text-text-strong-950">{step.copy}</code>
        <Button.Root type="button" variant="neutral" mode="ghost" size="xxsmall" onClick={() => void copy(step.copy)}>
          <Button.Icon as={copied ? RiCheckLine : RiFileCopyLine} />
          {copied ? t("copied") : t("copy")}
        </Button.Root>
      </div>
    </div>
  );
}

/**
 * The provider's mark on a white tile in both themes — the marks are drawn
 * for a light background (OpenRouter's is black), so the tile keeps them
 * legible in dark mode.
 */
export function PlatformLogo({ src, size = "medium" }: { src: string; size?: "small" | "medium" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-inset ring-stroke-soft-200",
        size === "medium" ? "size-10 p-2" : "size-9 p-1.5",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a static brand asset from public/ */}
      <img src={src} alt="" className="size-full object-contain" />
    </span>
  );
}

/** A timestamp in the interface language and the browser's time zone; a value that is not a date is shown as it is. */
function useFormatVerified(): (iso: string) => string {
  const locale = useLocale();
  return (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  };
}

function IntegrationDialog({
  integration,
  status,
  onClose,
}: {
  integration: PlatformIntegration;
  status: PlatformStatus | null;
  onClose: () => void;
}) {
  const t = useTranslations("settingsChannels.platformConnection");
  const apiErrorText = useApiErrorText();
  const texts = useIntegrationTexts(integration);
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(integration.fields.map((field) => [field.key, field.secret ? "" : (status?.values[field.key] ?? "")])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const secretsSet = new Set(status?.secretsSet ?? []);
  const connected = status?.connected ?? false;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/settings/integrations/${integration.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorText(data, t("dialog.saveError")));
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError(t("dialog.networkError"));
    } finally {
      setSaving(false);
    }
  }

  async function readKeyFile(file: File) {
    if (!integration.keyFile) return;
    setError(null);
    setFilledFrom(null);
    try {
      const filled = integration.keyFile.read(await file.text());
      setValues((current) => ({ ...current, ...filled }));
      setFilledFrom(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dialog.readFileError"));
    }
  }

  const links = [
    integration.guideUrl && { href: integration.guideUrl, label: t("dialog.guideLink") },
    integration.videoUrl && { href: integration.videoUrl, label: t("dialog.videoLink") },
    integration.docsUrl && { href: integration.docsUrl, label: t("dialog.docsLink", { name: integration.name }) },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  const missing = integration.fields.some(
    (field) => field.required && !values[field.key].trim() && !(field.secret && secretsSet.has(field.key)),
  );

  return (
    <Modal.Root open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <Modal.Content size="max-w-xl" hideClose={saving} onEscapeKeyDown={(event) => saving && event.preventDefault()}>
        <Modal.Header>
          <div className="flex items-start gap-3">
            <PlatformLogo src={integration.iconUrl} size="small" />
            <div className="min-w-0">
              <Modal.Title>{connected ? t("dialog.titleEdit", { name: integration.name }) : t("dialog.titleConnect", { name: integration.name })}</Modal.Title>
              <Modal.Description>
                {t("dialog.description", { name: integration.name })}
              </Modal.Description>
              {links.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-paragraph-xs">
                  {links.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary-base underline-offset-2 hover:underline">
                      {link.label} <RiExternalLinkLine className="size-3.5" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal.Header>

        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <Modal.Body className="space-y-4">
            <SetupGuide integration={integration} />

            {integration.keyFile && (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  accept={integration.keyFile.accept}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void readKeyFile(file);
                  }}
                />
                <Button.Root type="button" variant="neutral" mode="stroke" size="small" disabled={saving} onClick={() => fileInput.current?.click()}>
                  <Button.Icon as={RiFileUploadLine} />
                  {texts.keyFileLabel}
                </Button.Root>
                <span className="text-paragraph-xs text-text-soft-400">
                  {filledFrom ? t("dialog.filledFrom", { file: filledFrom }) : t("dialog.fillHint")}
                </span>
              </div>
            )}
            {integration.fields.map((field) => {
              const id = `platform-${integration.key}-${field.key}`;
              const saved = field.secret && secretsSet.has(field.key);
              const placeholder = saved ? t("dialog.savedPlaceholder") : field.placeholder;
              const fieldText = texts.field(field);
              const set = (value: string) => setValues((current) => ({ ...current, [field.key]: value }));
              return (
                <Field key={field.key} label={fieldText.label} htmlFor={id} required={field.required} optional={!field.required} description={fieldText.help}>
                  {field.inputType === "textarea" ? (
                    <Textarea.Root
                      id={id}
                      simple
                      rows={6}
                      value={values[field.key]}
                      onChange={(e) => set(e.target.value)}
                      placeholder={placeholder}
                      spellCheck={false}
                      autoComplete="off"
                      className="font-mono text-paragraph-xs"
                    />
                  ) : (
                    <Input.Root size="medium">
                      <Input.Wrapper>
                        <Input.Input
                          id={id}
                          type={field.inputType}
                          value={values[field.key]}
                          onChange={(e) => set(e.target.value)}
                          placeholder={placeholder}
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </Input.Wrapper>
                    </Input.Root>
                  )}
                </Field>
              );
            })}

            {error && (
              <Callout tone="error" title={t("dialog.errorTitle")}>
                {error}
              </Callout>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button.Root type="button" variant="neutral" mode="stroke" size="small" disabled={saving} onClick={onClose}>
              {t("dialog.cancel")}
            </Button.Root>
            <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={saving || missing}>
              {saving ? t("dialog.testing") : connected ? t("dialog.save") : t("dialog.connectAndTest")}
            </Button.Root>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
