"use client";

import { Fragment, useState, useEffect, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { Messages } from "@/i18n/catalog";
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiHistoryLine,
  RiLoader4Line,
  RiPlayLine,
  RiRefreshLine,
} from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Table from "@/components/alignui/table";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { StatusDotBadge } from "@/components/analytics/kit/StatusDotBadge";
import { useCrmText } from "@/components/crm/useCrmText";
import { EmptyState } from "@/components/page/EmptyState";
import { cn } from "@/lib/linkedin/utils";

// Intl format options, not interface text.
const CLOCK_FORMAT = { hour: "2-digit", minute: "2-digit", second: "2-digit" } as const;

type JobLog = {
  id: string;
  level: string;
  message: string;
  createdAt: string | Date;
};

type JobRun = {
  id: string;
  job: string;
  status: string;
  startedAt: string | Date;
  finishedAt: string | Date | null;
  error: string | null;
  logCount: number;
  warnCount: number;
  errorCount: number;
};

// Job ids stay as stored; only the three known ones get a translated label (anything else is shown raw).
type JobKey = keyof Messages["linkedinMain"]["jobsClient"]["jobs"];
const JOB_LABEL_KEYS: Record<string, JobKey> = {
  "run-outreach": "runOutreach",
  "reset-daily-limits": "resetDailyLimits",
  "run-search-queue": "runSearchQueue",
};

const LEVEL_TEXT: Record<string, string> = {
  info: "text-text-strong-950",
  warn: "text-warning-base",
  error: "text-error-base",
};

const LEVEL_TAG: Record<string, string> = { info: "INF", warn: "WRN", error: "ERR" };

