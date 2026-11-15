"use client";

import { useMemo, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { RiErrorWarningLine, RiMailCheckLine, RiMailLine, RiMailSendLine, RiSpeedUpLine } from "@remixicon/react";

import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { formatPercent } from "@/components/analytics/theme";
import { DocsLink } from "@/components/page/DocsLink";
import { EmptyState } from "@/components/page/EmptyState";
import { ACCOUNTS_PAGE_SIZE, AccountsFrame, AccountsNoMatch, AccountsPager, type AccountFilter } from "@/components/settings/AccountsOverview";
import AddMailboxButton from "./AddMailboxButton";
import MailboxTable from "./MailboxTable";
import type { mailboxes } from "@/lib/outreach/schema";

type Mailbox = typeof mailboxes.$inferSelect;

const healthy = (m: Mailbox) => m.status === "connected";

export default function MailboxesPageClient({ mailboxes }: { mailboxes: Mailbox[] }) {
  const t = useTranslations("settingsAccounts.mailboxes");
  const format = useFormatter();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [page, setPage] = useState(0);

  const connected = mailboxes.filter(healthy).length;
  const attention = mailboxes.length - connected;
  const failed = mailboxes.filter((m) => m.status === "failed").length;
  const sentToday = mailboxes.reduce((sum, m) => sum + m.todayEmailsSent, 0);
  // Only a connected mailbox can send, so only its limit is capacity.
  const capacity = mailboxes.filter(healthy).reduce((sum, m) => sum + m.dailySendLimit, 0);
  const left = Math.max(capacity - mailboxes.filter(healthy).reduce((sum, m) => sum + m.todayEmailsSent, 0), 0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return mailboxes
      .filter((m) => {
        if (filter === "healthy" && !healthy(m)) return false;
        if (filter === "attention" && healthy(m)) return false;
        if (!term) return true;
        return m.emailAddress.toLowerCase().includes(term) || (m.displayName ?? "").toLowerCase().includes(term);
      })
      // Mailboxes that need attention first, so a failure is never on page 5.
      .sort((a, b) => Number(healthy(a)) - Number(healthy(b)));
  }, [mailboxes, search, filter]);

  // A filter or search that shrinks the list can leave the page past its end.
  const pageCount = Math.max(1, Math.ceil(filtered.length / ACCOUNTS_PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * ACCOUNTS_PAGE_SIZE, (current + 1) * ACCOUNTS_PAGE_SIZE);

  if (mailboxes.length === 0) {
    return (
      <Frame>
        <FramePanel>
          <EmptyState
            icon={RiMailLine}
            title={t("empty.title")}
            description={t("empty.description")}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <AddMailboxButton />
                <DocsLink page="email/connect#add-a-mailbox" />
              </div>
            }
          />
        </FramePanel>
      </Frame>
    );
  }

  return (
    <div>
      <KpiStrip columns={4}>
        <KpiCell icon={RiMailCheckLine} label={t("kpi.connected")} value={String(connected)} context={t("kpi.connectedContext", { count: mailboxes.length })} />
        <KpiCell
          icon={RiErrorWarningLine}
          label={t("kpi.needsAttention")}
          value={String(attention)}
          context={attention === 0 ? t("kpi.everySending") : failed > 0 ? t("kpi.failed", { count: failed }) : t("kpi.disabledOrConnecting")}
          hint={t("kpi.needsAttentionHint")}
        />
        <KpiCell icon={RiMailSendLine} label={t("kpi.sentToday")} value={format.number(sentToday)} context={capacity > 0 ? t("kpi.capacityShare", { percent: formatPercent(sentToday / capacity, undefined, locale) }) : t("kpi.noCapacity")} />
        <KpiCell
          icon={RiSpeedUpLine}
          label={t("kpi.leftToday")}
          value={format.number(left)}
          context={t("kpi.leftContext", { capacity })}
          hint={t("kpi.leftHint")}
        />
      </KpiStrip>

      <AccountsFrame
        title={t("list.title")}
        description={t("list.description")}
        filter={filter}
        onFilterChange={(next) => {
          setFilter(next);
          setPage(0);
        }}
        counts={{ all: mailboxes.length, healthy: connected, attention }}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        searchPlaceholder={t("list.searchPlaceholder")}
        footer={<AccountsPager page={current} total={filtered.length} kind="mailboxes" onPage={setPage} />}
      >
        {filtered.length === 0 ? <AccountsNoMatch kind="mailboxes" /> : <MailboxTable mailboxes={visible} />}
      </AccountsFrame>
    </div>
  );
}
