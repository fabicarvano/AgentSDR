"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  RiCheckboxCircleLine,
  RiClockwiseLine,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiMailSendLine,
  RiMoreLine,
  RiPenNibLine,
  RiTimeLine,
} from "@remixicon/react";

import * as Avatar from "@/components/alignui/avatar";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Table from "@/components/alignui/table";
import { CHANNEL_META } from "@/components/analytics/theme";
import { AccountIdentity, PresenceDot } from "@/components/settings/AccountsOverview";
import { Meter } from "@/components/settings/SettingsKit";
import type { mailboxes } from "@/lib/outreach/schema";
import { cn } from "@/utils/cn";
import WorkingHoursModal from "./WorkingHoursModal";
import SignatureModal from "./SignatureModal";
import { useDialogs } from "@/components/DialogProvider";

type Mailbox = typeof mailboxes.$inferSelect;

const EMAIL = CHANNEL_META.email.color;

const STATUS_COLOR: Record<string, React.ComponentProps<typeof Badge.Root>["color"]> = {
  connected: "green",
  failed: "red",
  disabled: "gray",
  connecting: "orange",
};
const STATUS_LABEL_KEYS = ["connected", "failed", "disabled", "connecting"] as const;
type StatusKey = (typeof STATUS_LABEL_KEYS)[number];
const isKnownStatus = (s: string): s is StatusKey => (STATUS_LABEL_KEYS as readonly string[]).includes(s);

function initialsFor(mailbox: Mailbox) {
  const source = mailbox.displayName?.trim() || mailbox.emailAddress;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase() || "?";
}

type T = ReturnType<typeof useTranslations<"emailMailboxes.table">>;

