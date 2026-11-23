"use client";

import {
  RiCheckboxCircleLine,
  RiChat1Line,
  RiErrorWarningLine,
  RiLoader4Line,
  RiMailSendLine,
  RiReplyLine,
  RiSendPlaneLine,
  RiStopCircleLine,
  RiTeamLine,
  RiTimeLine,
} from "@remixicon/react";
import { useTranslations } from "next-intl";
import { BarList, type BarListItem } from "@/components/analytics/kit/BarList";
import { DonutChart, type DonutItem } from "@/components/analytics/kit/DonutChart";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { FunnelChart } from "@/components/analytics/kit/FunnelChart";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { CHANNEL_META, HUE, MUTED, STATUS } from "@/components/analytics/theme";
import { useAnalyticsFormat } from "@/components/analytics/useAnalyticsFormat";
import type { WhatsappCampaignDetail } from "@/lib/whatsapp/campaigns/contract";
import type { CampaignFunnel } from "./metrics";

/**
 * A message campaign's Overview: headline numbers, the leads -> messaged ->
 * replied funnel, where every lead stands now (a donut: the states are
 * exclusive and sum to the leads) and how many messages each step has sent.
 * Messages wear the WhatsApp channel green, as on Analytics.
 */
const WHATSAPP = CHANNEL_META.whatsapp.color;

export function WhatsappCampaignOverview({ funnel: f, campaign }: { funnel: CampaignFunnel; campaign: WhatsappCampaignDetail }) {
  const t = useTranslations("whatsappCampaigns.overview");
  const fmt = useAnalyticsFormat();
  const formatCompact = fmt.compact;
  const formatPercent = fmt.percent;
  const pct = (part: number, whole: number): string | undefined => (whole > 0 ? formatPercent(part / whole) : undefined);
  const leadStates: DonutItem[] = [
    { key: "queued", label: t("stateQueued"), value: f.queued, color: MUTED, icon: RiTimeLine },
    { key: "in_sequence", label: t("stateInSequence"), value: f.inSequence, color: HUE.amber, icon: RiLoader4Line },
    { key: "completed", label: t("stateCompleted"), value: f.completed, color: HUE.teal, icon: RiCheckboxCircleLine },
    { key: "replied", label: t("stateReplied"), value: f.replied, color: WHATSAPP, icon: RiReplyLine },
    { key: "stopped", label: t("stateStopped"), value: f.stopped, color: HUE.orange, icon: RiStopCircleLine },
    { key: "failed", label: t("stateFailed"), value: f.failed, color: STATUS.critical, icon: RiErrorWarningLine },
  ];

  const perStep: BarListItem[] = campaign.steps.map((step, i) => ({
    key: step.id,
    label: i === 0 ? t("firstMessage") : t("followUp", { number: i }),
    value: campaign.sentByStep[step.id] ?? 0,
    color: WHATSAPP,
  }));
  const anySent = perStep.some((item) => item.value > 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={5}>
        <KpiCell icon={RiTeamLine} label={t("kpiLeads")} value={formatCompact(f.total)} context={f.queued > 0 ? t("kpiLeadsNotMessaged", { count: formatCompact(f.queued) }) : f.total > 0 ? t("kpiLeadsAllMessaged") : undefined} />
        <KpiCell icon={RiSendPlaneLine} label={t("kpiMessaged")} value={formatCompact(f.messaged)} context={pct(f.messaged, f.total) ? t("kpiMessagedOfLeads", { percent: pct(f.messaged, f.total)! }) : undefined} hint={t("kpiMessagedHint")} />
        <KpiCell icon={RiChat1Line} label={t("kpiReplied")} value={formatCompact(f.replied)} context={f.replyRate !== null ? t("kpiRepliedOfMessaged", { percent: formatPercent(f.replyRate) }) : undefined} hint={t("kpiRepliedHint")} />
        <KpiCell icon={RiMailSendLine} label={t("kpiSent")} value={formatCompact(f.messagesSent)} context={t("kpiSentContext", { count: campaign.stepCount })} hint={t("kpiSentHint")} />
        <KpiCell icon={RiErrorWarningLine} label={t("kpiFailed")} value={formatCompact(f.failed)} context={f.stopped > 0 ? t("kpiFailedStopped", { count: formatCompact(f.stopped) }) : f.failed > 0 ? t("kpiFailedRefused") : t("kpiFailedNone")} hint={t("kpiFailedHint")} />
      </KpiStrip>

      <Frame className="self-start lg:col-span-5">
        <FrameHeader title={t("funnelTitle")} description={t("funnelDescription")} />
        <FramePanel>
          <FunnelChart
            stages={[
              { key: "leads", label: t("stageLeads"), value: f.total },
              { key: "messaged", label: t("stageMessaged"), value: f.messaged },
              { key: "replied", label: t("stageReplied"), value: f.replied },
            ]}
          />
        </FramePanel>
        <FrameFooter>{t("funnelFooter")}</FrameFooter>
      </Frame>

      <Frame className="lg:col-span-7">
        <FrameHeader title={t("standTitle")} description={t("standDescription")} />
        <FramePanel>
          <DonutChart items={leadStates} centerLabel={t("donutCenter")} emptyLabel={t("donutEmpty")} emptyDescription={t("donutEmptyDescription")} />
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-12">
        <FrameHeader title={t("byStepTitle")} description={t("byStepDescription")} />
        <FramePanel>
          <BarList items={anySent ? perStep : []} emptyLabel={t("byStepEmpty")} />
        </FramePanel>
      </Frame>
    </div>
  );
}
