"use client";

import Link from "next/link";
import { RiAlertLine, RiInformationLine, RiMailSendLine, RiMailForbidLine, RiChat1Line, RiPercentLine, RiUserSharedLine, RiUserUnfollowLine } from "@remixicon/react";
import { useTranslations } from "next-intl";
import * as Table from "@/components/alignui/table";
import type { Messages } from "@/i18n/catalog";
import type { EmailAnalytics } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { CapacityMeter } from "../kit/CapacityMeter";
import { ChartCard } from "../kit/ChartCard";
import { Frame, FrameFooterLink, FrameHeader, FramePanel } from "../kit/Frame";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { RateCell } from "../kit/RateCell";
import { SeriesStats } from "../kit/SeriesStats";
import { Sparkline } from "../kit/Sparkline";
import { StatusDotBadge } from "../kit/StatusDotBadge";
import { TickMeter } from "../kit/TickMeter";
import { seriesTotal, TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "../kit/TimeSeriesChart";
import { CHANNEL_META, MUTED } from "../theme";
import { useAnalyticsFormat } from "../useAnalyticsFormat";
import type { ViewProps } from "./types";

/**
 * Email: KPI strip, sending activity (first touch vs follow-ups) beside
 * today's mailbox capacity, replies over time beside a "not tracked" note, and
 * the campaigns table.
 */

const EMAIL = CHANNEL_META.email.color;

/** Badge tone for a status this file does not know. */
const UNKNOWN_STATUS_TONE = "neutral" as const;

/** The stored campaign status (a lowercase value) and its badge tone; the text is analytics.common.campaignStatus.<status>. */
const CAMPAIGN_STATUS: Record<string, { tone: "good" | "warning" | "neutral" | "info"; labelKey: keyof Messages["analytics"]["common"]["campaignStatus"] }> = {
  active: { tone: "good", labelKey: "active" },
  paused: { tone: "warning", labelKey: "paused" },
  draft: { tone: "neutral", labelKey: "draft" },
  completed: { tone: "info", labelKey: "completed" },
};

function totalsSpark(series: EmailAnalytics["sends"]): number[] {
  return series.points.map((p) => p.firstTouch + p.followUp);
}

export function EmailView({ data, loading }: ViewProps<"email">) {
  const t = useTranslations("analytics.email");
  const tc = useTranslations("analytics.common");
  const fmt = useAnalyticsFormat();
  const { kpis, range } = data;
  const sendKeys: SeriesKeys<"firstTouch" | "followUp"> = {
    firstTouch: { label: t("sending.firstTouch"), color: EMAIL },
    followUp: { label: t("sending.followUp"), color: MUTED },
  };
  const replyKeys: SeriesKeys<"replies"> = { replies: { label: t("replies.title"), color: EMAIL } };
  const vsPrevious = (m: { previous: number | null }) => (m.previous === null ? undefined : tc("vsPrevious", { value: fmt.compact(m.previous) }));
  const repliesTotal = seriesTotal(data.replies, "replies");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={6}>
        <KpiCell icon={RiMailSendLine} label={t("kpi.sent")} value={fmt.compact(kpis.sent.value)} metric={kpis.sent} hint={t("hint.sent")} context={vsPrevious(kpis.sent)} spark={totalsSpark(data.sends)} />
        <KpiCell icon={RiUserSharedLine} label={t("kpi.contacted")} value={fmt.compact(kpis.contacted.value)} metric={kpis.contacted} hint={t("hint.contacted")} context={vsPrevious(kpis.contacted)} />
        <KpiCell icon={RiChat1Line} label={t("kpi.replied")} value={fmt.compact(kpis.replied.value)} metric={kpis.replied} hint={t("hint.replied")} context={t("ofContacted", { value: fmt.compact(kpis.contacted.value) })} spark={data.replies.points.map((p) => p.replies)} />
        <KpiCell icon={RiPercentLine} label={t("kpi.replyRate")} value={fmt.percent(kpis.replyRate.value)} metric={kpis.replyRate} hint={t("hint.replyRate")} context={kpis.replyRate.previous === null ? undefined : tc("vsPrevious", { value: fmt.percent(kpis.replyRate.previous) })} />
        <KpiCell icon={RiMailForbidLine} label={t("kpi.bounced")} value={fmt.compact(kpis.bounced.value)} metric={kpis.bounced} upIsGood={false} hint={t("hint.bounced")} context={vsPrevious(kpis.bounced)} />
        <KpiCell icon={RiUserUnfollowLine} label={t("kpi.unsubscribed")} value={fmt.compact(kpis.unsubscribed.value)} metric={kpis.unsubscribed} upIsGood={false} hint={t("hint.unsubscribed")} context={vsPrevious(kpis.unsubscribed)} />
      </KpiStrip>

      <ChartCard
        className="lg:col-span-8"
        title={t("sending.title")}
        description={t("sending.description", { bucket: range.bucket })}
        legend={
          <SeriesStats
            items={[
              { label: sendKeys.firstTouch.label, color: sendKeys.firstTouch.color, value: fmt.compact(seriesTotal(data.sends, "firstTouch")) },
              { label: sendKeys.followUp.label, color: sendKeys.followUp.color, value: fmt.compact(seriesTotal(data.sends, "followUp")) },
            ]}
          />
        }
        loading={loading}
        table={<TimeSeriesTable series={data.sends} keys={sendKeys} bucket={range.bucket} caption={t("sending.caption")} />}
        footer={
          data.failedSends > 0 ? (
            <span className="flex items-center gap-1.5">
              <RiAlertLine className="size-4 shrink-0 text-warning-base" aria-hidden="true" />
              {t("sending.failed", { count: data.failedSends })}
            </span>
          ) : undefined
        }
      >
        <TimeSeriesChart series={data.sends} keys={sendKeys} type="stackedBar" bucket={range.bucket} height={440} />
      </ChartCard>

      <MailboxCapacity mailboxes={data.mailboxes} loading={loading} />

      <ChartCard
        className="lg:col-span-8"
        title={t("replies.title")}
        description={t("replies.description", { bucket: range.bucket })}
        legend={<SeriesStats items={[{ label: t("replies.title"), color: EMAIL, value: fmt.compact(repliesTotal), metric: kpis.replied }]} />}
        loading={loading}
        table={<TimeSeriesTable series={data.replies} keys={replyKeys} bucket={range.bucket} caption={t("replies.caption")} />}
      >
        <TimeSeriesChart series={data.replies} keys={replyKeys} type="bar" bucket={range.bucket} />
      </ChartCard>

      <Frame className="self-start lg:col-span-4">
        <FrameHeader title={t("notTracked.title")} />
        <FramePanel className="bg-information-lighter ring-information-light/40 sm:p-5">
          <div className="flex items-start gap-3">
            <RiInformationLine className="mt-0.5 size-5 shrink-0 text-information-base" aria-hidden="true" />
            <p className="text-paragraph-sm text-text-sub-600">{t("notTracked.body")}</p>
          </div>
        </FramePanel>
      </Frame>

      <CampaignsTable campaigns={data.campaigns} loading={loading} />
    </div>
  );
}

