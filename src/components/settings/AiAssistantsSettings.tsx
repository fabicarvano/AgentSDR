"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import { Callout } from "@/components/settings/SettingsKit";
import { cn } from "@/utils/cn";

type Connection = {
  clientId: string;
  name: string | null;
  uri: string | null;
  icon: string | null;
  connectedAt: string | null;
  lastActiveAt: string | null;
};

/** "never" / "just now" / "5 min ago" / "3 h ago" / "yesterday" / "4 days ago", in the interface language. */
function useRelative() {
  const t = useTranslations("settingsAi.assistants");
  return (iso: string | null): string => {
    if (!iso) return t("relative.never");
    const ms = Date.now() - new Date(iso).getTime();
    const minutes = Math.round(ms / 60_000);
    if (minutes < 1) return t("relative.justNow");
    if (minutes < 60) return t("relative.minutes", { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t("relative.hours", { count: hours });
    const days = Math.round(hours / 24);
    return days === 1 ? t("relative.yesterday") : t("relative.days", { count: days });
  };
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = useTranslations("settingsAi.assistants");
  const [copied, setCopied] = useState(false);
  return (
    <Button.Root
      variant="neutral"
      mode="stroke"
      size="xsmall"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? t("copied") : (label ?? t("copy"))}
    </Button.Root>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-bg-weak-50 px-3 py-2 text-paragraph-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
        <code>{text}</code>
      </pre>
      <CopyButton text={text} />
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-paragraph-sm text-text-sub-600">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-bg-weak-50 text-label-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">{item}</div>
        </li>
      ))}
    </ol>
  );
}

const b = (chunks: React.ReactNode) => <b>{chunks}</b>;
const code = (chunks: React.ReactNode) => <code>{chunks}</code>;

/** Tab ids; the label is settingsAi.assistants.tabs.<id>. */
const TABS = [{ id: "claude" }, { id: "code" }, { id: "other" }] as const;

/** Example requests; the text is settingsAi.assistants.prompts.<key>. */
const PROMPTS = ["queue", "pricing", "priya", "notNow"] as const;

export function AiAssistantsSettings({ serverUrl }: { serverUrl: string }) {
  const t = useTranslations("settingsAi.assistants");
  const format = useFormatter();
  const relative = useRelative();
  const dialogs = useDialogs();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("claude");
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/ai-assistants", { credentials: "same-origin" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("errors.load"));
      setConnections((data?.connections ?? []) as Connection[]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.load"));
      setConnections((current) => current ?? []);
    }
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function disconnect(c: Connection) {
    const confirmed = await dialogs.confirm({
      title: t("disconnect.title", { named: c.name ? "yes" : "no", name: c.name ?? "" }),
      description: t("disconnect.description"),
      confirmLabel: t("disconnect.confirm"),
      variant: "error",
    });
    if (!confirmed) return;
    setBusy(c.clientId);
    setError("");
    try {
      const res = await fetch("/api/settings/ai-assistants", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: c.clientId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setError(data?.error || t("errors.disconnect"));
      else await load();
    } catch {
      setError(t("errors.network"));
    } finally {
      setBusy(null);
    }
  }

  const mcpJson = JSON.stringify(
    { mcpServers: { agentsdr: { type: "http", url: serverUrl, headers: { Authorization: "Bearer ${AGENTSDR_API_KEY}" } } } },
    null,
    2,
  );

  return (
    <div className="flex flex-col gap-6">
      <Frame>
        <FrameHeader title={t("connections.title")} description={t("connections.description")} />
        <FramePanel>
          {error && <Callout tone="error" className="mb-3">{error}</Callout>}
          {connections === null ? (
            <p className="text-paragraph-sm text-text-sub-600">{t("connections.loading")}</p>
          ) : connections.length === 0 ? (
            <p className="text-paragraph-sm text-text-sub-600">{t("connections.empty")}</p>
          ) : (
            <ul className="divide-y divide-stroke-soft-200">
              {connections.map((c) => (
                <li key={c.clientId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    {c.icon && (
                      // eslint-disable-next-line @next/next/no-img-element -- a third party's logo, arbitrary host
                      <img src={c.icon} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-label-sm text-text-strong-950">{c.name || t("connections.unnamed")}</p>
                      <p className="text-paragraph-xs text-text-sub-600">
                        {t("connections.meta", {
                          connected: c.connectedAt ? "date" : "earlier",
                          date: c.connectedAt ? format.dateTime(new Date(c.connectedAt), { dateStyle: "medium" }) : "",
                          lastActive: relative(c.lastActiveAt),
                        })}
                      </p>
                    </div>
                  </div>
                  <Button.Root variant="error" mode="ghost" size="xsmall" disabled={busy === c.clientId} onClick={() => void disconnect(c)}>
                    {busy === c.clientId ? t("disconnect.busy") : t("disconnect.confirm")}
                  </Button.Root>
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title={t("serverUrl.title")} description={t("serverUrl.description")} />
        <FramePanel>
          <div className="flex items-center gap-2">
            <Input.Root size="small" className="flex-1">
              <Input.Wrapper>
                <Input.Input aria-label={t("serverUrl.aria")} readOnly value={serverUrl} onFocus={(e) => e.currentTarget.select()} />
              </Input.Wrapper>
            </Input.Root>
            <CopyButton text={serverUrl} />
          </div>
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title={t("howTo.title")} description={t("howTo.description")} />
        <FramePanel>
          <div role="tablist" className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-label-sm ring-1 ring-inset transition-colors",
                  tab === item.id
                    ? "bg-bg-strong-950 text-text-white-0 ring-transparent"
                    : "bg-bg-white-0 text-text-sub-600 ring-stroke-soft-200 hover:bg-bg-weak-50",
                )}
              >
                {t(`tabs.${item.id}`)}
              </button>
            ))}
          </div>

          {tab === "claude" && (
            <div className="flex flex-col gap-4">
              <Steps
                items={[
                  // Claude's own screen labels (Customize, Connectors, Add, Continue, Connect, Allow) stay English in every language: they are what the person has to find in Claude.
                  t.rich("howTo.claude.step1", { b }),
                  t.rich("howTo.claude.step2", { b }),
                  t.rich("howTo.claude.step3", { b }),
                  t.rich("howTo.claude.step4", { b }),
                  t.rich("howTo.claude.step5", { b }),
                ]}
              />
              <Callout tone="info">
                {t("howTo.claude.teamNote")}
              </Callout>
            </div>
          )}

          {tab === "code" && (
            <Steps
              items={[
                <div key="a" className="flex flex-col gap-2">
                  <span>{t("howTo.code.step1")}</span>
                  <CodeBlock text={`claude mcp add --transport http agentsdr ${serverUrl}`} />
                </div>,
                t.rich("howTo.code.step2", { code }),
                // Claude Code's own menu labels (agentsdr, Authenticate, Allow) stay English: they are what the person has to find on screen.
                t.rich("howTo.code.step3", { b }),
                t.rich("howTo.code.step4", { b }),
              ]}
            />
          )}

          {tab === "other" && (
            <div className="flex flex-col gap-4 text-paragraph-sm text-text-sub-600">
              <p>{t("howTo.other.clients")}</p>
              <p>{t.rich("howTo.other.apiKey", { b, code })}</p>
              <CodeBlock text={mcpJson} />
            </div>
          )}
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title={t("prompts.title")} />
        <FramePanel>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-paragraph-sm text-text-sub-600">
            {PROMPTS.map((key) => (
              <li key={key}>{t(`prompts.${key}`)}</li>
            ))}
          </ul>
        </FramePanel>
      </Frame>
    </div>
  );
}
