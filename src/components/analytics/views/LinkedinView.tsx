"use client";

import Link from "next/link";
import { RiChat1Line, RiCheckDoubleLine, RiMailSendLine, RiPercentLine, RiSendPlaneLine, RiUserAddLine } from "@remixicon/react";
import { useTranslations } from "next-intl";
import * as Badge from "@/components/alignui/badge";
import * as Table from "@/components/alignui/table";
import type { Messages } from "@/i18n/catalog";
import type { LinkedinAnalytics } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { ChartCard } from "../kit/ChartCard";
import { Frame, FrameFooterLink, FrameHeader, FramePanel } from "../kit/Frame";
import { FunnelChart, type FunnelStage } from "../kit/FunnelChart";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { RateCell } from "../kit/RateCell";
import { SeriesStats } from "../kit/SeriesStats";
import { Sparkline } from "../kit/Sparkline";
import { StatusDotBadge } from "../kit/StatusDotBadge";
import { TickMeter } from "../kit/TickMeter";
import { TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "../kit/TimeSeriesChart";
import { ACCENT, CHANNEL_META, STATUS, MUTED } from "../theme";
import { useAnalyticsFormat } from "../useAnalyticsFormat";
import type { ViewProps } from "./types";

/**
 * LinkedIn: KPI strip, invites/accepts/replies lines beside the period funnel,
 * connected accounts beside daily invite capacity, and the campaigns table.
 */

const LINKEDIN = CHANNEL_META.linkedin.color;

// One channel, three series: LinkedIn blue, then violet and aqua — two blues
// side by side were too close to tell apart.
const ACTIVITY_COLORS = {
  invites: LINKEDIN,
  accepted: "#7d52f4",
  replied: CHANNEL_META.whatsapp.color,
} as const;

/** Badge tone for a status this file does not know. */
const UNKNOWN_STATUS_TONE = "neutral" as const;

/** The stored campaign status (upper case here) and its badge tone; the text is analytics.common.campaignStatus.<labelKey>. */
const CAMPAIGN_STATUS = {
  ACTIVE: { tone: "good", labelKey: "active" },
  PAUSED: { tone: "warning", labelKey: "paused" },
} as const satisfies Record<string, { tone: "good" | "warning"; labelKey: keyof Messages["analytics"]["common"]["campaignStatus"] }>;

export function LinkedinView({ data, loading }: ViewProps<"linkedin">) {
  const t = useTranslations("analytics.linkedin");
  const tc = useTranslations("analytics.common");
  const fmt = useAnalyticsFormat();
  const { kpis, range } = data;
  const activityKeys: SeriesKeys<"invites" | "accepted" | "replied"> = {
    invites: { label: t("activity.invites"), color: ACTIVITY_COLORS.invites },
    accepted: { label: t("activity.accepted"), color: ACTIVITY_COLORS.accepted },
    replied: { label: t("activity.replied"), color: ACTIVITY_COLORS.replied },
  };
  const vsPrevious = (m: { previous: number | null }) => (m.previous === null ? undefined : tc("vsPrevious", { value: fmt.compact(m.previous) }));
  const vsPreviousRate = (m: { previous: number | null }) => (m.previous === null ? undefined : tc("vsPrevious", { value: fmt.percent(m.previous) }));
  const spark = (key: "invites" | "accepted" | "replied") => data.activity.points.map((p) => p[key]);
  // "Messaged" includes follow-ups to people accepted in earlier periods, so
  // it can exceed Accepted — it isn't a funnel step; its KPI covers it.
  // Stage names come from the catalog by key (the server's `label` is English); the key union is closed, so a new stage fails tsc here until it is translated.
  const stages: FunnelStage[] = data.funnel.filter((stage) => stage.key !== "messaged").map((stage) => ({ ...stage, label: t(`funnel.stage.${stage.key}`) }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={6}>
        <KpiCell icon={RiSendPlaneLine} label={t("kpi.invites")} value={fmt.compact(kpis.invites.value)} metric={kpis.invites} hint={t("hint.invites")} context={vsPrevious(kpis.invites)} spark={spark("invites")} />
        <KpiCell icon={RiUserAddLine} label={t("kpi.accepted")} value={fmt.compact(kpis.accepted.value)} metric={kpis.accepted} hint={t("hint.accepted")} context={vsPrevious(kpis.accepted)} spark={spark("accepted")} />
        <KpiCell icon={RiCheckDoubleLine} label={t("kpi.acceptanceRate")} value={fmt.percent(kpis.acceptanceRate.value)} metric={kpis.acceptanceRate} hint={t("hint.acceptanceRate")} context={vsPreviousRate(kpis.acceptanceRate)} />
        <KpiCell icon={RiMailSendLine} label={t("kpi.messages")} value={fmt.compact(kpis.messages.value)} metric={kpis.messages} hint={t("hint.messages")} context={vsPrevious(kpis.messages)} />
        <KpiCell icon={RiChat1Line} label={t("kpi.replied")} value={fmt.compact(kpis.replied.value)} metric={kpis.replied} hint={t("hint.replied")} context={t("ofAccepted", { value: fmt.compact(kpis.accepted.value) })} spark={spark("replied")} />
        <KpiCell icon={RiPercentLine} label={t("kpi.replyRate")} value={fmt.percent(kpis.replyRate.value)} metric={kpis.replyRate} hint={t("hint.replyRate")} context={kpis.replyRate.previous === null ? t("replyRateContext") : t("replyRateContextBefore", { value: fmt.percent(kpis.replyRate.previous) })} />
      </KpiStrip>

      <ChartCard
        className="lg:col-span-8"
        title={t("activity.title")}
        description={t("activity.description", { bucket: range.bucket })}
        legend={
          <SeriesStats
            items={(Object.keys(activityKeys) as Array<keyof typeof activityKeys>).map((k) => ({
              label: activityKeys[k].label,
              color: activityKeys[k].color,
              // The KPI totals, not the sum of the points: replied is distinct
              // leads per day in the series, so summing it double-counts.
              value: fmt.compact(kpis[k].value),
            }))}
          />
        }
        loading={loading}
        table={<TimeSeriesTable series={data.activity} keys={activityKeys} bucket={range.bucket} caption={t("activity.caption")} />}
      >
        <TimeSeriesChart series={data.activity} keys={activityKeys} type="line" bucket={range.bucket} />
      </ChartCard>

      <ChartCard className="self-start lg:col-span-4" title={t("funnel.title")} description={t("funnel.description")} loading={loading} footer={t("funnel.footer")}>
        <FunnelChart stages={stages} />
      </ChartCard>

      <AccountsTable accounts={data.accounts} loading={loading} />
      <InviteCapacity accounts={data.accounts} loading={loading} />

      <CampaignsTable campaigns={data.campaigns} loading={loading} />
    </div>
  );
}

function AccountsTable({ accounts, loading }: { accounts: LinkedinAnalytics["accounts"]; loading: boolean }) {
  const t = useTranslations("analytics.linkedin.accounts");
  const tc = useTranslations("analytics.common");
  const fmt = useAnalyticsFormat();
  const rows = [...accounts].sort((a, b) => Number(a.status === "CONNECTED") - Number(b.status === "CONNECTED") || a.name.localeCompare(b.name));
  return (
    <Frame className="self-start lg:col-span-8">
      <FrameHeader title={t("title")} description={t("description")} />
      <FramePanel className={cn("overflow-x-auto p-2 transition-opacity sm:p-3", loading && "opacity-60")}>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-paragraph-sm text-text-sub-600">{t("empty")}</p>
        ) : (
          <Table.Root>
            <Table.Caption className="sr-only">{t("caption")}</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.Head scope="col">{t("account")}</Table.Head>
                <Table.Head scope="col">{t("status")}</Table.Head>
                <Table.Head scope="col" className="min-w-44">{t("invitesToday")}</Table.Head>
                <Table.Head scope="col" className="text-right">{t("pending")}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body spacing={4}>
              {rows.map((a) => {
                const connected = a.status === "CONNECTED";
                return (
                  <Table.Row key={a.id}>
                    <Table.Cell className="h-12">
                      <div className="flex items-center gap-2">
                        <span className="max-w-48 truncate text-label-sm text-text-strong-950">{a.name}</span>
                        {a.premium && <Badge.Root variant="lighter" color="purple" size="small">{t("premium")}</Badge.Root>}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="h-12"><StatusDotBadge status={connected ? "good" : "critical"}>{connected ? tc("connected") : tc("disconnected")}</StatusDotBadge></Table.Cell>
                    <Table.Cell className="h-12">
                      {connected ? <InlineMeter used={a.sentToday} limit={a.dailyLimit} /> : <span className="text-paragraph-sm text-text-soft-400">{t("pausedUntilReconnected")}</span>}
                    </Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{fmt.compact(a.pending)}</Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </FramePanel>
      <FrameFooterLink href="/settings/linkedin-accounts">{t("manage")}</FrameFooterLink>
    </Frame>
  );
}

/** Compact one-line used/limit meter for a table cell; the at-limit state is written out, not colour alone. */
function InlineMeter({ used, limit }: { used: number; limit: number }) {
  const t = useTranslations("analytics.linkedin.accounts");
  const tk = useTranslations("analytics.kit.limit");
  const full = limit > 0 && used >= limit;
  const filled = limit > 0 ? Math.min(10, Math.round((used / limit) * 10)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-paragraph-sm tabular-nums text-text-strong-950">
        {used} <span className="text-text-soft-400">/ {limit}</span>
      </span>
      <span role="meter" aria-label={t("invitesToday")} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} className="flex h-1.5 w-24 gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="h-full flex-1 rounded-[2px]" style={{ backgroundColor: i < filled ? (full ? STATUS.critical : ACCENT) : "var(--color-bg-soft-200)" }} />
        ))}
      </span>
      {full && <span className="text-paragraph-xs text-text-sub-600">{tk("at")}</span>}
    </div>
  );
}

function InviteCapacity({ accounts, loading }: { accounts: LinkedinAnalytics["accounts"]; loading: boolean }) {
  const t = useTranslations("analytics.linkedin.capacity");
  const connected = accounts.filter((a) => a.status === "CONNECTED");
  const used = connected.reduce((sum, a) => sum + a.sentToday, 0);
  const limit = connected.reduce((sum, a) => sum + a.dailyLimit, 0);
  const atCap = connected.filter((a) => a.dailyLimit > 0 && a.sentToday >= a.dailyLimit).length;
  return (
    <Frame className="self-start lg:col-span-4">
      <FrameHeader title={t("title")} description={t("description")} />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        {connected.length === 0 ? (
          <p className="py-6 text-center text-paragraph-sm text-text-sub-600">{t("empty")}</p>
        ) : (
          <>
            <TickMeter label={t("sentToday")} used={used} limit={limit} caption={t("sentTodayCaption", { used, limit })} />
            <p className="mt-4 text-paragraph-sm text-text-sub-600">{t("atCap", { count: atCap })}</p>
          </>
        )}
      </FramePanel>
    </Frame>
  );
}

function CampaignsTable({ campaigns, loading }: { campaigns: LinkedinAnalytics["campaigns"]; loading: boolean }) {
  const t = useTranslations("analytics.linkedin.campaigns");
  const tc = useTranslations("analytics.common");
  const fmt = useAnalyticsFormat();
  const maxAccept = Math.max(...campaigns.map((c) => c.acceptanceRate ?? 0), 0.0001);
  const maxReply = Math.max(...campaigns.map((c) => c.replyRate ?? 0), 0.0001);
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
                <Table.Head scope="col">{t("invited")}</Table.Head>
                <Table.Head scope="col" className="text-right">{t("accepted")}</Table.Head>
                <Table.Head scope="col">{t("acceptanceRate")}</Table.Head>
                <Table.Head scope="col" className="text-right">{tc("replied")}</Table.Head>
                <Table.Head scope="col">{tc("replyRate")}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body spacing={4}>
              {campaigns.map((c) => {
                const known = c.status === "ACTIVE" ? CAMPAIGN_STATUS.ACTIVE : c.status === "PAUSED" ? CAMPAIGN_STATUS.PAUSED : null;
                // An unknown status shows as stored (an upper-case word from the database) rather than a wrong translation.
                const status = known ? { tone: known.tone, label: tc(`campaignStatus.${known.labelKey}`) } : { tone: UNKNOWN_STATUS_TONE, label: c.status };
                return (
                  <Table.Row key={c.id}>
                    <Table.Cell className="h-12">
                      <div className="flex min-w-0 items-center gap-3">
                        <Link href={`/linkedin/campaigns/${c.id}`} className="max-w-64 truncate rounded-md text-label-sm text-text-strong-950 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-base">{c.name}</Link>
                        <StatusDotBadge status={status.tone}>{status.label}</StatusDotBadge>
                      </div>
                    </Table.Cell>
                    <Table.Cell className={num}>{fmt.compact(c.leads)}</Table.Cell>
                    <Table.Cell className="h-12">
                      <div className="flex items-center gap-3">
                        <span className="w-10 text-paragraph-sm tabular-nums text-text-strong-950">{fmt.compact(c.invited)}</span>
                        <Sparkline data={c.trend} color={MUTED} className="hidden w-16 sm:block" />
                      </div>
                    </Table.Cell>
                    <Table.Cell className={num}>{fmt.compact(c.accepted)}</Table.Cell>
                    <Table.Cell className="h-12"><RateCell rate={c.acceptanceRate} max={maxAccept} color={LINKEDIN} /></Table.Cell>
                    <Table.Cell className={num}>{fmt.compact(c.replied)}</Table.Cell>
                    <Table.Cell className="h-12"><RateCell rate={c.replyRate} max={maxReply} color={LINKEDIN} /></Table.Cell>
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
