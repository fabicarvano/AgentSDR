"use client";

import Link from "next/link";
import { RiArrowRightSLine, RiChat3Line, RiChatNewLine, RiCheckLine, RiErrorWarningLine, RiLoader4Line, RiPhoneLine, RiPhoneFill, RiQuestionLine, RiTimeLine, RiUserReceived2Line, RiWhatsappLine, RiMessage2Line, RiPercentLine, RiVoiceprintLine } from "@remixicon/react";
import { useTranslations } from "next-intl";
import * as Table from "@/components/alignui/table";
import type { Messages } from "@/i18n/catalog";
import type { WhatsappAnalytics, WhatsappCallOutcome } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { CapacityMeter } from "../kit/CapacityMeter";
import { ChartCard } from "../kit/ChartCard";
import { DonutChart } from "../kit/DonutChart";
import { Frame, FrameFooterLink, FrameHeader, FramePanel } from "../kit/Frame";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { SectionHeading } from "../kit/SectionHeading";
import { SeriesStats } from "../kit/SeriesStats";
import { Sparkline } from "../kit/Sparkline";
import { StatusDotBadge } from "../kit/StatusDotBadge";
import { seriesTotal, TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "../kit/TimeSeriesChart";
import { CHANNEL_META, MUTED, STATUS } from "../theme";
import { useAnalyticsFormat } from "../useAnalyticsFormat";
import type { ViewProps } from "./types";

/**
 * WhatsApp: two areas. Calls (KPI strip, calls chart, outcomes, campaigns) and
 * Messages (KPI strip, sent vs received, numbers).
 *
 * Colours: Connected / Sent use the WhatsApp channel colour. Received is
 * violet (categorical slot 7), not a channel colour. Call outcomes other than
 * connected are states, so they wear status colours and always carry an icon
 * and a label.
 */

const WA = CHANNEL_META.whatsapp.color;
const RECEIVED = "#7d52f4";

type Icon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
/** Colour and icon per call outcome; the text is analytics.whatsapp.outcomes.<outcome> (the key is the outcome, so a new one fails tsc until translated). */
const OUTCOMES: Record<WhatsappCallOutcome, { color: string; icon: Icon }> = {
  connected: { color: WA, icon: RiCheckLine },
  didNotPickUp: { color: MUTED, icon: RiPhoneLine },
  notOnWhatsApp: { color: STATUS.warning, icon: RiQuestionLine },
  failed: { color: STATUS.critical, icon: RiErrorWarningLine },
  inProgress: { color: "var(--chart-muted-strong)", icon: RiLoader4Line },
};

/** Message under analytics.whatsapp.numbers.status for the account states the app stores; any other value shows humanised as stored. */
const ACCOUNT_STATUS_KEYS: Record<string, keyof Messages["analytics"]["whatsapp"]["numbers"]["status"]> = {
  connected: "connected",
  disconnected: "disconnected",
  credentials: "credentials",
  error: "error",
};

export function WhatsappView({ data, loading }: ViewProps<"whatsapp">) {
  const t = useTranslations("analytics.whatsapp");
  const tc = useTranslations("analytics.common");
  const fmt = useAnalyticsFormat();
  const { kpis, range } = data;
  const callKeys: SeriesKeys<"connected" | "notConnected"> = {
    connected: { label: t("callsChart.connected"), color: WA },
    notConnected: { label: t("callsChart.notConnected"), color: MUTED },
  };
  const messageKeys: SeriesKeys<"sent" | "received"> = {
    sent: { label: t("messagesChart.sent"), color: WA },
    received: { label: t("messagesChart.received"), color: RECEIVED },
  };
  const vsPrevious = (m: { previous: number | null }, format: (n: number) => string = fmt.compact) => (m.previous === null ? undefined : tc("vsPrevious", { value: format(m.previous) }));
  const placedSpark = data.calls.points.map((p) => p.connected + p.notConnected);
  const connectedSpark = data.calls.points.map((p) => p.connected);
  const totalCalls = kpis.calls.value;
  const nullable = (m: { value: number | null; previous: number | null }) => ({ value: m.value, previous: m.previous });

  const callStats = [
    { label: callKeys.connected.label, color: WA, value: fmt.compact(seriesTotal(data.calls, "connected")), metric: kpis.connected },
    { label: callKeys.notConnected.label, color: MUTED, value: fmt.compact(seriesTotal(data.calls, "notConnected")) },
  ];
  const messageStats = [
    { label: messageKeys.sent.label, color: WA, value: fmt.compact(kpis.messagesSent.value), metric: kpis.messagesSent },
    { label: messageKeys.received.label, color: RECEIVED, value: fmt.compact(kpis.messagesReceived.value), metric: kpis.messagesReceived },
  ];


  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <SectionHeading title={t("calls.title")} description={t("calls.description")} />
      <KpiStrip className="lg:col-span-12" columns={5}>
        <KpiCell icon={RiPhoneLine} label={t("kpi.calls")} value={fmt.compact(kpis.calls.value)} metric={kpis.calls} hint={t("hint.calls")} context={vsPrevious(kpis.calls)} spark={placedSpark} />
        <KpiCell icon={RiPhoneFill} label={t("kpi.connected")} value={fmt.compact(kpis.connected.value)} metric={kpis.connected} hint={t("hint.connected")} context={vsPrevious(kpis.connected)} spark={connectedSpark} />
        <KpiCell icon={RiPercentLine} label={t("kpi.connectRate")} value={fmt.percent(kpis.connectRate.value)} metric={nullable(kpis.connectRate)} hint={t("hint.connectRate")} context={t("ofCalls", { value: fmt.compact(totalCalls) })} />
        <KpiCell icon={RiTimeLine} label={t("kpi.talkTime")} value={fmt.duration(kpis.talkTimeMs.value)} metric={kpis.talkTimeMs} hint={t("hint.talk")} context={vsPrevious(kpis.talkTimeMs, fmt.duration)} />
        <KpiCell icon={RiVoiceprintLine} label={t("kpi.avgCall")} value={fmt.duration(kpis.avgCallMs.value)} metric={nullable(kpis.avgCallMs)} hint={t("hint.avg")} context={t("perConnectedCall")} />
      </KpiStrip>

      <ChartCard
        className="lg:col-span-8"
        title={t("callsChart.title")}
        description={t("callsChart.description", { bucket: range.bucket })}
        legend={<SeriesStats items={callStats} />}
        loading={loading}
        footer={t("callsChart.footer")}
        table={<TimeSeriesTable series={data.calls} keys={callKeys} bucket={range.bucket} caption={t("callsChart.caption")} />}
      >
        <TimeSeriesChart series={data.calls} keys={callKeys} type="stackedBar" bucket={range.bucket} />
      </ChartCard>

      <Frame className="lg:col-span-4 lg:self-start" aria-busy={loading || undefined}>
        <FrameHeader title={t("outcomes.title")} description={t("outcomes.description")} />
        <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
          <DonutChart items={data.outcomes.map((o) => ({ key: o.key, label: t(`outcomes.${o.key}`), value: o.value, color: OUTCOMES[o.key].color, icon: OUTCOMES[o.key].icon }))} centerLabel={t("outcomes.centerLabel")} emptyLabel={t("outcomes.emptyLabel")} />
        </FramePanel>
      </Frame>

      <CampaignsTable campaigns={data.campaigns} loading={loading} />

      <SectionHeading title={t("messages.title")} description={t("messages.description")} />
      <KpiStrip className="lg:col-span-12" columns={4}>
        <KpiCell icon={RiMessage2Line} label={t("kpi.messagesSent")} value={fmt.compact(kpis.messagesSent.value)} metric={kpis.messagesSent} hint={t("hint.sent")} context={vsPrevious(kpis.messagesSent)} spark={data.messages.points.map((p) => p.sent)} />
        <KpiCell icon={RiUserReceived2Line} label={t("kpi.messagesReceived")} value={fmt.compact(kpis.messagesReceived.value)} metric={kpis.messagesReceived} hint={t("hint.received")} context={vsPrevious(kpis.messagesReceived)} spark={data.messages.points.map((p) => p.received)} />
        <KpiCell icon={RiChat3Line} label={t("kpi.chatReplyRate")} value={fmt.percent(kpis.chatReplyRate.value)} metric={nullable(kpis.chatReplyRate)} hint={t("hint.replyRate")} context={t("ofChats")} />
        <KpiCell icon={RiChatNewLine} label={t("kpi.newChats")} value={fmt.compact(kpis.newChats.value)} metric={kpis.newChats} hint={t("hint.newChats")} context={vsPrevious(kpis.newChats)} />
      </KpiStrip>

      <ChartCard
        className="lg:col-span-8"
        title={t("messagesChart.title")}
        description={t("messagesChart.description", { bucket: range.bucket })}
        legend={<SeriesStats items={messageStats} />}
        loading={loading}
        table={<TimeSeriesTable series={data.messages} keys={messageKeys} bucket={range.bucket} caption={t("messagesChart.caption")} />}
      >
        <TimeSeriesChart series={data.messages} keys={messageKeys} type="line" bucket={range.bucket} />
      </ChartCard>

      <NumbersFrame accounts={data.accounts} tz={range.tz} loading={loading} />
    </div>
  );
}

