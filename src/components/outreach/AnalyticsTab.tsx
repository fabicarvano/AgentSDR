"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiForbid2Line,
  RiLoader4Line,
  RiMailCheckLine,
  RiMailSendLine,
  RiReplyLine,
  RiTeamLine,
  RiTimeLine,
} from "@remixicon/react";

import * as SegmentedControl from "@/components/alignui/segmented-control";
import { ChartCard } from "@/components/analytics/kit/ChartCard";
import { DonutChart, type DonutItem } from "@/components/analytics/kit/DonutChart";
import { EmptyChart } from "@/components/analytics/kit/EmptyChart";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { FunnelChart } from "@/components/analytics/kit/FunnelChart";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { SeriesStats } from "@/components/analytics/kit/SeriesStats";
import { seriesTotal, TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "@/components/analytics/kit/TimeSeriesChart";
import { CHANNEL_META, MUTED, STATUS } from "@/components/analytics/theme";
import { useAnalyticsFormat } from "@/components/analytics/useAnalyticsFormat";
import type { DailySends } from "@/lib/outreach/campaigns";

type Stats = {
  totalLeads: number;
  pending: number;
  inSequence: number;
  replied: number;
  completed: number;
  bounced: number;
  suppressed: number;
  emailsSent: number;
  emailsScheduled: number;
  emailsFailed: number;
  emailsTotal: number;
  contacted: number;
};
type StepBreakdown = { stepNumber: number; sent: number }[];

/**
 * A send campaign's analytics, in the Analytics kit: headline numbers, where
 * every lead stands (a donut — the states are exclusive and sum to the
 * leads), daily send volume, and how many leads each step reached.
 *
 * Colour: sent wears the email channel colour, as on the Analytics Email
 * view; scheduled is the de-emphasis gray (it hasn't happened); failed is the
 * critical status colour, labelled. Lead states are ordered so adjacent
 * slices, and the ring's seam, pass the colour-blind check.
 */

const EMAIL = CHANNEL_META.email.color;

type SendKey = "sent" | "scheduled" | "failed";
const SEND_COLORS: Record<SendKey, string> = { sent: EMAIL, scheduled: MUTED, failed: STATUS.critical };

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];