function duration(start: string | Date, end: string | Date | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  // Units are compact symbols (ms, s, m): the same in both languages.
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function StatusBadge({ status }: { status: string }) {
  const tStatus = useTranslations("linkedinMain.jobsClient.status");
  if (status === "SUCCESS") return <StatusDotBadge status="good">{tStatus("success")}</StatusDotBadge>;
  if (status === "FAILED") return <StatusDotBadge status="critical">{tStatus("failed")}</StatusDotBadge>;
  return <StatusDotBadge status="info">{tStatus("running")}</StatusDotBadge>;
}

const COLUMNS = 6;

function RunRows({ run }: { run: JobRun }) {
  const t = useTranslations("linkedinMain.jobsClient");
  const format = useFormatter();
  const { timeAgo: ago } = useCrmText();
  const fmt = (d: string | Date) => format.dateTime(new Date(d), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState<JobLog[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const toggleExpanded = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && logs === null && run.logCount > 0) {
      setLoadingLogs(true);
      try {
        const res = await fetch(`/api/linkedin/jobs/${run.id}/logs`);
        const data = await res.json();
        setLogs(data.logs ?? []);
      } finally {
        setLoadingLogs(false);
      }
    }
  };

  const label = Object.hasOwn(JOB_LABEL_KEYS, run.job) ? t(`jobs.${JOB_LABEL_KEYS[run.job]}`) : run.job;

  return (
    <Fragment>
      <Table.Row
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => void toggleExpanded()}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            void toggleExpanded();
          }
        }}
        className="cursor-pointer outline-none focus-visible:[&>td]:bg-bg-weak-50"
      >
        <Table.Cell className="h-16 px-4">
          <div className="min-w-0">
            <p className="truncate text-label-sm text-text-strong-950" title={run.job}>{label}</p>
            <p className="mt-0.5 truncate text-paragraph-xs text-text-sub-600">
              {t("logLines", { count: run.logCount })}
            </p>
          </div>
        </Table.Cell>
        <Table.Cell className="px-4">
          <StatusBadge status={run.status} />
        </Table.Cell>
        <Table.Cell className="whitespace-nowrap px-4 text-paragraph-sm text-text-sub-600">
          <span title={fmt(run.startedAt)} suppressHydrationWarning>{ago(run.startedAt)}</span>
          <span className="block text-paragraph-xs text-text-soft-400" suppressHydrationWarning>{fmt(run.startedAt)}</span>
        </Table.Cell>
        <Table.Cell className="whitespace-nowrap px-4 text-right text-paragraph-sm tabular-nums text-text-strong-950">
          {duration(run.startedAt, run.finishedAt)}
        </Table.Cell>
        <Table.Cell className="whitespace-nowrap px-4 text-right text-paragraph-sm tabular-nums">
          {run.errorCount > 0 || run.warnCount > 0 ? (
            <span className="inline-flex items-center gap-2">
              {run.errorCount > 0 && <span className="text-error-base">{t("errorCount", { count: run.errorCount })}</span>}
              {run.warnCount > 0 && <span className="text-warning-base">{t("warnCount", { count: run.warnCount })}</span>}
            </span>
          ) : (
            <span className="text-text-soft-400">{t("none")}</span>
          )}
        </Table.Cell>
        <Table.Cell className="px-4 text-text-sub-600">
          {expanded ? <RiArrowDownSLine className="size-5" aria-hidden="true" /> : <RiArrowRightSLine className="size-5" aria-hidden="true" />}
          <span className="sr-only">{expanded ? t("hideLogs") : t("showLogs")}</span>
        </Table.Cell>
      </Table.Row>

      {(run.error || expanded) && (
        <Table.Row>
          <Table.Cell colSpan={COLUMNS} className="h-auto px-4 pb-3 pt-0 group-hover/row:bg-transparent">
            {run.error && (
              <p role="alert" className={cn("rounded-lg bg-error-lighter px-3 py-2 font-mono text-paragraph-xs text-error-base", expanded && "mb-2")}>
                {run.error}
              </p>
            )}
            {expanded && (
              <div className="max-h-96 overflow-y-auto rounded-lg bg-bg-weak-50 px-4 py-3 ring-1 ring-inset ring-stroke-soft-200">
                {loadingLogs ? (
                  <div className="flex justify-center py-6">
                    <RiLoader4Line className="size-5 animate-spin text-text-soft-400" aria-label={t("loadingLogs")} />
                  </div>
                ) : (logs?.length ?? 0) === 0 ? (
                  <p className="text-paragraph-xs italic text-text-sub-600">{t("noLogs")}</p>
                ) : (
                  <div className="space-y-0.5 font-mono text-paragraph-xs">
                    {logs!.map((log) => (
                      <div key={log.id} className="flex gap-3 leading-5">
                        <span className="shrink-0 select-none tabular-nums text-text-soft-400" suppressHydrationWarning>
                          {format.dateTime(new Date(log.createdAt), CLOCK_FORMAT)}
                        </span>
                        <span className={cn("mt-px w-8 shrink-0 text-[10px] font-bold uppercase", LEVEL_TEXT[log.level] ?? "text-text-sub-600")}>
                          {LEVEL_TAG[log.level] ?? "INF"}
                        </span>
                        <span className={cn("min-w-0 break-words", LEVEL_TEXT[log.level] ?? "text-text-strong-950")}>{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Table.Cell>
        </Table.Row>
      )}
    </Fragment>
  );
}

export function JobsClient({ runs, footer }: { runs: JobRun[]; footer?: ReactNode }) {
  const t = useTranslations("linkedinMain.jobsClient");
  const router = useRouter();
  const [triggering, setTriggering] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-refresh while any job is RUNNING
  const hasRunning = runs.some((r) => r.status === "RUNNING");
  useEffect(() => {
    if (!hasRunning) return;
    const t = setInterval(() => {
      startTransition(() => router.refresh());
    }, 3000);
    return () => clearInterval(t);
  }, [hasRunning, router]);

  const trigger = async (job: string) => {
    setTriggering(job);
    try {
      await fetch(`/api/linkedin/jobs/${job}`, { method: "POST" });
      setTimeout(() => {
        startTransition(() => router.refresh());
      }, 500);
    } finally {
      setTriggering(null);
    }
  };

  const successCount = runs.filter((r) => r.status === "SUCCESS").length;
  const failedCount = runs.filter((r) => r.status === "FAILED").length;
  const runningCount = runs.filter((r) => r.status === "RUNNING").length;

  const summary =
    runs.length === 0
      ? t("summaryEmpty")
      : runningCount > 0
        ? t("summaryWithRunning", { succeeded: successCount, failed: failedCount, running: runningCount })
        : t("summary", { succeeded: successCount, failed: failedCount });

  return (
    <Frame className="mt-5" aria-busy={isPending}>
      <FrameHeader
        title={t("runsTitle")}
        description={summary}
        actions={
          <>
            <Button.Root
              variant="neutral"
              mode="stroke"
              size="xsmall"
              onClick={() => trigger("reset-daily-limits")}
              disabled={!!triggering}
            >
              <Button.Icon as={triggering === "reset-daily-limits" ? RiLoader4Line : RiRefreshLine} className={cn(triggering === "reset-daily-limits" && "animate-spin")} />
              {t("jobs.resetDailyLimits")}
            </Button.Root>
            <Button.Root variant="primary" mode="filled" size="xsmall" onClick={() => trigger("run-outreach")} disabled={!!triggering}>
              <Button.Icon as={triggering === "run-outreach" ? RiLoader4Line : RiPlayLine} className={cn(triggering === "run-outreach" && "animate-spin")} />
              {t("jobs.runOutreach")}
            </Button.Root>
          </>
        }
      />

      {runs.length === 0 ? (
        <FramePanel>
          <EmptyState icon={RiHistoryLine} title={t("emptyTitle")} description={t("emptyDescription")} />
        </FramePanel>
      ) : (
        <>
          <FramePanel className={cn("overflow-x-auto p-2 sm:p-2", isPending && "opacity-60")}>
            <Table.Root className="min-w-[760px]">
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col" className="px-4">{t("colJob")}</Table.Head>
                  <Table.Head scope="col" className="w-32 px-4">{t("colStatus")}</Table.Head>
                  <Table.Head scope="col" className="w-40 px-4">{t("colStarted")}</Table.Head>
                  <Table.Head scope="col" className="w-28 px-4 text-right">{t("colDuration")}</Table.Head>
                  <Table.Head scope="col" className="w-36 px-4 text-right">{t("colProblems")}</Table.Head>
                  <Table.Head scope="col" className="w-12 px-4"><span className="sr-only">{t("colExpand")}</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {runs.map((run) => (
                  <RunRows key={run.id} run={run} />
                ))}
              </Table.Body>
            </Table.Root>
          </FramePanel>
          {footer}
        </>
      )}
    </Frame>
  );
}
