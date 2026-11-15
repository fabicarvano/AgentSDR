"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  RiChat1Line,
  RiDashboard3Line,
  RiDownloadLine,
  RiErrorWarningLine,
  RiFireLine,
  RiLoader4Line,
  RiMoreLine,
  RiPhoneLine,
  RiRefreshLine,
  RiStarFill,
  RiStarLine,
} from "@remixicon/react";
import { WhatsappLogo } from "./WhatsappLogo";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Table from "@/components/alignui/table";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { EmptyState } from "@/components/page/EmptyState";
import {
  AccountIdentity,
  AccountsFrame,
  AccountsNoMatch,
  PresenceDot,
  type AccountFilter,
} from "@/components/settings/AccountsOverview";
import { Callout } from "@/components/settings/SettingsKit";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { AccountsSkeleton } from "@/components/settings/SettingsSkeletons";
import {
  backfillWhatsappAccount,
  listWhatsappAccounts,
  setDefaultWhatsappAccount,
  setWhatsappNewChatsPerDay,
  syncWhatsappAccounts,
} from "@/lib/whatsapp/client";
import { type WhatsappAccountStatus, type WhatsappAccountSummary } from "@/lib/whatsapp/contract";
import { AccountLimitDialog } from "@/components/settings/AccountLimitDialog";
import { numberRule } from "@/lib/channels/rules";
import { cn } from "@/utils/cn";

// The label of each status is settingsAccounts.whatsapp.status.<status>.
const STATUS_COLOR: Record<WhatsappAccountStatus, React.ComponentProps<typeof Badge.Root>["color"]> = {
  connected: "green",
  credentials: "orange",
  disconnected: "red",
  error: "red",
};

function isFuture(iso: string | null): boolean {
  return Boolean(iso) && new Date(iso as string).getTime() > Date.now();
}

const healthy = (a: WhatsappAccountSummary) => a.status === "connected";

/** The organization's rules (Settings → WhatsApp → Sending rules) the numbers follow. */
export type WhatsappNumberRules = { warmupHours: number; newChatsPerDay: number; secondsBetweenSends: number };