export default function AnalyticsTab({ stats, stepBreakdown, dailySends }: { stats: Stats; stepBreakdown: StepBreakdown; dailySends: DailySends }) {
  const t = useTranslations("emailLeads.analytics");
  const fmt = useAnalyticsFormat();
  const formatCompact = fmt.compact;
  const formatPercent = fmt.percent;
  const pct = (part: number, whole: number, digits?: number): string | undefined => (whole > 0 ? formatPercent(part / whole, digits) : undefined);
  const SEND_KEYS: SeriesKeys<SendKey> = {
    sent: { label: t("sent"), color: SEND_COLORS.sent },
    scheduled: { label: t("scheduled"), color: SEND_COLORS.scheduled },
    failed: { label: t("failed"), color: SEND_COLORS.failed },
  };
  const [range, setRange] = useState<Range>(14);
  const blocked = stats.bounced + stats.suppressed;
  const progress = stats.emailsTotal > 0 ? stats.emailsSent / stats.emailsTotal : 0;

  const series = { keys: ["sent", "scheduled", "failed"] as const, points: dailySends.slice(-range) };
  const sendStats = (Object.keys(SEND_KEYS) as SendKey[]).map((k) => ({ label: SEND_KEYS[k].label, color: SEND_KEYS[k].color, value: formatCompact(seriesTotal(series, k)) }));

  const leadStates: DonutItem[] = [
    { key: "inSequence", label: t("stateInProgress"), value: stats.inSequence, color: "#e5930a", icon: RiLoader4Line },
    { key: "pending", label: t("stateYetToStart"), value: stats.pending, color: MUTED, icon: RiTimeLine },
    { key: "completed", label: t("stateCompleted"), value: stats.completed, color: STATUS.good, icon: RiCheckboxCircleLine },
    { key: "replied", label: t("stateReplied"), value: stats.replied, color: "#7d52f4", icon: RiReplyLine },
    { key: "blocked", label: t("stateBlocked"), value: blocked, color: STATUS.critical, icon: RiForbid2Line },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={6}>
        <KpiCell icon={RiTeamLine} label={t("kpiLeads")} value={formatCompact(stats.totalLeads)} context={t("kpiLeadsContext")} />
        <KpiCell icon={RiMailCheckLine} label={t("kpiContacted")} value={formatCompact(stats.contacted)} context={pct(stats.contacted, stats.totalLeads) ? t("ofLeads", { pct: pct(stats.contacted, stats.totalLeads)! }) : undefined} />
        <KpiCell icon={RiMailSendLine} label={t("kpiEmailsSent")} value={formatCompact(stats.emailsSent)} context={stats.emailsScheduled > 0 ? t("stillScheduled", { count: fmt.number(stats.emailsScheduled) }) : t("nothingScheduled")} />
        <KpiCell icon={RiReplyLine} label={t("kpiReplied")} value={formatCompact(stats.replied)} context={pct(stats.replied, stats.contacted, 2) ? t("ofContacted", { pct: pct(stats.replied, stats.contacted, 2)! }) : undefined} hint={t("repliedHint")} />
        <KpiCell icon={RiForbid2Line} label={t("kpiBounced")} value={formatCompact(stats.bounced)} context={pct(stats.bounced, stats.contacted, 1) ? t("ofContacted", { pct: pct(stats.bounced, stats.contacted, 1)! }) : undefined} />
        <KpiCell icon={RiErrorWarningLine} label={t("kpiFailedSends")} value={formatCompact(stats.emailsFailed)} context={stats.emailsFailed > 0 ? t("failedContext") : t("none")} />
      </KpiStrip>

      <Frame className="lg:col-span-5">
        <FrameHeader title={t("whereTitle")} description={t("whereDescription")} />
        <FramePanel>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-paragraph-sm text-text-sub-600">
              {t.rich("sendsDone", {
                pct: formatPercent(progress, 1),
                value: (chunks) => <span className="text-title-h5 font-semibold tracking-tight text-text-strong-950">{chunks}</span>,
              })}
            </p>
            <p className="text-paragraph-xs tabular-nums text-text-sub-600">
              {t("sendsOfTotal", { sent: fmt.number(stats.emailsSent), total: fmt.number(stats.emailsTotal) })}
            </p>
          </div>
          <div className="mb-5 mt-2 h-2 overflow-hidden rounded-full bg-bg-weak-50" role="progressbar" aria-label={t("sendsDoneLabel")} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%`, backgroundColor: EMAIL }} />
          </div>
          <DonutChart items={leadStates} centerLabel={t("donutCenter")} emptyLabel={t("donutEmptyLabel")} emptyDescription={t("donutEmptyDescription")} />
        </FramePanel>
      </Frame>

      <ChartCard
        className="lg:col-span-7"
        title={t("activityTitle")}
        description={t("activityDescription")}
        actions={
          <SegmentedControl.Root value={String(range)} onValueChange={(v) => setRange(Number(v) as Range)}>
            <SegmentedControl.List className="w-auto">
              {RANGES.map((r) => (
                <SegmentedControl.Trigger key={r} value={String(r)} className="px-3">{t("rangeDays", { days: r })}</SegmentedControl.Trigger>
              ))}
            </SegmentedControl.List>
          </SegmentedControl.Root>
        }
        legend={<SeriesStats items={sendStats} />}
        table={<TimeSeriesTable series={series} keys={SEND_KEYS} bucket="day" caption={t("sendsPerDay")} />}
      >
        <TimeSeriesChart series={series} keys={SEND_KEYS} type="stackedBar" bucket="day" />
      </ChartCard>

      <Frame className="lg:col-span-12">
        <FrameHeader title={t("stepsTitle")} description={t("stepsDescription")} />
        <FramePanel>
          {stepBreakdown.length === 0 ? (
            <EmptyChart height={140} title={t("nothingSent")} description={t("nothingSentDescription")} />
          ) : (
            <FunnelChart layout="tiles" stages={stepBreakdown.map((s) => ({ key: String(s.stepNumber), label: t("stepLabel", { step: s.stepNumber }), value: s.sent }))} />
          )}
        </FramePanel>
      </Frame>
    </div>
  );
}
