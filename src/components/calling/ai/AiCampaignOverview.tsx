"use client";

import {
  RiCalendarCheckLine,
  RiChat1Line,
  RiCheckboxCircleLine,
  RiCustomerService2Line,
  RiErrorWarningLine,
  RiHourglassLine,
  RiPhoneLine,
  RiPercentLine,
  RiStarLine,
  RiStopCircleLine,
  RiTeamLine,
  RiThumbDownLine,
} from "@remixicon/react";
import { useTranslations } from "next-intl";
import { BarList, type BarListItem } from "@/components/analytics/kit/BarList";
import { ChartCard } from "@/components/analytics/kit/ChartCard";
import { ChartLegend } from "@/components/analytics/kit/ChartLegend";
import { DonutChart, type DonutItem } from "@/components/analytics/kit/DonutChart";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { FunnelChart } from "@/components/analytics/kit/FunnelChart";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "@/components/analytics/kit/TimeSeriesChart";
import { CHANNEL_META, HUE, MUTED, STATUS } from "@/components/analytics/theme";
import { useAnalyticsFormat } from "@/components/analytics/useAnalyticsFormat";
import { Skeleton } from "@/components/page/Skeletons";
import { AGENT_OUTCOMES } from "@/lib/calls/contract";
import type { AiCampaignDetail, AiCampaignStats } from "@/lib/calls/aiCampaigns/api";
import { useAiOutcomeLabel } from "./AiLeadDrawer";
import { useAiStepText } from "./useAiServerText";

const WA = CHANNEL_META.whatsapp.color;
const OUTCOME_COLOR: Record<(typeof AGENT_OUTCOMES)[number], string> = {
  meeting_booked: HUE.green,
  interested: HUE.teal,
  human_callback: HUE.sky,
  call_back: HUE.blue,
  not_interested: HUE.red,
  wrong_person: HUE.orange,
  do_not_contact: HUE.red,
  no_response: MUTED,
  other: MUTED,
};

