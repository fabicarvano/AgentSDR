"use client";

import { useTranslations } from "next-intl";
import {
  RiChat1Line,
  RiCheckboxCircleLine,
  RiCheckDoubleLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiReplyLine,
  RiSendPlaneLine,
  RiTeamLine,
  RiTimeLine,
} from "@remixicon/react";
import { BarList, type BarListItem } from "@/components/analytics/kit/BarList";
import { ChartCard } from "@/components/analytics/kit/ChartCard";
import { DonutChart, type DonutItem } from "@/components/analytics/kit/DonutChart";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { FunnelChart } from "@/components/analytics/kit/FunnelChart";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { SeriesStats } from "@/components/analytics/kit/SeriesStats";
import { seriesTotal, TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "@/components/analytics/kit/TimeSeriesChart";
import { Skeleton } from "@/components/page/Skeletons";
import { CHANNEL_META, MUTED, STATUS } from "@/components/analytics/theme";
import { useAnalyticsFormat } from "@/components/analytics/useAnalyticsFormat";
import type { CampaignFunnel } from "./metrics";

/**
 * A LinkedIn campaign's Overview: headline numbers, the invited → accepted →
 * replied funnel, the last 7 days of invitations and accepts (grouped bars —
 * seven discrete daily counts), where every
 * lead stands now (a donut — the states are exclusive and sum to the leads),
 * and how far accepted leads have got through the follow-ups.
 *
 * Colours follow the Analytics LinkedIn view: invites wear the channel blue,
 * accepts violet. Lead states reuse the send-campaign donut's slots so the
 * two campaign pages read alike.
 */

const LINKEDIN = CHANNEL_META.linkedin.color;

export type ChartDay = { date: string; invitations: number; accepted: number };

type ActivityKey = "invites" | "accepted";
function activityKeys(t: ReturnType<typeof useTranslations<"linkedinCampaigns.overview">>): SeriesKeys<ActivityKey> {
  return {
    invites: { label: t("activityInvites"), color: LINKEDIN },
    accepted: { label: t("activityAccepted"), color: "#7d52f4" },
  };
}

/**
 * The chart-data route labels its seven days "Sep 24" (today last); the kit
 * wants YYYY-MM-DD. The days are consecutive and end today, so the position
 * gives the date without parsing the label.
 */
function toSeries(days: ChartDay[]) {
  const today = new Date();
  const points = days.map((day, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days.length - 1 - i));
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { date: iso, invites: day.invitations, accepted: day.accepted };
  });
  return { keys: ["invites", "accepted"] as const, points };
}

