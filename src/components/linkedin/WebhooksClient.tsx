"use client";

import { Fragment, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { RiArrowDownSLine, RiArrowRightSLine, RiLoader4Line, RiWebhookLine } from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Table from "@/components/alignui/table";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { StatusDotBadge } from "@/components/analytics/kit/StatusDotBadge";
import { useCrmText } from "@/components/crm/useCrmText";
import { ContactAvatar } from "@/components/crm/ContactAvatar";
import { EmptyState } from "@/components/page/EmptyState";
import { LinkedInAccountTag } from "@/components/linkedin/LinkedInAccountTag";
import { cn } from "@/lib/linkedin/utils";

type Connection = {
  name: string | null;
  profilePictureUrl: string | null;
};

type Account = {
  username: string;
  name: string | null;
  profilePictureUrl?: string | null;
};

export type WebhookEventRow = {
  id: string;
  event: string;
  accountId: string | null;
  senderId: string | null;
  chatId: string | null;
  messageText: string | null;
  createdAt: string;
  connection: Connection | null;
  account: Account | null;
  processingStatus: string | null;
};

type WebhookEventDetail = {
  rawBody: unknown;
  processingLog: { level: string; message: string; time: string }[] | null;
};

/** Date and time down to the second, in the active locale. */
// Intl format options, not interface text.
const CLOCK_FORMAT = { hour: "2-digit", minute: "2-digit", second: "2-digit" } as const;

function useStamp() {
  const format = useFormatter();
  return (iso: string) =>
    format.dateTime(new Date(iso), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const initialsOf = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

const EVENT_COLOR: Record<string, React.ComponentProps<typeof Badge.Root>["color"]> = {
  new_relation: "green",
  message_received: "blue",
  account_status: "orange",
};

function EventBadge({ event }: { event: string }) {
  return (
    <Badge.Root size="small" variant="lighter" color={EVENT_COLOR[event] ?? "gray"}>
      {event}
    </Badge.Root>
  );
}

const PROCESSING_KINDS = { ok: "good", error: "critical", processing: "info" } as const;

function ProcessingBadge({ status }: { status: string | null }) {
  const t = useTranslations("linkedinMain.webhooksClient");
  if (!status) return <span className="text-paragraph-sm text-text-soft-400">—</span>;
  const known = Object.hasOwn(PROCESSING_KINDS, status);
  const kind = known ? PROCESSING_KINDS[status as keyof typeof PROCESSING_KINDS] : "neutral";
  // A status the code does not know is shown as stored.
  const label = known ? t(`processingStatus.${status as keyof typeof PROCESSING_KINDS}`) : status.charAt(0).toUpperCase() + status.slice(1);
  return <StatusDotBadge status={kind}>{label}</StatusDotBadge>;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-paragraph-xs">
      <span className="w-28 shrink-0 text-text-soft-400">{label}</span>
      <span className="min-w-0 break-all text-text-strong-950">{value}</span>
    </div>
  );
}

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 text-subheading-2xs uppercase text-text-soft-400">{children}</p>
);

const LEVEL_TEXT: Record<string, string> = { error: "text-error-base", warn: "text-warning-base" };
const LEVEL_TAG: Record<string, string> = { info: "INF", warn: "WRN", error: "ERR" };

const COLUMNS = 6;

function EventRows({ ev }: { ev: WebhookEventRow }) {
  const t = useTranslations("linkedinMain.webhooksClient");
  const format = useFormatter();
  const { timeAgo } = useCrmText();
  const fmt = useStamp();
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<WebhookEventDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const displayName = ev.connection?.name ?? ev.account?.name ?? ev.account?.username ?? null;
  const title = displayName ?? ev.senderId ?? t("unknownSender");
  const hasError = ev.processingStatus === "error";
  const accountRef = ev.account
    ? { username: ev.account.username, name: ev.account.name, profilePictureUrl: ev.account.profilePictureUrl ?? null }
    : null;

  const toggleExpanded = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && detail === null) {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/webhooks/${ev.id}`);
        if (res.ok) setDetail(await res.json());
      } finally {
        setLoadingDetail(false);
      }
    }
  };

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
          <div className="flex min-w-0 items-center gap-3">
            <ContactAvatar
              src={ev.connection?.profilePictureUrl}
              fallback={displayName ? initialsOf(displayName) : "?"}
              className="size-9 bg-bg-weak-50 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200"
            />
            <div className="min-w-0">
              <p className="truncate text-label-sm text-text-strong-950" title={title}>{title}</p>
              {ev.messageText ? (
                <p className="mt-0.5 max-w-sm truncate text-paragraph-xs italic text-text-sub-600" title={ev.messageText}>
                  {t("quotedMessage", { text: ev.messageText })}
                </p>
              ) : (
                <p className="mt-0.5 text-paragraph-xs text-text-soft-400">{t("noMessage")}</p>
              )}
            </div>
          </div>
        </Table.Cell>
        <Table.Cell className="px-4"><EventBadge event={ev.event} /></Table.Cell>
        <Table.Cell className="px-4"><ProcessingBadge status={ev.processingStatus} /></Table.Cell>
        <Table.Cell className="px-4">
          {accountRef ? <LinkedInAccountTag account={accountRef} size="sm" /> : <span className="text-paragraph-sm text-text-soft-400">—</span>}
        </Table.Cell>
        <Table.Cell className="whitespace-nowrap px-4 text-paragraph-sm text-text-sub-600">
          <span title={fmt(ev.createdAt)} suppressHydrationWarning>{timeAgo(ev.createdAt)}</span>
        </Table.Cell>
        <Table.Cell className="px-4 text-text-sub-600">
          {expanded ? <RiArrowDownSLine className="size-5" aria-hidden="true" /> : <RiArrowRightSLine className="size-5" aria-hidden="true" />}
          <span className="sr-only">{expanded ? t("hideDetails") : t("showDetails")}</span>
        </Table.Cell>
      </Table.Row>

      {expanded && (
        <Table.Row>
          <Table.Cell colSpan={COLUMNS} className="h-auto px-4 pb-3 pt-0 group-hover/row:bg-transparent">
            <div className={cn("space-y-5 rounded-lg bg-bg-weak-50 px-4 py-4 ring-1 ring-inset", hasError ? "ring-error-base/30" : "ring-stroke-soft-200")}>
              {loadingDetail ? (
                <div className="flex justify-center py-8">
                  <RiLoader4Line className="size-5 animate-spin text-text-soft-400" aria-label={t("loadingDetails")} />
                </div>
              ) : (
                <>
                  <div>
                    <SectionLabel>{t("processingLog")}</SectionLabel>
                    {detail?.processingLog && detail.processingLog.length > 0 ? (
                      <div className="space-y-0.5 font-mono text-paragraph-xs">
                        {detail.processingLog.map((entry, i) => (
                          <div key={i} className="flex gap-3 leading-5">
                            <span className="shrink-0 select-none tabular-nums text-text-soft-400">
                              {format.dateTime(new Date(entry.time), CLOCK_FORMAT)}
                            </span>
                            <span className={cn("mt-px w-8 shrink-0 text-[10px] font-bold uppercase", LEVEL_TEXT[entry.level] ?? "text-text-sub-600")}>
                              {LEVEL_TAG[entry.level] ?? "INF"}
                            </span>
                            <span className={cn("min-w-0 break-words", LEVEL_TEXT[entry.level] ?? "text-text-strong-950")}>{entry.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-paragraph-xs italic text-text-sub-600">{t("noProcessingLog")}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <SectionLabel>{t("eventFields")}</SectionLabel>
                    <DetailRow label={t("fieldEvent")} value={ev.event} />
                    <DetailRow label={t("fieldTime")} value={fmt(ev.createdAt)} />
                    <DetailRow label={t("fieldAccount")} value={accountRef ? <LinkedInAccountTag account={accountRef} size="sm" /> : ev.accountId} />
                    <DetailRow label={t("fieldSenderId")} value={ev.senderId} />
                    <DetailRow label={t("fieldChatId")} value={ev.chatId} />
                    <DetailRow label={t("fieldMessage")} value={ev.messageText ? `“${ev.messageText}”` : null} />
                    {ev.connection?.name && <DetailRow label={t("fieldConnection")} value={ev.connection.name} />}
                  </div>

                  <div>
                    <SectionLabel>{t("rawPayload")}</SectionLabel>
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-bg-white-0 p-3 font-mono text-paragraph-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
                      {JSON.stringify(detail?.rawBody ?? null, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </Table.Cell>
        </Table.Row>
      )}
    </Fragment>
  );
}

export function WebhooksClient({ events, footer }: { events: WebhookEventRow[]; footer?: ReactNode }) {
  const t = useTranslations("linkedinMain.webhooksClient");
  return (
    <Frame className="mt-5">
      <FrameHeader title={t("eventsTitle")} description={t("eventsDescription")} />
      {events.length === 0 ? (
        <FramePanel>
          <EmptyState icon={RiWebhookLine} title={t("emptyTitle")} description={t("emptyDescription")} />
        </FramePanel>
      ) : (
        <>
          <FramePanel className="overflow-x-auto p-2 sm:p-2">
            <Table.Root className="min-w-[860px]">
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col" className="px-4">{t("colSender")}</Table.Head>
                  <Table.Head scope="col" className="w-44 px-4">{t("colEvent")}</Table.Head>
                  <Table.Head scope="col" className="w-32 px-4">{t("colProcessing")}</Table.Head>
                  <Table.Head scope="col" className="w-48 px-4">{t("colAccount")}</Table.Head>
                  <Table.Head scope="col" className="w-28 px-4">{t("colReceived")}</Table.Head>
                  <Table.Head scope="col" className="w-12 px-4"><span className="sr-only">{t("colExpand")}</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {events.map((ev) => (
                  <EventRows key={ev.id} ev={ev} />
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