function MailboxCapacity({ mailboxes, loading }: { mailboxes: EmailAnalytics["mailboxes"]; loading: boolean }) {
  const t = useTranslations("analytics.email.mailbox");
  const tc = useTranslations("analytics.common");
  const top = [...mailboxes.rows].sort((a, b) => b.sentToday - a.sentToday).slice(0, 5);
  return (
    <Frame className="lg:col-span-4">
      <FrameHeader title={t("title")} description={tc("regardlessOfRange")} />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        {mailboxes.total === 0 ? (
          <p className="py-6 text-center text-paragraph-sm text-text-sub-600">{t("empty")}</p>
        ) : (
          <>
            <TickMeter label={t("sentToday")} used={mailboxes.sentToday} limit={mailboxes.capacityToday} caption={t("sentTodayCaption", { used: mailboxes.sentToday, limit: mailboxes.capacityToday })} />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusDotBadge status="good">{t("connected", { count: mailboxes.connected })}</StatusDotBadge>
              <StatusDotBadge status={mailboxes.failing > 0 ? "critical" : "neutral"}>{t("failing", { count: mailboxes.failing })}</StatusDotBadge>
            </div>
            {top.length > 0 && (
              <ul className="mt-5 flex flex-col gap-4 border-t border-stroke-soft-200 pt-4">
                {top.map((m) => (
                  <li key={m.id}>
                    <CapacityMeter label={m.email} used={m.sentToday} limit={m.dailyLimit} segments={16} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </FramePanel>
      <FrameFooterLink href="/settings/email-accounts">{t("manage")}</FrameFooterLink>
    </Frame>
  );
}

function CampaignsTable({ campaigns, loading }: { campaigns: EmailAnalytics["campaigns"]; loading: boolean }) {
  const t = useTranslations("analytics.email.campaigns");
  const tc = useTranslations("analytics.common");
  const fmt = useAnalyticsFormat();
  const maxRate = Math.max(...campaigns.map((c) => c.replyRate ?? 0), 0.0001);
  const num = "h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950";
  return (
    <Frame className="lg:col-span-12">
      <FrameHeader title={t("title")} description={t("description")} />
      <FramePanel className={cn("overflow-x-auto p-2 transition-opacity sm:p-3", loading && "opacity-60")}>
        {campaigns.length === 0 ? (
          <p className="py-10 text-center text-paragraph-sm text-text-sub-600">{t("empty")}</p>
        ) : (
          <Table.Root>
            <Table.Caption className="sr-only">{t("caption")}</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.Head scope="col">{tc("campaign")}</Table.Head>
                <Table.Head scope="col" className="text-right">{tc("leads")}</Table.Head>
                <Table.Head scope="col" className="text-right">{t("contacted")}</Table.Head>
                <Table.Head scope="col">{t("sent")}</Table.Head>
                <Table.Head scope="col" className="text-right">{tc("replied")}</Table.Head>
                <Table.Head scope="col">{tc("replyRate")}</Table.Head>
                <Table.Head scope="col" className="text-right">{t("bounced")}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body spacing={4}>
              {campaigns.map((c) => {
                const known = CAMPAIGN_STATUS[c.status];
                // An unknown status shows as stored (a lowercase word from the database) rather than a wrong translation.
                const status = known ? { tone: known.tone, label: tc(`campaignStatus.${known.labelKey}`) } : { tone: UNKNOWN_STATUS_TONE, label: c.status };
                return (
                  <Table.Row key={c.id}>
                    <Table.Cell className="h-12">
                      <div className="flex min-w-0 items-center gap-3">
                        <Link href={`/outreach/campaigns/${c.id}`} className="max-w-64 truncate rounded-md text-label-sm text-text-strong-950 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-base">{c.name}</Link>
                        <StatusDotBadge status={status.tone}>{status.label}</StatusDotBadge>
                      </div>
                    </Table.Cell>
                    <Table.Cell className={num}>{fmt.compact(c.leads)}</Table.Cell>
                    <Table.Cell className={num}>{fmt.compact(c.contacted)}</Table.Cell>
                    <Table.Cell className="h-12">
                      <div className="flex items-center gap-3">
                        <span className="w-10 text-paragraph-sm tabular-nums text-text-strong-950">{fmt.compact(c.sentInRange)}</span>
                        <Sparkline data={c.trend} color={MUTED} className="hidden w-16 sm:block" />
                      </div>
                    </Table.Cell>
                    <Table.Cell className={num}>{fmt.compact(c.replied)}</Table.Cell>
                    <Table.Cell className="h-12"><RateCell rate={c.replyRate} max={maxRate} color={EMAIL} /></Table.Cell>
                    <Table.Cell className={cn(num, c.bounced === 0 && "text-text-soft-400")}>{fmt.compact(c.bounced)}</Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </FramePanel>
    </Frame>
  );
}
