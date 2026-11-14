"use client";

import { RiCheckDoubleLine, RiDraftLine } from "@remixicon/react";
import { useTranslations } from "next-intl";
import type { Messages } from "@/i18n/catalog";
import type { CrmCategory, CrmSummary } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { BarList, type BarListItem } from "../kit/BarList";
import { ChartCard } from "../kit/ChartCard";
import { DeltaPill } from "../kit/DeltaPill";
import { DonutChart, type DonutItem } from "../kit/DonutChart";
import { EmptyChart } from "../kit/EmptyChart";
import { Frame, FrameHeader, FramePanel } from "../kit/Frame";
import { SegmentedBar, type SegmentItem } from "../kit/SegmentedBar";
import { SeriesStats } from "../kit/SeriesStats";
import { seriesTotal, TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "../kit/TimeSeriesChart";
import { MUTED, ORDINAL_BLUE, ordinalRamp } from "../theme";
import { useAnalyticsFormat } from "../useAnalyticsFormat";

/**
 * The CRM cards of the Overview: replies by sentiment, the pipeline shape,
 * stage moves, the AI assistant and workflow states.
 *
 * Colour: CRM categories carry one fixed identity colour everywhere — the
 * sentiment chart, the pipeline and stage-move donuts, the top-stage bars —
 * (categorical slots 6, 7, 8, 4 and gray), none of them a channel colour.
 * Funnel stages use the ordinal blue ramp by stage rank.
 */

/** The category's message under analytics.crm.category. The stored value (`not_interested`) never changes; only the text is translated. */
const CATEGORY_KEY: Record<CrmCategory, keyof Messages["analytics"]["crm"]["category"]> = {
  interested: "interested",
  customer: "customer",
  not_interested: "notInterested",
  other: "other",
  unclassified: "unclassified",
};
const CATEGORY_COLOR: Record<CrmCategory, string> = {
  interested: "#1daf9c",
  customer: "#7d52f4",
  not_interested: "#fb3748",
  other: "#e5930a",
  unclassified: MUTED,
};

/** Category order for every CRM donut: validated adjacent-pair palette, gray last. */
const CATEGORY_ORDER: CrmCategory[] = ["interested", "customer", "not_interested", "other", "unclassified"];

function useCategoryLabel(): (category: CrmCategory) => string {
  const t = useTranslations("analytics.crm.category");
  return (category) => t(CATEGORY_KEY[category]);
}

function useSentimentKeys(): SeriesKeys<CrmCategory> {
  const label = useCategoryLabel();
  return Object.fromEntries(CATEGORY_ORDER.map((k) => [k, { label: label(k), color: CATEGORY_COLOR[k] }])) as SeriesKeys<CrmCategory>;
}

type CardProps<K extends keyof CrmSummary> = { value: CrmSummary[K]; loading: boolean; className?: string };

export function SentimentCard({ series, bucket, loading, className }: { series: CrmSummary["repliesByCategory"]; bucket: "day" | "week"; loading: boolean; className?: string }) {
  const t = useTranslations("analytics.crm.sentiment");
  const fmt = useAnalyticsFormat();
  const keys = useSentimentKeys();
  const stats = CATEGORY_ORDER.map((k) => ({ label: keys[k].label, color: keys[k].color, value: fmt.compact(seriesTotal(series, k)) }));
  return (
    <ChartCard
      className={className}
      title={t("title")}
      description={t("description", { bucket })}
      legend={<SeriesStats items={stats} />}
      loading={loading}
      table={<TimeSeriesTable series={series} keys={keys} bucket={bucket} caption={t("title")} />}
    >
      <TimeSeriesChart series={series} keys={keys} type="stackedBar" bucket={bucket} />
    </ChartCard>
  );
}

function byCategory(rows: Array<{ categoryKey: CrmCategory; value: number }>, label: (category: CrmCategory) => string): DonutItem[] {
  const totals = new Map<CrmCategory, number>();
  for (const r of rows) totals.set(r.categoryKey, (totals.get(r.categoryKey) ?? 0) + r.value);
  return CATEGORY_ORDER.map((k) => ({ key: k, label: label(k), value: totals.get(k) ?? 0, color: CATEGORY_COLOR[k] }));
}

/** A small uppercase label between a card's donut and its list. */
function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 mt-5 border-t border-stroke-soft-200 pt-4 text-subheading-2xs uppercase text-text-soft-400">{children}</h3>;
}

