"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFormatter, useTranslations } from "next-intl";
import {
  RiBuilding2Line,
  RiCloseLine,
  RiErrorWarningLine,
  RiForbid2Line,
  RiCheckLine,
  RiMailSendLine,
  RiReplyLine,
  RiTimeLine,
  RiUserAddLine,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";

import * as Avatar from "@/components/alignui/avatar";
import * as Badge from "@/components/alignui/badge";
import { cn } from "@/utils/cn";
import type { Messages } from "@/i18n/catalog";
import { STATUS_KEY } from "./leadStatus";
import type { outreachLeads, outreachEmails, OutreachLeadStatus, SequenceStep } from "@/lib/outreach/schema";

type Lead = Omit<typeof outreachLeads.$inferSelect, "email" | "customFields"> & {
  email: string;
  customFields: Record<string, string> | null;
};
type Email = typeof outreachEmails.$inferSelect & { fromAddress?: string | null };

const STATUS_COLOR: Record<OutreachLeadStatus, React.ComponentProps<typeof Badge.Root>["color"]> = {
  pending: "gray",
  initial_sent: "blue",
  in_follow_up: "blue",
  reply_processing: "yellow",
  sequence_completed: "purple",
  reply_received: "green",
  bounced: "red",
  suppressed: "orange",
};

type T = ReturnType<typeof useTranslations<"emailLeads.activity">>;
type TStatus = ReturnType<typeof useTranslations<"emailLeads.status">>;
type Formatter = ReturnType<typeof useFormatter>;

function statusLabel(tStatus: TStatus, status: OutreachLeadStatus): string {
  return STATUS_KEY[status] ? tStatus(STATUS_KEY[status]) : status;
}

function relativeTime(at: string | Date | null, format: Formatter): string {
  if (!at) return "—";
  return format.relativeTime(new Date(at));
}

type TimelineEvent = {
  id: string;
  icon: RemixiconComponentType;
  tone: string;
  title: string;
  subtitle: string | null;
  /** Rendered as a quoted message card when present. */
  message: { from: string; to: string; subject: string | null; body: string | null } | null;
  detail: string | null;
  at: string | Date | null;
};

/**
 * Derives a lead's activity feed from outreachEmails rows + its current
 * sequenceStatus — there's no dedicated event log for outreach leads (unlike
 * CRM audit history, so this is reconstructed rather than read directly.
 */
function buildTimeline(lead: Lead, emails: Email[], t: T, format: Formatter): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const email of emails) {
    if (email.status === "sent") {
      events.push({
        id: email.id,
        icon: RiMailSendLine,
        tone: "bg-primary-alpha-10 text-primary-base",
        title: email.stepNumber === 1 ? t("initialSent") : t("followUpSent"),
        subtitle: t("emailSequence", { step: email.stepNumber }),
        message: {
          from: email.fromAddress ?? t("yourMailbox"),
          to: lead.email,
          subject: email.subject,
          body: email.body,
        },
        detail: null,
        at: email.sentAt,
      });
    } else if (email.status === "scheduled") {
      events.push({
        id: email.id,
        icon: RiTimeLine,
        tone: "bg-away-lighter text-away-base",
        title: t("stepScheduled", { step: email.stepNumber }),
        subtitle: null,
        message: null,
        detail: lead.nextSendAt
          ? t("queuedFor", {
              date: format.dateTime(new Date(lead.nextSendAt), {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }),
            })
          : null,
        at: null,
      });
    } else if (email.status === "failed") {
      events.push({
        id: email.id,
        icon: RiErrorWarningLine,
        tone: "bg-error-lighter text-error-base",
        title: t("stepFailed", { step: email.stepNumber }),
        subtitle: null,
        message: null,
        detail: email.error,
        at: email.createdAt,
      });
    }
  }

  if (lead.sequenceStatus === "reply_received") {
    events.push({
      id: "reply",
      icon: RiReplyLine,
      tone: "bg-success-lighter text-success-base",
      title: t("leadReplied"),
      subtitle: null,
      message: null,
      detail: null,
      at: lead.updatedAt,
    });
  }
  if (lead.sequenceStatus === "bounced") {
    events.push({
      id: "bounced",
      icon: RiErrorWarningLine,
      tone: "bg-error-lighter text-error-base",
      title: t("emailBounced"),
      subtitle: null,
      message: null,
      detail: null,
      at: lead.updatedAt,
    });
  }
  if (lead.sequenceStatus === "suppressed") {
    events.push({
      id: "suppressed",
      icon: RiForbid2Line,
      tone: "bg-bg-weak-50 text-text-sub-600",
      title: t("suppressed"),
      subtitle: null,
      message: null,
      detail: null,
      at: lead.updatedAt,
    });
  }

  events.push({
    id: "imported",
    icon: RiUserAddLine,
    tone: "bg-bg-weak-50 text-text-sub-600",
    title: t("leadImported"),
    subtitle: null,
    message: null,
    detail: null,
    at: lead.createdAt,
  });

  // Newest first; events without a timestamp (scheduled sends) float to the top.
  // "Lead imported" is pinned last regardless of its createdAt: a lead re-imported
  // after its sequence ran would otherwise sort above emails it already received,
  // which reads as though the sequence preceded the import.
  return events.sort((a, b) => {
    if (a.id === "imported") return 1;
    if (b.id === "imported") return -1;
    if (!a.at && !b.at) return 0;
    if (!a.at) return -1;
    if (!b.at) return 1;
    return new Date(b.at).getTime() - new Date(a.at).getTime();
  });
}