/** Summarizes the enabled days into a compact string, e.g. "Mon–Fri, 9:00–18:00". */
function hoursSummary(mailbox: Mailbox, t: T) {
  const days = mailbox.workingHours.days;
  const order: (keyof typeof days)[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const enabled = order.filter((k) => days[k].enabled);
  if (enabled.length === 0) return t("hours.none");

  const dayLabel =
    enabled.length === 7
      ? t("hours.everyDay")
      : enabled.length === 5 && enabled.every((k) => k !== "saturday" && k !== "sunday")
        ? t("hours.weekdays")
        : enabled.map((k) => t(`days.${k}`)).join(", ");

  const first = days[enabled[0]];
  return `${dayLabel}, ${first.from}–${first.to}`;
}

function MailboxTableRow({ mailbox }: { mailbox: Mailbox }) {
  const t = useTranslations("emailMailboxes.table");
  const dialogs = useDialogs();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [showHours, setShowHours] = useState(false);
  const [showSignature, setShowSignature] = useState(false);

  async function handleRetest() {
    setBusy(true);
    try {
      await fetch(`/api/outreach/mailboxes/${mailbox.id}`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSendTest() {
    const to = (
      await dialogs.prompt({
        title: t("sendTest.title"),
        description: t("sendTest.description", { address: mailbox.emailAddress }),
        label: t("sendTest.label"),
        defaultValue: mailbox.emailAddress,
        confirmLabel: t("sendTest.confirm"),
      })
    )?.trim();
    if (!to) return;
    setBusy(true);
    setTestSendResult(null);
    try {
      const res = await fetch(`/api/outreach/mailboxes/${mailbox.id}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const data = await res.json();
      setTestSendResult(data.ok ? { ok: true, text: t("sendTest.sent", { to }) } : { ok: false, text: t("sendTest.failed", { error: data.error }) });
    } catch {
      setTestSendResult({ ok: false, text: t("sendTest.networkError") });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ok = await dialogs.confirm({
      title: t("remove.title"),
      description: t("remove.description", { address: mailbox.emailAddress }),
      confirmLabel: t("remove.confirm"),
      variant: "error",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await fetch(`/api/outreach/mailboxes/${mailbox.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const connected = mailbox.status === "connected";
  const failed = mailbox.status === "failed";
  // The last test-send result wins over the stored error: it is newer.
  const note = testSendResult
    ? { tone: testSendResult.ok ? "ok" : "error", text: testSendResult.text }
    : mailbox.lastError
      ? { tone: failed ? "error" : "muted", text: mailbox.lastError }
      : null;

  return (
    <Table.Row className={cn(busy && "opacity-60")} aria-busy={busy || undefined}>
      <Table.Cell className="h-16 px-4">
        <AccountIdentity
          media={
            <>
              <Avatar.Root size="32" color="blue">
                {initialsFor(mailbox)}
              </Avatar.Root>
              <PresenceDot ok={connected} />
            </>
          }
          name={
            <span className="truncate text-label-sm text-text-strong-950" title={mailbox.emailAddress}>
              {mailbox.emailAddress}
            </span>
          }
          detail={mailbox.displayName || t("noDisplayName")}
          extra={
            note && (
              <p
                title={note.text}
                className={cn(
                  "mt-0.5 flex max-w-64 items-center gap-1 text-paragraph-xs",
                  note.tone === "error" ? "text-error-base" : note.tone === "ok" ? "text-success-base" : "text-text-sub-600",
                )}
              >
                {note.tone === "error" && <RiErrorWarningLine className="size-3.5 shrink-0" aria-hidden="true" />}
                {note.tone === "ok" && <RiCheckboxCircleLine className="size-3.5 shrink-0" aria-hidden="true" />}
                <span className="truncate">{note.text}</span>
              </p>
            )
          }
        />
      </Table.Cell>

      <Table.Cell className="px-4">
        <div className="flex flex-col items-start gap-1">
          <Badge.Root size="medium" variant="lighter" color={STATUS_COLOR[mailbox.status] ?? "gray"}>
            <Badge.Dot />
            {isKnownStatus(mailbox.status) ? t(`status.${mailbox.status}`) : mailbox.status}
          </Badge.Root>
          {failed && (
            <button
              type="button"
              disabled={busy}
              onClick={handleRetest}
              className="inline-flex items-center gap-1 rounded text-label-xs text-text-strong-950 underline decoration-stroke-sub-300 underline-offset-2 outline-none transition hover:decoration-text-strong-950 focus-visible:ring-2 focus-visible:ring-primary-base disabled:text-text-disabled-300"
            >
              <RiClockwiseLine className="size-3.5" aria-hidden="true" />
              {t("testAgain")}
            </button>
          )}
        </div>
      </Table.Cell>

      <Table.Cell className="px-4">
        <Meter value={mailbox.todayEmailsSent} max={mailbox.dailySendLimit} color={EMAIL} label={t("sentTodayMeter", { address: mailbox.emailAddress })} />
      </Table.Cell>

      <Table.Cell className="px-4">
        <p className="flex items-center gap-1.5 whitespace-nowrap text-paragraph-sm text-text-strong-950">
          <RiTimeLine className="size-4 shrink-0 text-text-soft-400" aria-hidden="true" />
          {hoursSummary(mailbox, t)}
        </p>
        <p className="mt-0.5 truncate pl-5.5 text-paragraph-xs text-text-sub-600">{mailbox.workingHours.timezone}</p>
      </Table.Cell>

      <Table.Cell className="px-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end">
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button.Root
                variant="neutral"
                mode="ghost"
                size="xsmall"
                disabled={busy}
                aria-label={t("moreActions", { address: mailbox.emailAddress })}
              >
                <Button.Icon as={RiMoreLine} />
              </Button.Root>
            </Dropdown.Trigger>

            <Dropdown.Content align="end">
              <Dropdown.Item onSelect={handleRetest}>
                <Dropdown.ItemIcon as={RiClockwiseLine} />
                {t("testConnection")}
              </Dropdown.Item>
              {connected && (
                <Dropdown.Item onSelect={() => void handleSendTest()}>
                  <Dropdown.ItemIcon as={RiMailSendLine} />
                  {t("sendTestEmail")}
                </Dropdown.Item>
              )}
              <Dropdown.Item onSelect={() => setShowHours(true)}>
                <Dropdown.ItemIcon as={RiTimeLine} />
                {t("sendingHours")}
              </Dropdown.Item>
              <Dropdown.Item onSelect={() => setShowSignature(true)}>
                <Dropdown.ItemIcon as={RiPenNibLine} />
                {t("signature")}
              </Dropdown.Item>

              <Dropdown.Separator />

              <Dropdown.Item destructive onSelect={handleDelete}>
                <Dropdown.ItemIcon as={RiDeleteBinLine} />
                {t("removeMailbox")}
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Root>
        </div>

        {showHours && (
          <WorkingHoursModal
            mailboxId={mailbox.id}
            mailboxAddress={mailbox.emailAddress}
            initial={mailbox.workingHours}
            onClose={() => setShowHours(false)}
            onSaved={() => router.refresh()}
          />
        )}
        {showSignature && (
          <SignatureModal
            mailboxId={mailbox.id}
            mailboxAddress={mailbox.emailAddress}
            initial={mailbox.signatureHtml}
            onClose={() => setShowSignature(false)}
            onSaved={() => router.refresh()}
          />
        )}
      </Table.Cell>
    </Table.Row>
  );
}

export default function MailboxTable({ mailboxes }: { mailboxes: Mailbox[] }) {
  const t = useTranslations("emailMailboxes.table");
  return (
    <Table.Root className="min-w-190 [&>table]:table-fixed">
      <Table.Header>
        <Table.Row>
          <Table.Head scope="col" className="px-4">{t("columns.mailbox")}</Table.Head>
          <Table.Head scope="col" className="w-32 px-4">{t("columns.status")}</Table.Head>
          <Table.Head scope="col" className="w-40 px-4">{t("columns.sentToday")}</Table.Head>
          <Table.Head scope="col" className="w-52 px-4">{t("columns.sendingHours")}</Table.Head>
          <Table.Head scope="col" className="w-14 px-4"><span className="sr-only">{t("columns.actions")}</span></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body spacing={4}>
        {mailboxes.map((m) => (
          <MailboxTableRow key={m.id} mailbox={m} />
        ))}
      </Table.Body>
    </Table.Root>
  );
}