export function WhatsappAccountsClient({ rules }: { rules: WhatsappNumberRules }) {
  const t = useTranslations("settingsAccounts.whatsapp");
  const tPage = useTranslations("settingsAccounts.whatsappPage");
  const format = useFormatter();
  const [accounts, setAccounts] = useState<WhatsappAccountSummary[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [limitAccount, setLimitAccount] = useState<WhatsappAccountSummary | null>(null);
  const newChatsOf = (a: WhatsappAccountSummary) => a.newChatsPerDay ?? rules.newChatsPerDay;
  // An Error carries the text it was thrown with (already written for the person); anything else gets the generic line.
  const errorText = useCallback((cause: unknown) => (cause instanceof Error ? cause.message : t("errors.generic")), [t]);
  const formatWhen = (iso: string | null): string => {
    const date = iso ? new Date(iso) : null;
    return date && !Number.isNaN(date.getTime()) ? format.dateTime(date, { dateStyle: "medium", timeStyle: "short" }) : "—";
  };

  const load = useCallback(async () => {
    try {
      setAccounts((await listWhatsappAccounts()).accounts);
      setError("");
    } catch (cause) {
      setError(errorText(cause));
    }
  }, [errorText]);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    setNotice("");
    setError("");
    try {
      const response = await syncWhatsappAccounts();
      setAccounts(response.accounts);
      setNotice(response.accounts.length ? t("notices.synced") : t("notices.syncedEmpty"));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSyncing(false);
    }
  };

  const makeDefault = async (account: WhatsappAccountSummary) => {
    setBusyId(account.id);
    setNotice("");
    try {
      await setDefaultWhatsappAccount(account.id);
      await load();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusyId(null);
    }
  };

  const backfill = async (account: WhatsappAccountSummary) => {
    setBusyId(account.id);
    setNotice("");
    setError("");
    try {
      await backfillWhatsappAccount(account.id);
      const name = account.name || account.phone;
      setNotice(name ? t("notices.importing", { name }) : t("notices.importingThis"));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (accounts ?? []).filter((a) => {
      if (filter === "healthy" && !healthy(a)) return false;
      if (filter === "attention" && healthy(a)) return false;
      return !q || `${a.name ?? ""} ${a.phone ?? ""}`.toLowerCase().includes(q);
    });
  }, [accounts, query, filter]);

  const total = accounts?.length ?? 0;
  const connected = accounts?.filter(healthy).length ?? 0;
  const attention = total - connected;
  const warmingCount = accounts?.filter((a) => isFuture(a.warmUpEndsAt)).length ?? 0;
  const defaultAccount = accounts?.find((a) => a.isDefault) ?? null;
  const defaultName = defaultAccount?.name || defaultAccount?.phone || null;
  const defaultDescription = !defaultAccount
    ? t("list.noDefault")
    : defaultName
      ? t("list.defaultNamed", { name: defaultName })
      : t("list.defaultUnnamed");

  const syncAction = (
    <Button.Root variant="primary" mode="filled" size="small" disabled={syncing} onClick={() => void sync()}>
      <Button.Icon as={RiRefreshLine} className={cn(syncing && "animate-spin")} />
      {syncing ? t("syncing") : t("sync")}
    </Button.Root>
  );

  return (
    <SettingsPage
      title={tPage("title")}
      description={t("description")}
      actions={syncAction}
    >
      <div className="space-y-5">
        {notice && <Callout tone="success">{notice}</Callout>}
        {error && (
          <Callout
            tone="error"
            action={
              !accounts && (
                <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => void load()}>
                  {t("tryAgain")}
                </Button.Root>
              )
            }
          >
            {error}
          </Callout>
        )}

        {accounts === null ? (
          !error && <AccountsSkeleton />
        ) : accounts.length === 0 ? (
          <Frame>
            <FramePanel>
              <EmptyState
                icon={WhatsappLogo}
                title={t("empty.title")}
                description={t("empty.description")}
                action={syncAction}
              />
            </FramePanel>
          </Frame>
        ) : (
          <div>
            <KpiStrip columns={4}>
              <KpiCell icon={RiPhoneLine} label={t("kpi.connected")} value={String(connected)} context={t("kpi.connectedContext", { count: total })} />
              <KpiCell
                icon={RiErrorWarningLine}
                label={t("kpi.needsAttention")}
                value={String(attention)}
                context={attention === 0 ? t("kpi.everyNumberCanMessage") : t("kpi.relink")}
                hint={t("kpi.needsAttentionHint")}
              />
              <KpiCell
                icon={RiFireLine}
                label={t("kpi.warmingUp")}
                value={String(warmingCount)}
                context={t("kpi.warmingUpContext", { hours: rules.warmupHours })}
                hint={t("kpi.warmingUpHint")}
              />
              <KpiCell
                icon={RiChat1Line}
                label={t("kpi.newChatsADay")}
                value={String((accounts ?? []).filter(healthy).reduce((sum, a) => sum + newChatsOf(a), 0))}
                context={t("kpi.newChatsContext", { perNumber: rules.newChatsPerDay, seconds: rules.secondsBetweenSends })}
                hint={t("kpi.newChatsHint")}
              />
            </KpiStrip>

            <AccountsFrame
              title={t("list.title")}
              description={defaultDescription}
              filter={filter}
              onFilterChange={setFilter}
              counts={{ all: total, healthy: connected, attention }}
              search={query}
              onSearchChange={setQuery}
              searchPlaceholder={t("list.searchPlaceholder")}
            >
              {filtered.length === 0 ? (
                <AccountsNoMatch kind="numbers" />
              ) : (
                <Table.Root className="min-w-180 [&>table]:table-fixed">
                  <Table.Header>
                    <Table.Row>
                      <Table.Head scope="col" className="px-4">{t("table.number")}</Table.Head>
                      <Table.Head scope="col" className="w-64 px-4">{t("table.status")}</Table.Head>
                      <Table.Head scope="col" className="w-36 px-4">{t("table.newChats")}</Table.Head>
                      <Table.Head scope="col" className="w-36 px-4">{t("table.lastSynced")}</Table.Head>
                      <Table.Head scope="col" className="w-16 px-4"><span className="sr-only">{t("table.actions")}</span></Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body spacing={4}>
                    {filtered.map((account) => {
                      const warming = isFuture(account.warmUpEndsAt);
                      const busy = busyId === account.id;
                      const label = account.name || account.phone || t("thisNumber");
                      return (
                        <Table.Row key={account.id} className={cn(busy && "opacity-60")} aria-busy={busy || undefined}>
                          <Table.Cell className="h-16 px-4">
                            <AccountIdentity
                              media={
                                <>
                                  <WhatsappLogo className="size-8" />
                                  <PresenceDot ok={healthy(account)} />
                                </>
                              }
                              name={
                                <>
                                  <span className="truncate text-label-sm text-text-strong-950">{account.name || account.phone || t("numberFallback")}</span>
                                  {account.isDefault && (
                                    <Badge.Root size="small" variant="lighter" color="gray" className="shrink-0">
                                      <Badge.Icon as={RiStarFill} />
                                      {t("row.default")}
                                    </Badge.Root>
                                  )}
                                </>
                              }
                              detail={account.phone && account.name ? account.phone : undefined}
                            />
                          </Table.Cell>
                          <Table.Cell className="px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge.Root size="medium" variant="lighter" color={STATUS_COLOR[account.status]}>
                                <Badge.Dot />
                                {t(`status.${account.status}`)}
                              </Badge.Root>
                              {warming && (
                                <span className="text-paragraph-xs text-text-sub-600" suppressHydrationWarning>
                                  {t("row.warmingUntil", { date: formatWhen(account.warmUpEndsAt) })}
                                </span>
                              )}
                            </div>
                          </Table.Cell>
                          <Table.Cell className="px-4">
                            <p className="text-paragraph-sm tabular-nums text-text-strong-950">{newChatsOf(account)}</p>
                            {account.newChatsPerDay !== null && <p className="text-paragraph-xs text-text-soft-400">{t("row.ownLimit")}</p>}
                          </Table.Cell>
                          <Table.Cell className="whitespace-nowrap px-4 text-paragraph-sm text-text-sub-600" suppressHydrationWarning>
                            {account.lastSyncedAt ? formatWhen(account.lastSyncedAt) : t("row.never")}
                          </Table.Cell>
                          <Table.Cell className="px-4">
                            <div className="flex justify-end">
                              <Dropdown.Root>
                                <Dropdown.Trigger asChild>
                                  <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy} aria-label={t("row.moreActions", { name: label })}>
                                    <Button.Icon as={busy ? RiLoader4Line : RiMoreLine} className={cn(busy && "animate-spin")} />
                                  </Button.Root>
                                </Dropdown.Trigger>
                                <Dropdown.Content align="end">
                                  {!account.isDefault && (
                                    <Dropdown.Item onSelect={() => void makeDefault(account)}>
                                      <Dropdown.ItemIcon as={RiStarLine} />
                                      {t("row.makeDefault")}
                                    </Dropdown.Item>
                                  )}
                                  <Dropdown.Item disabled={account.status !== "connected"} onSelect={() => void backfill(account)}>
                                    <Dropdown.ItemIcon as={RiDownloadLine} />
                                    {t("row.importChats")}
                                  </Dropdown.Item>
                                  <Dropdown.Item onSelect={() => setLimitAccount(account)}>
                                    <Dropdown.ItemIcon as={RiDashboard3Line} />
                                    {t("row.newChatsADay")}
                                  </Dropdown.Item>
                                </Dropdown.Content>
                              </Dropdown.Root>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Root>
              )}
            </AccountsFrame>
          </div>
        )}
      </div>
      {limitAccount && (
        <AccountLimitDialog
          key={limitAccount.id}
          title={t("row.newChatsADay")}
          accountLabel={limitAccount.name || limitAccount.phone || t("thisNumber")}
          channel="whatsapp"
          rule={numberRule("whatsapp", "newChatsPerDay")}
          organizationValue={rules.newChatsPerDay}
          value={limitAccount.newChatsPerDay}
          onClose={() => setLimitAccount(null)}
          onSave={async (newChatsPerDay) => {
            const updated = await setWhatsappNewChatsPerDay(limitAccount.id, newChatsPerDay);
            setAccounts((prev) => prev?.map((a) => (a.id === updated.id ? updated : a)) ?? prev);
          }}
        />
      )}
    </SettingsPage>
  );
}
