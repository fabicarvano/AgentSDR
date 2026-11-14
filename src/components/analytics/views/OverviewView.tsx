"use client";

import {
  RiAlarmWarningLine,
  RiArrowRightSLine,
  RiCalendarEventLine,
  RiCheckboxCircleLine,
  RiDraftLine,
  RiInboxLine,
  RiLinkedinBoxLine,
  RiMailForbidLine,
  RiReplyLine,
  RiThumbUpLine,
  RiTimerLine,
  RiTrophyLine,
  RiWhatsappLine,
} from "@remixicon/react";
import { useTranslations } from "next-intl";
import * as Table from "@/components/alignui/table";
import type { AnalyticsView, OverviewAnalytics } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { ChartCard } from "../kit/ChartCard";
import { Frame, FrameHeader, FramePanel } from "../kit/Frame";
import { FunnelChart } from "../kit/FunnelChart";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { ProgressList, type ProgressTone } from "../kit/ProgressList";
import { SectionHeading } from "../kit/SectionHeading";
import { CHANNEL_META } from "../theme";
import { useAnalyticsFormat } from "../useAnalyticsFormat";
import { AiAssistantCard, PipelineCard, SentimentCard, StageMovesCard, WorkflowCard } from "./CrmCards";
import type { ViewProps } from "./types";

/**
 * Overview, CRM first: conversation KPIs, replies by sentiment, what needs
 * attention, the pipeline and stage moves, the AI assistant and workflow.
 * Then, smaller, the outreach that fed it: a channel table and the period
 * funnel from first touch to customer.
 */

