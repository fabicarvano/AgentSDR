/**
 * What an inbox (LinkedIn or email Master Inbox) shows of a conversation's
 * CRM state.
 *
 * Client-safe: types and pure labelling only. The record-level readers that
 * build these from the database live in ./inboxContext.server; each inbox
 * adds its own channel lookup on top (src/lib/linkedin/messages/crmContext.server,
 * src/lib/inbox/crmContext.server). See connectionList.ts for why the split exists.
 */
import type { CrmWorkflowState } from "./schema";

export type InboxCrmStep = {
  position: number;
  /** Steps in the published version the run is on. */
  total: number;
  name: string;
  type: "reply" | "follow_up";
  status: "scheduled" | "drafting" | "awaiting_review" | "failed";
  dueAt: string | null;
};

/** Enough for a list row: who the lead is to the CRM and what comes next. */
export type InboxCrmSummary = {
  recordId: string;
  workflowState: CrmWorkflowState;
  categoryKey: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  nextActionAt: string | null;
  sequenceName: string | null;
  /** The active run's earliest unsent step, or null without an active run. */
  step: InboxCrmStep | null;
  /** An awaiting-review draft exists for this record. */
  hasDraft: boolean;
};

export type InboxCrmDraft = {
  id: string;
  revision: number;
  status: "generating" | "awaiting_review" | "failed";
  subject: string | null;
  /** Edited text when the operator saved one, else the AI text. */
  body: string;
  stepType: "reply" | "follow_up" | null;
  stepName: string | null;
  error: string | null;
};

/** The full strip for the open thread. */
export type InboxCrmContext = InboxCrmSummary & {
  conversationId: string;
  contextVersion: number;
  doNotContact: boolean;
  /** Latest classification row, which the human-classification PATCH expects. */
  classificationId: string | null;
  draft: InboxCrmDraft | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** When a scheduled step is due, relative to now, as data the UI words in its own language. */
export type InboxCrmStepPhase = "drafted" | "drafting" | "failed" | "scheduled" | "dueNow" | "dueHours" | "dueDays";

/**
 * The immediate step as data: `inboxCrmStepLabel` words it in English (tests, MCP, server);
 * the UI words it from the `serverCrm.inboxStep` catalog (`useInboxCrmStepLabel`).
 * `value` is the hours or days of `dueHours` / `dueDays`; `n` is the follow-up number.
 */
export type InboxCrmStepInfo =
  | { kind: "closed" | "paused" | "attention" | "classifying" | "none" | "replyDrafted" }
  | { kind: "reply"; phase: InboxCrmStepPhase; value?: number }
  | { kind: "followUp"; n: number; phase: InboxCrmStepPhase; value?: number };

function duePhase(dueAt: string, now: Date): { phase: InboxCrmStepPhase; value?: number } {
  const delta = new Date(dueAt).getTime() - now.getTime();
  if (delta <= 0) return { phase: "dueNow" };
  if (delta < DAY_MS) return { phase: "dueHours", value: Math.max(1, Math.round(delta / (60 * 60 * 1000))) };
  return { phase: "dueDays", value: Math.round(delta / DAY_MS) };
}

/** What the immediate step is, as structured data; see `InboxCrmStepInfo`. */
export function inboxCrmStep(summary: InboxCrmSummary, now = new Date()): InboxCrmStepInfo {
  if (summary.workflowState === "closed") return { kind: "closed" };
  if (summary.workflowState === "paused") return { kind: "paused" };
  if (summary.workflowState === "error") return { kind: "attention" };
  if (summary.workflowState === "classifying" || summary.workflowState === "unclassified") return { kind: "classifying" };
  const step = summary.step;
  if (!step) return summary.hasDraft ? { kind: "replyDrafted" } : { kind: "none" };
  const phase: { phase: InboxCrmStepPhase; value?: number } =
    step.status === "awaiting_review" ? { phase: "drafted" }
    : step.status === "drafting" ? { phase: "drafting" }
    : step.status === "failed" ? { phase: "failed" }
    : step.dueAt ? duePhase(step.dueAt, now)
    : { phase: "scheduled" };
  return step.type === "reply" ? { kind: "reply", ...phase } : { kind: "followUp", n: step.position - 1, ...phase };
}

function englishPhase(info: { phase: InboxCrmStepPhase; value?: number }): string {
  switch (info.phase) {
    case "drafted": return "drafted";
    case "drafting": return "drafting";
    case "failed": return "failed";
    case "scheduled": return "scheduled";
    case "dueNow": return "due now";
    case "dueHours": return `due in ${info.value}h`;
    case "dueDays": return `due in ${info.value}d`;
  }
}

/**
 * One phrase for "what is the immediate step" — the list shows it where the
 * flat "Replied" status used to be, since every row there has replied.
 * English only; screens use `useInboxCrmStepLabel()`.
 */
export function inboxCrmStepLabel(summary: InboxCrmSummary, now = new Date()): string {
  const info = inboxCrmStep(summary, now);
  switch (info.kind) {
    case "closed": return "Closed";
    case "paused": return "Paused";
    case "attention": return "Needs attention";
    case "classifying": return "Classifying";
    case "none": return "No next step";
    case "replyDrafted": return "Reply drafted";
    case "reply": return `Reply ${englishPhase(info)}`;
    case "followUp": return `Follow-up ${info.n} ${englishPhase(info)}`;
  }
}