function CampaignsTable({ campaigns, loading }: { campaigns: WhatsappAnalytics["campaigns"]; loading: boolean }) {
  const t = useTranslations("analytics.whatsapp.campaigns");
  const tc = useTranslations("analytics.common");
  const fmt = useAnalyticsFormat();
  const maxRate = Math.max(...campaigns.map((c) => c.connectRate ?? 0), 0.0001);
  return (
    <Frame className="lg:col-span-12" aria-busy={loading || undefined}>
      <FrameHeader title={t("title")} description={t("description")} />
      <FramePanel className={cn("p-2 transition-opacity sm:p-3", loading && "opacity-60")}>
        {campaigns.length === 0 ? (
          <p className="px-4 py-8 text-center text-paragraph-sm text-text-sub-600">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table.Root>
              <Table.Caption className="sr-only">{t("caption")}</Table.Caption>
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col">{tc("campaign")}</Table.Head>
                  <Table.Head scope="col" className="text-right">{tc("leads")}</Table.Head>
                  <Table.Head scope="col" className="text-right">{t("calls")}</Table.Head>
                  <Table.Head scope="col"><span className="sr-only">{t("trend")}</span></Table.Head>
                  <Table.Head scope="col" className="text-right">{t("connected")}</Table.Head>
                  <Table.Head scope="col">{t("connectRate")}</Table.Head>
                  <Table.Head scope="col" className="text-right">{t("dueToday")}</Table.Head>
                  <Table.Head scope="col" className="w-8"><span className="sr-only">{tc("open")}</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {campaigns.map((c) => (
                  <Table.Row key={c.id}>
                    <Table.Cell className="h-12">
                      <Link href={`/calling/campaigns/${c.id}`} className="block max-w-64 truncate rounded-md text-label-sm text-text-strong-950 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-base">{c.name}</Link>
                    </Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{fmt.compact(c.leads)}</Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{fmt.compact(c.calls)}</Table.Cell>
                    <Table.Cell className="h-12">
                      <Sparkline data={c.trend} color={WA} className="h-7 w-20" height={28} />
                    </Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{fmt.compact(c.connected)}</Table.Cell>
                    <Table.Cell className="h-12">
                      <div className="flex items-center gap-3">
                        <span className="w-12 text-paragraph-sm tabular-nums text-text-strong-950">{fmt.percent(c.connectRate)}</span>
                        <span aria-hidden="true" className="h-1.5 w-24 rounded-full bg-bg-weak-50">
                          <span className="block h-full rounded-full" style={{ width: `${((c.connectRate ?? 0) / maxRate) * 100}%`, backgroundColor: WA }} />
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{fmt.compact(c.dueToday)}</Table.Cell>
                    <Table.Cell className="h-12 w-8 text-text-soft-400"><RiArrowRightSLine className="size-4" aria-hidden="true" /></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </div>
        )}
      </FramePanel>
    </Frame>
  );
}

function warmUpLabel(iso: string, tz: string, locale: string): string {
  try {
    // Day, month and time in the number's own time zone, in the interface language's order and clock (12 h in English, 24 h in pt-BR).
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
  }
}

function NumbersFrame({ accounts, tz, loading }: { accounts: WhatsappAnalytics["accounts"]; tz: string; loading: boolean }) {
  const t = useTranslations("analytics.whatsapp.numbers");
  const fmt = useAnalyticsFormat();
  const statusLabel = (status: string) => {
    const key = ACCOUNT_STATUS_KEYS[status];
    // A state this list does not know yet shows humanised as stored ("needs_login" -> "Needs login"), not guessed.
    return key ? t(`status.${key}`) : status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  };
  return (
    <Frame className="lg:col-span-4 lg:self-start" aria-busy={loading || undefined}>
      <FrameHeader title={t("title")} description={t("description")} />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
            <RiWhatsappLine className="size-6 text-text-soft-400" aria-hidden="true" />
            <p className="mt-2 text-label-sm text-text-strong-950">{t("emptyTitle")}</p>
            <p className="mt-0.5 text-paragraph-xs text-text-sub-600">{t("emptyDescription")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-stroke-soft-200">
            {accounts.map((a) => {
              const connected = a.status === "connected";
              return (
                <li key={a.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-label-sm text-text-strong-950">{a.name}</p>
                      {a.phone && a.phone.replace(/\D/g, "") !== a.name.replace(/\D/g, "") && <p className="truncate text-paragraph-xs text-text-sub-600">{a.phone}</p>}
                    </div>
                    <StatusDotBadge status={connected ? "good" : "critical"}>{statusLabel(a.status)}</StatusDotBadge>
                  </div>
                  <CapacityMeter label={t("newChats")} used={a.newChats24h} limit={a.newChatLimit} segments={12} />
                  {a.warmingUpUntil && (
                    <p className="flex items-center gap-1.5 text-paragraph-xs text-text-sub-600">
                      <RiTimeLine className="size-3.5 shrink-0" aria-hidden="true" style={{ color: STATUS.warning }} />
                      {t("warmingUp", { time: warmUpLabel(a.warmingUpUntil, tz, fmt.locale) })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </FramePanel>
      <FrameFooterLink href="/settings/whatsapp-accounts">{t("manage")}</FrameFooterLink>
    </Frame>
  );
}