export function PipelineCard({ value: pipeline, loading, className }: CardProps<"pipeline">) {
  const t = useTranslations("analytics.crm.pipeline");
  const categoryLabel = useCategoryLabel();
  const ranked = pipeline.filter((p) => p.stageRank !== null);
  const ramp = ordinalRamp(Math.max(ranked.length, 1));
  const stages: BarListItem[] = ranked.map((p, i) => ({ key: `r-${p.subcategoryId ?? i}`, label: `${p.name} · ${categoryLabel(p.categoryKey)}`, value: p.count, color: ramp[i] }));
  return (
    <Frame className={className} aria-busy={loading || undefined}>
      <FrameHeader title={t("title")} description={t("description")} />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        <DonutChart items={byCategory(pipeline.map((p) => ({ categoryKey: p.categoryKey, value: p.count })), categoryLabel)} centerLabel={t("centerLabel")} emptyLabel={t("emptyLabel")} emptyDescription={t("emptyDescription")} />
        {stages.length > 0 && (
          <>
            <SubHeading>{t("stages")}</SubHeading>
            <BarList items={stages} />
          </>
        )}
      </FramePanel>
    </Frame>
  );
}

export function StageMovesCard({ value: entries, loading, className }: CardProps<"stageEntries">) {
  const t = useTranslations("analytics.crm.stageMoves");
  const categoryLabel = useCategoryLabel();
  const moved = entries.filter((e) => e.entered > 0);
  const top: BarListItem[] = [...moved]
    .sort((a, b) => b.entered - a.entered)
    .slice(0, 5)
    .map((e) => ({ key: e.subcategoryId, label: `${e.name} · ${categoryLabel(e.categoryKey)}`, value: e.entered, color: CATEGORY_COLOR[e.categoryKey] }));
  return (
    <Frame className={className} aria-busy={loading || undefined}>
      <FrameHeader title={t("title")} description={t("description")} />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        <DonutChart items={byCategory(moved.map((e) => ({ categoryKey: e.categoryKey, value: e.entered })), categoryLabel)} centerLabel={t("centerLabel")} emptyLabel={t("emptyLabel")} />
        {top.length > 0 && (
          <>
            <SubHeading>{t("top")}</SubHeading>
            <BarList items={top} />
          </>
        )}
      </FramePanel>
    </Frame>
  );
}

/**
 * Workflow states in a fixed order with fixed colours: adjacent pairs pass the
 * CVD check (pink sits beside amber, never beside teal, which it can't be told
 * apart from with deuteranopia).
 * Idle and the not-yet-classified states are neutral grays.
 * The key is the stored workflow state; `labelKey` is its message under analytics.crm.workflow.state.
 */
const WORKFLOW_META: Record<string, { labelKey: keyof Messages["analytics"]["crm"]["workflow"]["state"]; color: string }> = {
  paused: { labelKey: "paused", color: "#fb4ba3" },
  action_required: { labelKey: "actionRequired", color: "#e5930a" },
  error: { labelKey: "error", color: "#fb3748" },
  waiting: { labelKey: "waiting", color: "#7d52f4" },
  closed: { labelKey: "closed", color: "#1daf9c" },
  unclassified: { labelKey: "unclassified", color: "var(--chart-muted-strong)" },
  classifying: { labelKey: "classifying", color: "var(--chart-muted-strong)" },
  idle: { labelKey: "idle", color: MUTED },
};

export function WorkflowCard({ value: workflow, loading, className }: CardProps<"workflow">) {
  const t = useTranslations("analytics.crm.workflow");
  const order = Object.keys(WORKFLOW_META);
  const items: DonutItem[] = [...workflow]
    .sort((a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99))
    // `w.label` is the server's English title-cased state: it only shows for a state this list does not know yet.
    .map((w) => ({ key: w.key, label: WORKFLOW_META[w.key] ? t(`state.${WORKFLOW_META[w.key].labelKey}`) : w.label, value: w.value, color: WORKFLOW_META[w.key]?.color ?? MUTED }));
  return (
    <Frame className={className} aria-busy={loading || undefined}>
      <FrameHeader title={t("title")} description={t("description")} />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        <DonutChart items={items} centerLabel={t("centerLabel")} emptyLabel={t("emptyLabel")} emptyDescription={t("emptyDescription")} />
      </FramePanel>
    </Frame>
  );
}