/**
 * Every column this lead was imported with, in one table: the built-in fields
 * first, then each customFields key (one per unrecognized CSV/XLSX header).
 *
 * The {{token}} is shown beside each row because that is the whole point —
 * seeing which merge field a column maps to, and which ones are empty for this
 * lead and would therefore render blank in a sequence.
 */
function importedFields(lead: Lead, t: T): { label: string; value: string; token?: string }[] {
  const rows = [
    { label: t("fieldEmail"), value: lead.email },
    { label: t("fieldFirstName"), value: lead.firstName ?? "", token: "firstName" },
    { label: t("fieldLastName"), value: lead.lastName ?? "", token: "lastName" },
    { label: t("fieldCompany"), value: lead.company ?? "", token: "company" },
  ];
  for (const [key, value] of Object.entries(lead.customFields ?? {})) {
    rows.push({ label: humanizeKey(key), value: value ?? "", token: key });
  }
  return rows;
}

/** "jobTitle" -> "Job title", matching the chip labels in the sequence editor. */
function humanizeKey(key: string): string {
  const spaced = key.replace(/[_-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function fullDate(at: string | Date | null, format: Formatter): string {
  if (!at) return "—";
  return format.dateTime(new Date(at), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const TABS = [
  { id: "timeline", labelKey: "tabTimeline" },
  { id: "sequence", labelKey: "tabSequence" },
  { id: "details", labelKey: "tabDetails" },
] as const;

type StepState = "sent" | "scheduled" | "failed" | "upcoming" | "cancelled";

type SequenceRow = {
  stepNumber: number;
  subject: string;
  state: StepState;
  /** When it went out (sent/failed), or when it is queued for (scheduled). */
  at: Date | null;
  /** Days this step waits after the previous one — shown for steps with no date yet. */
  waitDays: number;
  error: string | null;
};

const STEP_STATE_KEY = {
  sent: "stepStateSent",
  scheduled: "stepStateScheduled",
  failed: "stepStateFailed",
  upcoming: "stepStateUpcoming",
  cancelled: "stepStateCancelled",
} as const satisfies Record<StepState, keyof Messages["emailLeads"]["activity"]>;

const STEP_STATE_COLOR: Record<StepState, React.ComponentProps<typeof Badge.Root>["color"]> = {
  sent: "green",
  scheduled: "blue",
  failed: "red",
  upcoming: "gray",
  cancelled: "orange",
};

/**
 * The lead's full sequence: one row per campaign step, joined to whatever
 * outreach_emails row exists for it.
 *
 * Steps the lead has not reached have no email row at all — rows are written at
 * send time — so their subject comes from the campaign's sequence definition
 * and they carry no date. Only the immediate next step gets a real timestamp
 * (lead.nextSendAt); the scheduler computes each subsequent date only once the
 * previous step actually sends, so projecting further ahead would be inventing
 * dates that working-hours and rate limits will move anyway.
 */
function buildSequence(lead: Lead, emails: Email[], sequence: SequenceStep[], t: T): SequenceRow[] {
  const byStep = new Map(emails.map((e) => [e.stepNumber, e]));

  // A lead that replied, bounced, or was suppressed stops here — its remaining
  // steps will never send, and showing them as "Upcoming" would be a lie.
  const halted =
    lead.sequenceStatus === "reply_received" ||
    lead.sequenceStatus === "bounced" ||
    lead.sequenceStatus === "suppressed";

  return sequence.map((step) => {
    const email = byStep.get(step.stepNumber);
    const subject = email?.subject || step.subject || t("noSubject");

    if (email?.status === "sent") {
      return { stepNumber: step.stepNumber, subject, state: "sent" as const, at: email.sentAt, waitDays: step.waitDays, error: null };
    }
    if (email?.status === "failed") {
      return { stepNumber: step.stepNumber, subject, state: "failed" as const, at: email.createdAt, waitDays: step.waitDays, error: email.error };
    }
    if (email?.status === "scheduled") {
      return {
        stepNumber: step.stepNumber,
        subject,
        state: halted ? ("cancelled" as const) : ("scheduled" as const),
        at: halted ? null : lead.nextSendAt,
        waitDays: step.waitDays,
        error: null,
      };
    }
    return {
      stepNumber: step.stepNumber,
      subject,
      state: halted ? ("cancelled" as const) : ("upcoming" as const),
      at: null,
      waitDays: step.waitDays,
      error: null,
    };
  });
}

/** The Sequence tab: every step of the campaign as it applies to this lead. */
function SequenceView({ rows, status }: { rows: SequenceRow[]; status: OutreachLeadStatus }) {
  const t = useTranslations("emailLeads.activity");
  const tStatus = useTranslations("emailLeads.status");
  const format = useFormatter();
  if (rows.length === 0) {
    return (
      <p className="text-paragraph-sm text-text-soft-400">
        {t("noSteps")}
      </p>
    );
  }

  const sentCount = rows.filter((r) => r.state === "sent").length;
  const halted = rows.some((r) => r.state === "cancelled");

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <p className="text-paragraph-sm text-text-sub-600">
          {t("stepsSent", { sent: sentCount, total: rows.length })}
        </p>
        {halted && (
          <p className="text-paragraph-xs text-text-soft-400">
            {t("stoppedStatus", { status: statusLabel(tStatus, status).toLowerCase() })}
          </p>
        )}
      </div>

      <ol className="flex flex-col">
        {rows.map((row, i) => {
          const done = row.state === "sent";
          return (
            <li key={row.stepNumber} className="flex gap-3">
              <div className="flex shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-label-xs",
                    done
                      ? "bg-success-lighter text-success-base"
                      : row.state === "failed"
                        ? "bg-error-lighter text-error-base"
                        : row.state === "scheduled"
                          ? "bg-primary-alpha-10 text-primary-base"
                          : "bg-bg-weak-50 text-text-soft-400",
                  )}
                >
                  {done ? <RiCheckLine className="size-4" /> : row.stepNumber}
                </span>
                {i < rows.length - 1 && (
                  <span className="my-1 w-px flex-1 border-l border-dashed border-stroke-soft-200" />
                )}
              </div>

              <div className="min-w-0 flex-1 pb-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-label-sm text-text-strong-950">{t("step", { step: row.stepNumber })}</p>
                  <Badge.Root size="medium" variant="lighter" color={STEP_STATE_COLOR[row.state]}>
                    <Badge.Dot />
                    {t(STEP_STATE_KEY[row.state])}
                  </Badge.Root>
                </div>

                <p className="mt-0.5 truncate text-paragraph-sm text-text-sub-600">{row.subject}</p>

                <p className="mt-1.5 text-paragraph-xs text-text-soft-400">
                  {row.at
                    ? row.state === "scheduled"
                      ? t("queuedFor", { date: fullDate(row.at, format) })
                      : row.state === "failed"
                        ? t("attemptedAt", { date: fullDate(row.at, format) })
                        : t("sentAt", { date: fullDate(row.at, format) })
                    : row.state === "cancelled"
                      ? t("willNotSend")
                      : row.waitDays > 0
                        ? t("sendsAfterDays", { days: row.waitDays })
                        : t("sendsImmediately")}
                </p>

                {row.at && row.state !== "scheduled" && (
                  <p className="mt-0.5 text-paragraph-xs text-text-soft-400">{relativeTime(row.at, format)}</p>
                )}
                {row.error && (
                  <p className="mt-1 text-paragraph-sm text-error-base">{row.error}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A quoted email, shown inside a timeline entry. */
function MessageCard({
  from,
  to,
  subject,
  body,
}: {
  from: string;
  to: string;
  subject: string | null;
  body: string | null;
}) {
  const t = useTranslations("emailLeads.activity");
  const [expanded, setExpanded] = useState(false);
  const text = (body ?? "").trim();
  const isLong = text.length > 180;

  return (
    <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-inset ring-stroke-soft-200">
      <div className="flex items-center gap-2.5 bg-bg-weak-50 px-3 py-2.5">
        <Avatar.Root size="24" color="blue">
          {from.slice(0, 2)}
        </Avatar.Root>
        <div className="min-w-0">
          <p className="truncate text-label-xs text-text-strong-950">{from}</p>
          <p className="truncate text-paragraph-xs text-text-soft-400">{t("toLine", { to })}</p>
        </div>
      </div>
      <div className="px-3 py-2.5">
        {subject && (
          <p className="mb-1 text-label-sm text-text-strong-950">{subject}</p>
        )}
        <p
          className={cn(
            "whitespace-pre-wrap text-paragraph-sm text-text-sub-600",
            !expanded && isLong && "line-clamp-3",
          )}
        >
          {text || t("noBody")}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 text-label-xs text-primary-base hover:text-primary-darker"
          >
            {expanded ? t("showLess") : t("showFull")}
          </button>
        )}
      </div>
    </div>
  );
}

export default function LeadActivityPanel({
  campaignId,
  leadId,
  onClose,
}: {
  campaignId: string;
  leadId: string;
  onClose: () => void;
}) {
  const t = useTranslations("emailLeads.activity");
  const tStatus = useTranslations("emailLeads.status");
  const format = useFormatter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [sequence, setSequence] = useState<SequenceStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("timeline");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: effect resets/seeds local state when props or open state change; deriving during render would change timing
    setLoading(true);
    fetch(`/api/outreach/campaigns/${campaignId}/leads/${leadId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLead(data.lead ?? null);
        setEmails(data.emails ?? []);
        setSequence(data.sequence ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [campaignId, leadId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const timeline = lead ? buildTimeline(lead, emails, t, format) : [];
  const sequenceRows = lead ? buildSequence(lead, emails, sequence, t) : [];
  const name = lead
    ? [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.email
    : "";

  const panel = (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex h-full w-135 max-w-full flex-col bg-bg-white-0 shadow-regular-md">
        {loading || !lead ? (
          <div className="p-6 text-paragraph-sm text-text-soft-400">{t("loading")}</div>
        ) : (
          <>
            {/* Header */}
            <div className="shrink-0 px-6 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-title-h6 text-text-strong-950">{name}</h2>
                  <p className="mt-0.5 truncate text-paragraph-sm text-text-sub-600">
                    {lead.email}
                  </p>
                  {lead.company && (
                    <p className="mt-2 flex items-center gap-1.5 text-paragraph-sm text-text-sub-600">
                      <RiBuilding2Line className="size-4 text-text-soft-400" />
                      {lead.company}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge.Root
                    size="medium"
                    variant="lighter"
                    color={STATUS_COLOR[lead.sequenceStatus]}
                  >
                    <Badge.Dot />
                    {statusLabel(tStatus, lead.sequenceStatus)}
                  </Badge.Root>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={t("closePanel")}
                    className="flex size-8 items-center justify-center rounded-lg text-text-sub-600 transition duration-200 ease-out hover:bg-bg-weak-50 hover:text-text-strong-950"
                  >
                    <RiCloseLine className="size-5" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <nav className="mt-5 flex items-center gap-6 border-b border-stroke-soft-200">
                {TABS.map((tabItem) => {
                  const active = tab === tabItem.id;
                  return (
                    <button
                      key={tabItem.id}
                      type="button"
                      onClick={() => setTab(tabItem.id)}
                      className={cn(
                        "-mb-px border-b-2 pb-3 text-label-sm transition-colors duration-200 ease-out",
                        active
                          ? "border-primary-base text-primary-base"
                          : "border-transparent text-text-sub-600 hover:text-text-strong-950",
                      )}
                    >
                      {t(tabItem.labelKey)}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {tab === "timeline" ? (
                timeline.length === 0 ? (
                  <p className="text-paragraph-sm text-text-soft-400">{t("noActivity")}</p>
                ) : (
                  <ol className="flex flex-col">
                    {timeline.map((e, i) => {
                      const Icon = e.icon;
                      return (
                        <li key={e.id} className="flex gap-3">
                          <div className="flex shrink-0 flex-col items-center">
                            <span
                              className={cn(
                                "flex size-8 items-center justify-center rounded-full",
                                e.tone,
                              )}
                            >
                              <Icon className="size-4" />
                            </span>
                            {i < timeline.length - 1 && (
                              <span className="my-1 w-px flex-1 border-l border-dashed border-stroke-soft-200" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1 pb-6">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-label-sm text-text-strong-950">{e.title}</p>
                              <p className="shrink-0 text-paragraph-xs text-text-soft-400">
                                {e.at ? fullDate(e.at, format) : t("notSentYet")}
                              </p>
                            </div>
                            {e.subtitle && (
                              <p className="mt-0.5 text-paragraph-xs text-text-soft-400">
                                {e.subtitle}
                              </p>
                            )}
                            {e.detail && (
                              <p className="mt-0.5 text-paragraph-sm text-text-sub-600">
                                {e.detail}
                              </p>
                            )}
                            {e.message && <MessageCard {...e.message} />}
                            {e.at && (
                              <p className="mt-1.5 text-paragraph-xs text-text-soft-400">
                                {relativeTime(e.at, format)}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )
              ) : tab === "sequence" ? (
                <SequenceView rows={sequenceRows} status={lead.sequenceStatus} />
              ) : (
                <table className="w-full">
                  <tbody>
                    {importedFields(lead, t).map(({ label, value, token }) => (
                      <tr
                        key={label}
                        className="border-b border-stroke-soft-200 align-top last:border-0"
                      >
                        <td className="whitespace-nowrap py-2.5 pr-3">
                          <span className="block text-paragraph-sm text-text-sub-600">
                            {label}
                          </span>
                          {token && (
                            <span className="block font-mono text-paragraph-xs text-text-soft-400">
                              {`{{${token}}}`}
                            </span>
                          )}
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right text-paragraph-sm",
                            value ? "text-text-strong-950" : "italic text-text-soft-400",
                          )}
                        >
                          {value || t("empty")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