/** The Overview tab: headline numbers for the team, where leads stand, the per-step funnel, outcomes and calls per day. */
export function AiCampaignOverview({ campaign, stats }: { campaign: AiCampaignDetail; stats: AiCampaignStats | null }) {
  const t = useTranslations("callingAiWork.overview");
  const fmt = useAnalyticsFormat();
  const outcomeLabel = useAiOutcomeLabel();
  const stepText = useAiStepText();
  const pct = (part: number, whole: number): string | undefined => (whole > 0 ? fmt.percent(part / whole) : undefined);
  const DAY_KEYS: SeriesKeys<"answered" | "unanswered"> = {
    answered: { label: t("answered"), color: WA },
    unanswered: { label: t("notAnswered"), color: MUTED },
  };
  if (!stats) {
    return (
      <div aria-busy="true" aria-label={t("loading")} className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  const s = stats;
  const inProgress = s.byStatus.queued + s.byStatus.reaching + s.byStatus.callback;
  const leadStates: DonutItem[] = [
    { key: "progress", label: t("stateInProgress"), value: inProgress, color: HUE.amber, icon: RiHourglassLine },
    { key: "chasing", label: t("stateChasing"), value: s.byStatus.chasing, color: HUE.purple, icon: RiCalendarCheckLine },
    { key: "booked", label: t("stateBooked"), value: s.byStatus.booked, color: STATUS.good, icon: RiCheckboxCircleLine },
    { key: "team", label: t("stateTeam"), value: s.byStatus.handoff + s.byStatus.replied, color: HUE.teal, icon: RiCustomerService2Line },
    { key: "no", label: t("stateNotInterested"), value: s.byStatus.not_interested, color: MUTED, icon: RiThumbDownLine },
    { key: "ended", label: t("stateEnded"), value: s.byStatus.unreached + s.byStatus.stopped + s.byStatus.failed, color: STATUS.critical, icon: RiStopCircleLine },
  ];

  const reachSteps = s.perStep.filter((step) => step.phase === "reach");
  const chaseSteps = s.perStep.filter((step) => step.phase !== "reach");
  const outcomes: BarListItem[] = AGENT_OUTCOMES.filter((key) => (s.outcomes[key] ?? 0) > 0).map((key) => ({
    key,
    label: outcomeLabel(key),
    value: s.outcomes[key] ?? 0,
    color: OUTCOME_COLOR[key],
  }));
  const series = {
    keys: ["answered", "unanswered"] as const,
    points: s.callsByDay.map((day) => ({ date: day.date, answered: day.answered, unanswered: Math.max(day.placed - day.answered, 0) })),
  };
  const limit = campaign.callsPerDayLimit;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={6}>
        <KpiCell icon={RiTeamLine} label={t("kpiLeads")} value={fmt.compact(s.total)} context={s.byStatus.queued > 0 ? t("notCalledYet", { count: fmt.compact(s.byStatus.queued) }) : s.total > 0 ? t("everyoneReached") : undefined} />
        <KpiCell
          icon={RiPhoneLine}
          label={t("kpiCallsToday")}
          value={limit > 0 ? t("callsTodayOfLimit", { count: fmt.compact(s.callsToday), limit: fmt.compact(limit) }) : fmt.compact(s.callsToday)}
          context={t("placedInAll", { count: fmt.compact(s.callsPlaced) })}
          hint={t("callsTodayHint")}
        />
        <KpiCell icon={RiPercentLine} label={t("kpiAnswered")} value={fmt.percent(s.callsPlaced > 0 ? s.callsAnswered / s.callsPlaced : null)} context={s.callsPlaced > 0 ? t("answeredOfCalls", { answered: s.callsAnswered, placed: s.callsPlaced }) : t("noCallsYet")} hint={t("answeredHint")} />
        <KpiCell icon={RiChat1Line} label={t("kpiConversations")} value={fmt.compact(s.conversations)} context={pct(s.conversations, s.callsPlaced) ? t("shareOfCalls", { share: pct(s.conversations, s.callsPlaced) ?? "" }) : undefined} hint={t("conversationsHint")} />
        <KpiCell icon={RiStarLine} label={t("kpiInterested")} value={fmt.compact(s.interested)} context={pct(s.interested, s.conversations) ? t("shareOfConversations", { share: pct(s.interested, s.conversations) ?? "" }) : undefined} hint={t("interestedHint")} />
        <KpiCell icon={RiCalendarCheckLine} label={t("kpiBooked")} value={fmt.compact(s.booked)} context={s.handoffs > 0 ? t("handedToTeam", { count: fmt.compact(s.handoffs) }) : s.messagesSent > 0 ? t("messagesSent", { count: fmt.compact(s.messagesSent) }) : undefined} hint={t("bookedHint")} />
      </KpiStrip>

      <Frame className="self-start lg:col-span-5">
        <FrameHeader title={t("standTitle")} description={t("standDescription")} />
        <FramePanel>
          <DonutChart items={leadStates} centerLabel={t("centerLabel")} emptyLabel={t("noLeadsYet")} emptyDescription={t("noLeadsHint")} />
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-7">
        <FrameHeader title={t("funnelTitle")} description={t("funnelDescription")} />
        <FramePanel>
          {reachSteps.some((step) => step.attempted > 0) ? (
            <FunnelChart stages={reachSteps.map((step) => ({ key: step.key, label: stepText.stat(step.labelRef), value: step.attempted }))} />
          ) : (
            <p className="py-6 text-center text-paragraph-sm text-text-sub-600">{t("noStepsYet")}</p>
          )}
          {chaseSteps.some((step) => step.attempted > 0) && (
            <div className="mt-5 border-t border-stroke-soft-200 pt-4">
              <p className="mb-3 text-label-sm text-text-strong-950">{t("afterYes")}</p>
              <BarList items={chaseSteps.filter((step) => step.attempted > 0).map((step) => ({ key: step.key, label: stepText.stat(step.labelRef), value: step.attempted, color: HUE.purple }))} />
            </div>
          )}
        </FramePanel>
      </Frame>

      <ChartCard
        className="lg:col-span-8"
        title={t("perDayTitle")}
        description={t("perDayDescription")}
        legend={<ChartLegend items={[{ label: DAY_KEYS.answered.label, color: DAY_KEYS.answered.color }, { label: DAY_KEYS.unanswered.label, color: DAY_KEYS.unanswered.color }]} />}
        table={<TimeSeriesTable series={series} keys={DAY_KEYS} bucket="day" caption={t("perDayTitle")} />}
      >
        <TimeSeriesChart series={series} keys={DAY_KEYS} type="stackedBar" bucket="day" />
      </ChartCard>

      <Frame className="self-start lg:col-span-4">
        <FrameHeader title={t("heardTitle")} description={t("heardDescription")} />
        <FramePanel>
          <BarList items={outcomes} emptyLabel={t("noConversationsYet")} />
          {s.callsPlaced > s.callsAnswered && (
            <p className="mt-4 flex items-center gap-1.5 text-paragraph-xs text-text-sub-600">
              <RiErrorWarningLine className="size-3.5 shrink-0" aria-hidden="true" />
              {t("notAnsweredNote", { count: s.callsPlaced - s.callsAnswered })}
            </p>
          )}
        </FramePanel>
      </Frame>
    </div>
  );
}