export function OverviewView({ data, loading, onSelectView }: ViewProps<"overview">) {
  const t = useTranslations("analytics.overview");
  const tc = useTranslations("analytics.common");
  const fmt = useAnalyticsFormat();
  const { kpis, range, crm } = data;
  const vsPrevious = (m: { previous: number | null }) => (m.previous === null ? undefined : tc("vsPrevious", { value: fmt.compact(m.previous) }));
  const replySpark = crm.repliesByCategory.points.map((p) => crm.repliesByCategory.keys.reduce((sum, k) => sum + p[k], 0));
  const response = crm.kpis.medianFirstResponseMinutes;
  // Stage names come from the catalog by key (the server's `label` is English); FunnelStageKey is a closed union, so a new stage fails tsc here until it is translated.
  const funnel = data.funnel.map((stage) => ({ ...stage, label: t(`funnelStage.${stage.key}`) }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={5}>
        <KpiCell icon={RiReplyLine} label={t("kpi.replies")} value={fmt.compact(crm.kpis.replies.value)} metric={crm.kpis.replies} hint={t("hint.replies")} context={t("fromPeople", { value: fmt.compact(kpis.replied.value), count: kpis.replied.value })} spark={replySpark} />
        <KpiCell icon={RiThumbUpLine} label={t("kpi.positive")} value={fmt.compact(kpis.positive.value)} metric={kpis.positive} hint={t("hint.positive")} context={kpis.replied.value > 0 ? t("positiveShare", { value: fmt.percent(kpis.positive.value / kpis.replied.value) }) : vsPrevious(kpis.positive)} />
        <KpiCell icon={RiCalendarEventLine} label={t("kpi.meetings")} value={fmt.compact(kpis.meetings.value)} metric={kpis.meetings} hint={t("hint.meetings")} context={vsPrevious(kpis.meetings)} />
        <KpiCell icon={RiTrophyLine} label={t("kpi.customers")} value={fmt.compact(kpis.customers.value)} metric={kpis.customers} hint={t("hint.customers")} context={vsPrevious(kpis.customers)} />
        <KpiCell icon={RiTimerLine} label={t("kpi.medianResponse")} value={fmt.minutes(response.value)} metric={response} upIsGood={false} hint={t("hint.response")} context={response.previous === null ? undefined : tc("vsPrevious", { value: fmt.minutes(response.previous) })} />
      </KpiStrip>

      <SentimentCard className="lg:col-span-8" series={crm.repliesByCategory} bucket={range.bucket} loading={loading} />
      <AttentionCard attention={data.attention} loading={loading} />

      <PipelineCard className="lg:col-span-6 lg:self-start" value={crm.pipeline} loading={loading} />
      {/* Pipeline runs long; the two shorter cards stack beside it. */}
      <div className="flex flex-col gap-4 lg:col-span-6 lg:gap-5">
        <StageMovesCard value={crm.stageEntries} loading={loading} />
        <WorkflowCard value={crm.workflow} loading={loading} />
      </div>

      <AiAssistantCard className="lg:col-span-12" crm={crm} loading={loading} />

      <SectionHeading className="mt-2 lg:col-span-12" title={t("outreach.title")} description={t("outreach.description")} />
      <ChannelTable data={data} loading={loading} onSelectView={onSelectView} />
      <ChartCard className="lg:col-span-4" title={t("funnel.title")} description={t("funnel.description")} loading={loading} footer={t("funnel.footer")}>
        <FunnelChart stages={funnel} />
      </ChartCard>
    </div>
  );
}

function ChannelTable({ data, loading, onSelectView }: { data: OverviewAnalytics; loading: boolean; onSelectView?: (view: AnalyticsView) => void }) {
  const t = useTranslations("analytics.overview.channels");
  const tc = useTranslations("analytics.common");
  const tl = useTranslations("analytics.channels");
  const fmt = useAnalyticsFormat();
  const maxRate = Math.max(...data.channels.map((c) => c.replyRate ?? 0), 0.0001);
  return (
    <Frame className="lg:col-span-8">
      <FrameHeader title={t("title")} description={t("description")} />
      <FramePanel className={cn("p-2 transition-opacity sm:p-3", loading && "opacity-60")}>
      <Table.Root>
        <Table.Caption className="sr-only">{t("caption")}</Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head scope="col">{t("channel")}</Table.Head>
            <Table.Head scope="col" className="text-right">{t("reached")}</Table.Head>
            <Table.Head scope="col" className="text-right">{tc("replied")}</Table.Head>
            <Table.Head scope="col">{tc("replyRate")}</Table.Head>
            <Table.Head scope="col" className="text-right">{t("positive")}</Table.Head>
            <Table.Head scope="col" className="w-8"><span className="sr-only">{tc("open")}</span></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body spacing={4}>
          {data.channels.map((row) => {
            const meta = CHANNEL_META[row.channel];
            const Icon = meta.icon;
            return (
              <Table.Row key={row.channel} className="cursor-pointer" onClick={() => onSelectView?.(row.channel)}>
                <Table.Cell className="h-12">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onSelectView?.(row.channel); }} className="flex items-center gap-2.5 rounded-md text-label-sm text-text-strong-950 outline-none focus-visible:ring-2 focus-visible:ring-primary-base">
                    <span className="flex size-6 items-center justify-center rounded-md" style={{ backgroundColor: meta.color }}>
                      <Icon className="size-4 text-white" />
                    </span>
                    {tl(row.channel)}
                  </button>
                </Table.Cell>
                <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{fmt.compact(row.reached)}</Table.Cell>
                <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{fmt.compact(row.replied)}</Table.Cell>
                <Table.Cell className="h-12">
                  <div className="flex items-center gap-3">
                    <span className="w-12 text-paragraph-sm tabular-nums text-text-strong-950">{fmt.percent(row.replyRate)}</span>
                    <span aria-hidden="true" className="h-1.5 w-24 rounded-full bg-bg-weak-50">
                      <span className="block h-full rounded-full" style={{ width: `${((row.replyRate ?? 0) / maxRate) * 100}%`, backgroundColor: meta.color }} />
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{fmt.compact(row.positive)}</Table.Cell>
                <Table.Cell className="h-12 w-8 text-text-soft-400"><RiArrowRightSLine className="size-4" aria-hidden="true" /></Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
      </FramePanel>
    </Frame>
  );
}

/** `key` is also the catalog key: the label and hint live under analytics.overview.attention.items.<key>. */
type AttentionItem = { key: keyof OverviewAnalytics["attention"]; href: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; tone: ProgressTone };

const ATTENTION: AttentionItem[] = [
  { key: "actionRequired", href: "/crm/actions", icon: RiInboxLine, tone: "serious" },
  { key: "overdue", href: "/crm/actions", icon: RiAlarmWarningLine, tone: "critical" },
  { key: "draftsAwaitingReview", href: "/crm/actions", icon: RiDraftLine, tone: "warning" },
  { key: "mailboxesFailing", href: "/settings/email-accounts", icon: RiMailForbidLine, tone: "critical" },
  { key: "linkedinDisconnected", href: "/settings/linkedin-accounts", icon: RiLinkedinBoxLine, tone: "critical" },
  { key: "whatsappDisconnected", href: "/settings/whatsapp-accounts", icon: RiWhatsappLine, tone: "critical" },
];

function AttentionCard({ attention, loading }: { attention: OverviewAnalytics["attention"]; loading: boolean }) {
  const t = useTranslations("analytics.overview.attention");
  const tc = useTranslations("analytics.common");
  const anyOpen = ATTENTION.some((item) => attention[item.key] > 0);
  return (
    <Frame className="lg:col-span-4">
      <FrameHeader title={t("title")} description={tc("regardlessOfRange")} />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        {anyOpen ? (
          <ProgressList
            items={ATTENTION.map((item) => ({
              key: item.key,
              label: t(`items.${item.key}.label`),
              value: attention[item.key],
              subline: t(`items.${item.key}.hint`),
              tone: attention[item.key] > 0 ? item.tone : "neutral",
              icon: attention[item.key] > 0 ? item.icon : undefined,
              href: item.href,
            }))}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <RiCheckboxCircleLine className="size-6 text-success-base" aria-hidden="true" />
            <p className="mt-2 text-label-sm text-text-strong-950">{t("allClear")}</p>
            <p className="mt-0.5 text-paragraph-xs text-text-sub-600">{t("allClearDescription")}</p>
          </div>
        )}
      </FramePanel>
    </Frame>
  );
}