export function CampaignOverview({
  funnel: f,
  statusCounts: s,
  chartData,
}: {
  funnel: CampaignFunnel;
  statusCounts: Record<string, number>;
  /** null while the 7-day activity is loading. */
  chartData: ChartDay[] | null;
}) {
  const t = useTranslations("linkedinCampaigns.overview");
  const fmt = useAnalyticsFormat();
  const pct = (part: number, whole: number): string | undefined => (whole > 0 ? fmt.percent(part / whole) : undefined);
  const ACTIVITY_KEYS = activityKeys(t);
  const series = toSeries(chartData ?? []);
  const activityStats = (Object.keys(ACTIVITY_KEYS) as ActivityKey[]).map((k) => ({
    label: ACTIVITY_KEYS[k].label,
    color: ACTIVITY_KEYS[k].color,
    value: chartData ? fmt.compact(seriesTotal(series, k)) : "—",
  }));

  const leadStates: DonutItem[] = [
    { key: "queued", label: t("stateQueued"), value: f.queued, color: MUTED, icon: RiTimeLine },
    { key: "awaiting", label: t("stateAwaiting"), value: f.awaiting, color: LINKEDIN, icon: RiSendPlaneLine },
    { key: "inSequence", label: t("stateInSequence"), value: f.inSequence, color: "#e5930a", icon: RiLoader4Line },
    { key: "completed", label: t("stateCompleted"), value: f.completed, color: STATUS.good, icon: RiCheckboxCircleLine },
    { key: "replied", label: t("stateReplied"), value: f.replied, color: "#7d52f4", icon: RiReplyLine },
    { key: "failed", label: t("stateFailed"), value: f.failed + f.cancelled, color: STATUS.critical, icon: RiErrorWarningLine },
  ];

  const n = (key: string) => s[key] ?? 0;
  const sequenceSteps: BarListItem[] = [
    { key: "CONNECTED", label: t("stepConnected"), value: n("CONNECTED") },
    { key: "ACCEPT_MESSAGE_SENT", label: t("stepAcceptSent"), value: n("ACCEPT_MESSAGE_SENT") },
    { key: "FOLLOW_UP_1_SENT", label: t("stepFollowUpSent", { number: 1 }), value: n("FOLLOW_UP_1_SENT") },
    { key: "FOLLOW_UP_2_SENT", label: t("stepFollowUpSent", { number: 2 }), value: n("FOLLOW_UP_2_SENT") },
    { key: "FOLLOW_UP_3_SENT", label: t("stepFollowUpSent", { number: 3 }), value: n("FOLLOW_UP_3_SENT") },
    { key: "COMPLETED", label: t("stepCompleted"), value: n("COMPLETED") },
    { key: "REPLIED", label: t("stepReplied"), value: n("REPLIED") },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={5}>
        <KpiCell icon={RiTeamLine} label={t("kpiLeads")} value={fmt.compact(f.total)} context={f.queued > 0 ? t("kpiLeadsQueued", { count: fmt.compact(f.queued) }) : t("kpiLeadsAllInvited")} />
        <KpiCell icon={RiSendPlaneLine} label={t("kpiInvited")} value={fmt.compact(f.invited)} context={pct(f.invited, f.total) ? t("kpiInvitedContext", { rate: pct(f.invited, f.total)! }) : undefined} hint={t("kpiInvitedHint")} />
        <KpiCell icon={RiCheckDoubleLine} label={t("kpiAccepted")} value={fmt.compact(f.accepted)} context={f.acceptanceRate !== null ? t("kpiAcceptedContext", { rate: fmt.percent(f.acceptanceRate) }) : undefined} hint={t("kpiAcceptedHint")} />
        <KpiCell icon={RiChat1Line} label={t("kpiReplied")} value={fmt.compact(f.replied)} context={f.replyRate !== null ? t("kpiRepliedContext", { rate: fmt.percent(f.replyRate) }) : undefined} hint={t("kpiRepliedHint")} />
        <KpiCell icon={RiErrorWarningLine} label={t("kpiFailed")} value={fmt.compact(f.failed)} context={f.cancelled > 0 ? t("kpiFailedCancelled", { count: f.cancelled }) : f.failed > 0 ? t("kpiFailedContext") : t("kpiFailedNone")} hint={t("kpiFailedHint")} />
      </KpiStrip>

      <ChartCard
        className="lg:col-span-8"
        title={t("activityTitle")}
        description={t("activityDescription")}
        loading={chartData === null}
        legend={<SeriesStats items={activityStats} />}
        table={<TimeSeriesTable series={series} keys={ACTIVITY_KEYS} bucket="day" caption={t("activityCaption")} />}
      >
        {chartData === null ? (
          <Skeleton className="h-[260px] w-full rounded-xl" />
        ) : (
          <TimeSeriesChart series={series} keys={ACTIVITY_KEYS} type="bar" bucket="day" />
        )}
      </ChartCard>

      <Frame className="self-start lg:col-span-4">
        <FrameHeader title={t("funnelTitle")} description={t("funnelDescription")} />
        <FramePanel>
          <FunnelChart
            stages={[
              { key: "invited", label: t("kpiInvited"), value: f.invited },
              { key: "accepted", label: t("kpiAccepted"), value: f.accepted },
              { key: "replied", label: t("kpiReplied"), value: f.replied },
            ]}
          />
        </FramePanel>
        <FrameFooter>{t("funnelFooter")}</FrameFooter>
      </Frame>

      <Frame className="lg:col-span-6">
        <FrameHeader title={t("standTitle")} description={t("standDescription")} />
        <FramePanel>
          <DonutChart items={leadStates} centerLabel={t("donutCenter")} emptyLabel={t("donutEmptyLabel")} emptyDescription={t("donutEmptyDescription")} />
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-6">
        <FrameHeader title={t("progressTitle")} description={t("progressDescription")} />
        <FramePanel>
          <BarList items={f.accepted > 0 ? sequenceSteps : []} emptyLabel={t("progressEmpty")} />
        </FramePanel>
      </Frame>
    </div>
  );
}