/** One figure in the AI card's stat row. */
function AiStat({ label, value, metric, upIsGood, note }: { label: string; value: string; metric?: { value: number | null; previous: number | null }; upIsGood?: boolean; note: string }) {
  return (
    <div className="min-w-0 bg-bg-white-0 px-4 py-3 first:pl-0 last:pr-0">
      <p className="truncate text-paragraph-xs text-text-sub-600">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-title-h6 font-semibold leading-none tracking-tight text-text-strong-950">{value}</p>
        {metric && <DeltaPill metric={metric} upIsGood={upIsGood} />}
      </div>
      <p className="mt-1.5 truncate text-paragraph-xs text-text-soft-400">{note}</p>
    </div>
  );
}

/** Drafts and classification: how much of the AI's work goes out as written. */
export function AiAssistantCard({ crm, loading, className }: { crm: CrmSummary; loading: boolean; className?: string }) {
  const t = useTranslations("analytics.crm.ai");
  const fmt = useAnalyticsFormat();
  const { drafts, kpis } = crm;
  const sent = drafts.sentAsIs + drafts.sentEdited;
  const items: SegmentItem[] = [
    { key: "asIs", label: t("sentAsIs"), value: drafts.sentAsIs, color: ORDINAL_BLUE[5] },
    { key: "edited", label: t("sentEdited"), value: drafts.sentEdited, color: ORDINAL_BLUE[0] },
    { key: "discarded", label: t("discarded"), value: drafts.discarded, color: MUTED },
  ];
  const empty = items.every((i) => i.value === 0);
  return (
    <Frame className={className} aria-busy={loading || undefined}>
      <FrameHeader
        title={t("title")}
        description={t("description", { count: drafts.generated })}
        actions={
          drafts.awaitingReview > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-bg-white-0 px-2 py-1 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">
              <RiDraftLine className="size-3.5" aria-hidden="true" />
              {t("awaitingReview", { count: drafts.awaitingReview })}
            </span>
          ) : undefined
        }
      />
      <FramePanel className={cn("grid gap-4 transition-opacity lg:grid-cols-2 lg:gap-8", loading && "opacity-60")}>
        <div className="grid grid-cols-3 gap-px self-start bg-stroke-soft-200">
          <AiStat label={t("draftsSent")} value={fmt.compact(kpis.draftsSent.value)} metric={kpis.draftsSent} note={t("draftsSentNote")} />
          <AiStat label={t("classified")} value={fmt.compact(kpis.classified.value)} metric={kpis.classified} note={t("classifiedNote")} />
          <AiStat label={t("overrideRate")} value={fmt.percent(kpis.overrideRate.value)} metric={kpis.overrideRate} upIsGood={false} note={t("overrideRateNote")} />
        </div>
        <div className="border-t border-stroke-soft-200 pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          {empty ? (
            <EmptyChart height={120} title={t("emptyTitle")} description={t("emptyDescription")} />
          ) : (
            <div>
              {sent > 0 && (
                <p className="mb-4 flex items-center gap-2 text-paragraph-sm text-text-strong-950">
                  <RiCheckDoubleLine className="size-4 shrink-0 text-text-sub-600" aria-hidden="true" />
                  <span>
                    {t.rich("unedited", {
                      percent: fmt.percent(drafts.sentAsIs / sent),
                      asIs: drafts.sentAsIs,
                      sent,
                      strong: (chunks) => <span className="text-label-sm">{chunks}</span>,
                      muted: (chunks) => <span className="text-text-sub-600">{chunks}</span>,
                    })}
                  </span>
                </p>
              )}
              <SegmentedBar items={items} />
            </div>
          )}
        </div>
      </FramePanel>
    </Frame>
  );
}
