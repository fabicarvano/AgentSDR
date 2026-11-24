/**
 * AI calling campaigns: the request and response shapes of
 * /api/calling/ai-campaigns, plus the pure checks the pages and the server
 * share (settings validation, launch blockers). Client-safe: only types and
 * constants from the contracts.
 */

import type { WeeklyHours } from "@/lib/channels/rules";
import type { AgentOutcomeKind, CallCampaignStatus, CallStatus } from "../contract";
import type { StationStatus } from "../stationContract";
import {
  AI_CAMPAIGN_MAX_CALLBACKS,
  AI_CAMPAIGN_GOALS,
  aiCampaignStepsProblem,
  aiStepsProblemText,
  type AiStepsProblem,
  type AiCampaignGoal,
  type AiCampaignSettings,
  type AiCampaignStep,
  type AiContactStatus,
  type AiStepRunKind,
} from "./contract";

export const AI_CAMPAIGN_MAX_INSTRUCTIONS = 4_000;
export const AI_CAMPAIGN_MAX_BOOKING_MESSAGE = 1_000;

/** Where a campaign is in its life: a draft places nothing until it is launched. */
export type AiCampaignState = "draft" | "active" | "paused";

export type AiCampaignNumber = {
  id: string;
  name: string;
  phone: string;
  status: StationStatus;
  /** The call worker keeping its WhatsApp Web open (calls start right away). */
  openOn: string | null;
  /** The number's own AI calls-a-day limit; null = the organization's rule. */
  callsPerDay: number | null;
  /** AI campaign calls placed from it today (all campaigns). */
  callsToday: number;
};

export type AiCampaignSummary = {
  id: string;
  name: string;
  description: string | null;
  status: CallCampaignStatus;
  state: AiCampaignState;
  launchedAt: string | null;
  goal: AiCampaignGoal;
  createdAt: string;
  numbers: AiCampaignNumber[];
  leads: number;
  /** This campaign's calls placed today. */
  callsToday: number;
  booked: number;
  stepCount: number;
};

export type AiCampaignDetail = AiCampaignSummary &
  AiCampaignSettings & {
    steps: AiCampaignStep[];
    chaseSteps: AiCampaignStep[];
    /** The CRM Knowledge documents its calls know; null = the organization's "always include" ones. */
    knowledgeIds: string[] | null;
    /** Why it cannot launch yet (drafts only), or null. */
    blocker: string | null;
    /** The same blocker as a code, so screens can word it in the interface language. */
    blockerProblem: AiLaunchProblem | null;
    /** The most calls its numbers may place a day (their own limits or the organization's rule), before warm-up. */
    callsPerDayLimit: number;
  };

export type ListAiCampaignsResponse = { campaigns: AiCampaignSummary[] };

export type CreateAiCampaignRequest = { name: string; description?: string | null };

export type UpdateAiCampaignRequest = {
  name?: string;
  description?: string | null;
  /** Pause or resume a launched campaign. */
  status?: CallCampaignStatus;
  goal?: AiCampaignGoal;
  instructions?: string;
  agentName?: string | null;
  agentVoice?: string | null;
  bookingUrl?: string | null;
  bookingMessage?: string;
  maxCallbacks?: number;
  steps?: AiCampaignStep[];
  chaseSteps?: AiCampaignStep[];
  /** CRM Knowledge document ids (an empty list: none); null = the "always include" documents. */
  knowledgeIds?: string[] | null;
};

/** The most Knowledge documents a campaign may pick. */
export const AI_CAMPAIGN_MAX_KNOWLEDGE = 50;

export type SetAiCampaignStationsRequest = { stationIds: string[] };

export type AiLeadsQuery = { status?: AiContactStatus; q?: string; page?: number; pageSize?: number };

export type AiCampaignLead = {
  id: string;
  personId: string;
  name: string | null;
  title: string | null;
  companyName: string | null;
  phone: string;
  status: AiContactStatus;
  note: string | null;
  /** "Call 2 of 4", "Message 1 of 2 (follow-up)": the step it is on, or null once it is done. */
  currentStep: string | null;
  /** The same step as data, so screens can word it in the interface language. */
  currentStepRef: AiLeadStepRef | null;
  nextAt: string | null;
  /**
   * When it reaches (or reached) the CRM's Action required: a hand-off, a yes
   * that has not booked (a day after the link), a meeting to prepare (a day
   * before it). Null when nothing is due for a person.
   */
  actionRequiredAt: string | null;
  /** The booked meeting's start, while booked. */
  meetingAt: string | null;
  lastOutcome: { outcome: AgentOutcomeKind; summary: string | null; at: string } | null;
  calls: number;
  numberName: string | null;
  /** Extra instructions for calls to this lead, on top of the campaign's. */
  instructions: string | null;
};

export type ListAiLeadsResponse = { leads: AiCampaignLead[]; total: number; page: number; pageSize: number };

export type AiLeadAction = "stop" | "requeue";
/** Stop or requeue the lead, or set its own instructions (null clears them). */
export type UpdateAiLeadRequest = { action: AiLeadAction } | { instructions: string | null };
export const AI_LEAD_MAX_INSTRUCTIONS = 2_000;

/**
 * POST …/leads/:contactId/call — a call to this lead now, outside the
 * sequence: the AI agent's (no body), or with `remoteRep` the rep's own,
 * talking from their tab through the campaign's number.
 */
export type CallAiLeadRequest = { remoteRep?: boolean | null };
export type CallAiLeadResponse = { callId: string; numberName: string | null };

export type AddAiCampaignPeopleResponse = { requested: number; added: number; skippedDuplicate: number; skippedMissingPhone: number };
export type AiLeadsImportResponse = { added: number; alreadyInCampaign: number; skipped: string[] };

/** What a call amounted to, as the activity feed shows it. */
export type AiActivityCallResult = "queued" | "in_progress" | "connected" | "no_answer" | "not_on_whatsapp" | "failed";

/**
 * One thing that happened with the lead's person — a call or a WhatsApp
 * message, from this campaign or anywhere else (a rep's call, another
 * campaign, a reply) — or a campaign step that failed before either existed.
 */
export type AiLeadActivity = {
  id: string;
  at: string;
  kind: "call" | "message" | "step";
  /** This campaign's step it was ("Reach them · Call 1 of 3"), or null. */
  stepLabel: string | null;
  /** The same step as data, so screens can word it in the interface language. */
  stepRef: AiStepRef | null;
  /** Another calling campaign it belongs to, or null. */
  campaignName: string | null;
  call: {
    id: string;
    status: CallStatus;
    /** rep: a rep's own call; agent: the AI agent in a rep's browser; agent_cloud: the AI agent on a calling number. */
    mode: "rep" | "agent" | "agent_cloud";
    /** A cloud call a rep talked on from AgentSDR, through the calling number (no agent). */
    remoteRep: boolean;
    /** inbound: they called the number back and the AI agent answered. */
    direction: "outbound" | "inbound";
    /** The calling number it went out from (cloud calls). */
    numberName: string | null;
    result: AiActivityCallResult;
    durationMs: number | null;
    error: string | null;
    hasRecording: boolean;
    recordingOffsetMs: number | null;
    transcriptStatus: string;
    outcome: { outcome: AgentOutcomeKind; summary: string | null; when: string | null } | null;
  } | null;
  message: {
    direction: "inbound" | "outbound";
    /** lead: they wrote; agentsdr: sent from AgentSDR; phone: typed on the phone or in WhatsApp Web. */
    origin: "lead" | "agentsdr" | "phone";
    body: string;
    /** The WhatsApp number it went through. */
    numberName: string | null;
    /** Messages sent through a calling number: where delivery stands. Null: sent (or received). */
    delivery: "queued" | "sending" | "failed" | "uncertain" | null;
    error: string | null;
  } | null;
  /** A step that failed before any call or message existed: why. */
  error: string | null;
  /** When `error` is a built-in text rather than a stored reason: which one, so screens can word it. */
  errorKind?: "starting" | "notStarted" | null;
};

export type AiLeadActivitySummary = {
  calls: number;
  connected: number;
  messagesSent: number;
  messagesReceived: number;
  lastActivityAt: string | null;
  /** The person's CRM stage ("Interested"), or null. */
  crmStage: string | null;
};

/** The lead, and everything that happened with its person, newest first. */
export type AiLeadDetail = { lead: AiCampaignLead; activity: AiLeadActivity[]; summary: AiLeadActivitySummary };

export type AiStepStat = {
  key: string;
  phase: "reach" | "chase" | "system";
  stepId: string | null;
  kind: AiStepRunKind;
  label: string;
  /** The same label as data, so screens can word it in the interface language. */
  labelRef: AiStepRef;
  /** Runs started (including failed ones). */
  attempted: number;
  done: number;
  failed: number;
  /** Calls that ended in a real conversation. */
  conversations: number;
};

export type AiCampaignStats = {
  total: number;
  byStatus: Record<AiContactStatus, number>;
  callsPlaced: number;
  callsAnswered: number;
  conversations: number;
  outcomes: Partial<Record<AgentOutcomeKind, number>>;
  /** Leads with a call that ended interested, meeting agreed or wanting the team to call. */
  interested: number;
  messagesSent: number;
  booked: number;
  handoffs: number;
  callsToday: number;
  callsPerDayLimit: number;
  perStep: AiStepStat[];
  callsByDay: Array<{ date: string; placed: number; answered: number }>;
};

export type AiLaunchCheck = {
  numbers: number;
  steps: AiCampaignStep[];
  instructions: string;
  goal: AiCampaignGoal;
  bookingUrl: string | null;
  leads: number;
};

export type AiLaunchProblem = { code: "noNumber" | "noCall" | "noInstructions" | "noBooking" | "noLeads" };

/** Why a campaign cannot launch yet, as a code, or null. The screens word it from the catalog. */
export function aiLaunchProblem(input: AiLaunchCheck): AiLaunchProblem | null {
  if (input.numbers === 0) return { code: "noNumber" };
  if (!input.steps.some((step) => step.kind === "call")) return { code: "noCall" };
  if (!input.instructions.trim()) return { code: "noInstructions" };
  if (input.goal !== "human_callback" && !input.bookingUrl) return { code: "noBooking" };
  if (input.leads === 0) return { code: "noLeads" };
  return null;
}

/** The launch problem in English, for the API. */
export function aiLaunchProblemText(problem: AiLaunchProblem): string {
  switch (problem.code) {
    case "noNumber":
      return "Choose at least one calling number";
    case "noCall":
      return "Add at least one call to the sequence";
    case "noInstructions":
      return "Write the campaign instructions (what every call is about)";
    case "noBooking":
      return "Add the booking link, or set the goal to hand over to the team";
    case "noLeads":
      return "Add at least one lead";
  }
}

/** Why a campaign cannot launch yet, or null. The API runs the same check. */
export function aiLaunchBlocker(input: AiLaunchCheck): string | null {
  const problem = aiLaunchProblem(input);
  return problem ? aiLaunchProblemText(problem) : null;
}

/** An https URL as people paste it ("https://cal.com/acme/30min"), or null when it is not one. */
export function httpsUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

export type AiSettingsProblem =
  | { code: "goal" }
  | { code: "instructionsLong"; max: number }
  | { code: "bookingUrl" }
  | { code: "bookingMessageLong"; max: number }
  | { code: "bookingMessageToken" }
  | { code: "callbacks"; max: number };

type AiSettingsInput = Pick<AiCampaignSettings, "goal" | "instructions" | "bookingUrl" | "bookingMessage" | "maxCallbacks">;

/** Problems with the campaign's settings as a code (null = fine); for the form. */
export function aiSettingsProblem(settings: AiSettingsInput): AiSettingsProblem | null {
  if (!(AI_CAMPAIGN_GOALS as readonly string[]).includes(settings.goal)) return { code: "goal" };
  if (settings.instructions.length > AI_CAMPAIGN_MAX_INSTRUCTIONS) return { code: "instructionsLong", max: AI_CAMPAIGN_MAX_INSTRUCTIONS };
  if (settings.bookingUrl && !httpsUrl(settings.bookingUrl)) return { code: "bookingUrl" };
  if (settings.bookingMessage.length > AI_CAMPAIGN_MAX_BOOKING_MESSAGE) return { code: "bookingMessageLong", max: AI_CAMPAIGN_MAX_BOOKING_MESSAGE };
  if (settings.bookingUrl && !settings.bookingMessage.includes("{{bookingLink}}")) return { code: "bookingMessageToken" };
  if (!Number.isInteger(settings.maxCallbacks) || settings.maxCallbacks < 0 || settings.maxCallbacks > AI_CAMPAIGN_MAX_CALLBACKS) {
    return { code: "callbacks", max: AI_CAMPAIGN_MAX_CALLBACKS };
  }
  return null;
}

/** The settings problem in English, for the API. */
export function aiSettingsProblemText(problem: AiSettingsProblem): string {
  switch (problem.code) {
    case "goal":
      return "Choose what the calls are for";
    case "instructionsLong":
      return `Instructions must be at most ${problem.max} characters`;
    case "bookingUrl":
      return "The booking link must be an https:// address";
    case "bookingMessageLong":
      return `The booking message must be at most ${problem.max} characters`;
    case "bookingMessageToken":
      return "The booking message must include {{bookingLink}}";
    case "callbacks":
      return `Call-backs must be between 0 and ${problem.max}`;
  }
}

/** Problems with the campaign's settings (null = fine); for the API. */
export function aiSettingsError(settings: AiSettingsInput): string | null {
  const problem = aiSettingsProblem(settings);
  return problem ? aiSettingsProblemText(problem) : null;
}

/** A problem with one of the two sequences: which one, and what is wrong in it. */
export type AiSequencesProblem = { sequence: "reach" | "chase"; problem: AiStepsProblem };

/** Both sequences as a typed problem, for the editor's save button. The chase may be empty. */
export function aiSequencesProblem(steps: unknown, chaseSteps: unknown): AiSequencesProblem | null {
  const reach = aiCampaignStepsProblem(steps);
  if (reach) return { sequence: "reach", problem: reach };
  const chase = aiCampaignStepsProblem(chaseSteps, { allowEmpty: true });
  if (chase) return { sequence: "chase", problem: chase };
  return null;
}

/** Both sequences, for the API. The chase may be empty. */
export function aiSequencesError(steps: unknown, chaseSteps: unknown): string | null {
  const found = aiSequencesProblem(steps, chaseSteps);
  if (!found) return null;
  const text = aiStepsProblemText(found.problem);
  return found.sequence === "reach" ? `Reach them: ${text}` : `If they said yes but haven't booked: ${text}`;
}

/** draft until launched, then the stored status. */
export function aiCampaignState(row: { launchedAt: string | Date | null; status: CallCampaignStatus }): AiCampaignState {
  if (!row.launchedAt) return "draft";
  return row.status === "paused" ? "paused" : "active";
}

export const AI_CAMPAIGN_STATE_LABELS: Record<AiCampaignState, string> = { draft: "Draft", active: "Active", paused: "Paused" };

/** Where a step sits among its kind: the 2nd of 4 calls. `chase`: it is in the sequence after a yes. */
export type AiStepPosition = { kind: "call" | "message"; index: number; total: number; chase: boolean };

/** The step at `index` of `steps` as data, or null when there is none. */
export function aiStepPosition(steps: AiCampaignStep[], index: number, chase: boolean): AiStepPosition | null {
  const step = steps[index];
  if (!step) return null;
  const kindIndex = steps.slice(0, index + 1).filter((candidate) => candidate.kind === step.kind).length;
  const kindTotal = steps.filter((candidate) => candidate.kind === step.kind).length;
  return { kind: step.kind, index: kindIndex, total: kindTotal, chase };
}

/** "Call 2 of 4" for a step position (English, for the API). */
export function aiStepPositionLabel(position: AiStepPosition): string {
  return `${position.kind === "call" ? "Call" : "Message"} ${position.index} of ${position.total}${position.chase ? " (chasing the booking)" : ""}`;
}

/** "Call 2 of 4" for the step at `index` of `steps` (English, for the API). */
export function aiStepLabel(steps: AiCampaignStep[], index: number, chase: boolean): string | null {
  const position = aiStepPosition(steps, index, chase);
  return position ? aiStepPositionLabel(position) : null;
}

/** Where a lead is in its sequence, as data: a step, or the nth call-back. */
export type AiLeadStepRef = { type: "step"; position: AiStepPosition } | { type: "callback"; n: number };

/** A lead's current step as the English line the API has always sent; the screens word the same ref themselves. */
export function aiLeadStepLabel(ref: AiLeadStepRef | null): string | null {
  if (!ref) return null;
  return ref.type === "callback" ? `Call back ${ref.n}` : aiStepPositionLabel(ref.position);
}

/** A step the engine runs outside the configured sequences. */
export type AiSystemStep =
  | { type: "callback"; n: string }
  | { type: "bookingLink" }
  | { type: "inbound" }
  | { type: "now" }
  | { type: "other"; key: string };

/**
 * A step run as data: a configured step (`position` null when the step is gone
 * from the sequence; `removed` when it was deleted) or one of the engine's own.
 */
export type AiStepRef =
  | { type: "step"; phase: "reach" | "chase"; position: AiStepPosition | null; removed?: boolean }
  | { type: "system"; system: AiSystemStep };

/** The step key the engine stores for a step run, and what it means. */
export function describeStepKey(stepKey: string): { phase: "reach" | "chase" | "system"; stepId: string | null; label: string; system?: AiSystemStep } {
  // "@<id>": a run from before the lead was queued again (requeue retires its key).
  const current = stepKey.replace(/@[0-9a-f]{8}$/, "");
  const retry = /^retry:(.+):\d+$/.exec(current);
  const key = retry ? retry[1]! : current;
  if (key.startsWith("reach:")) return { phase: "reach", stepId: key.slice(6), label: "Reach them" };
  if (key.startsWith("chase:")) return { phase: "chase", stepId: key.slice(6), label: "Chasing the booking" };
  if (key.startsWith("callback:")) return { phase: "system", stepId: null, label: `Call back ${key.slice(9)}`, system: { type: "callback", n: key.slice(9) } };
  if (key === "booking-link") return { phase: "system", stepId: null, label: "Booking link", system: { type: "bookingLink" } };
  if (key.startsWith("inbound:")) return { phase: "system", stepId: null, label: "They called back", system: { type: "inbound" } };
  if (key.startsWith("now:")) return { phase: "system", stepId: null, label: "AI call from the lead page", system: { type: "now" } };
  return { phase: "system", stepId: null, label: key, system: { type: "other", key } };
}

/** A starting point for a message's merge fields preview. */
export const AI_MESSAGE_FIELDS = [
  { token: "firstName", label: "First name", sample: "Priya" },
  { token: "company", label: "Company", sample: "Acme" },
  { token: "agentName", label: "Agent name", sample: "Riya" },
  { token: "bookingLink", label: "Booking link", sample: "https://cal.com/acme/30min" },
] as const;

/** A message with sample values in place of its merge fields; unknown tokens stay as written. */
export function previewAiMessage(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, token: string) => values[token] ?? match);
}

export const AI_EMPTY_STATUS_COUNTS: Record<AiContactStatus, number> = {
  queued: 0,
  reaching: 0,
  callback: 0,
  chasing: 0,
  booked: 0,
  handoff: 0,
  not_interested: 0,
  unreached: 0,
  replied: 0,
  stopped: 0,
  failed: 0,
};

/** Today's AI-calls-a-day figure for a station list. */
export function callsPerDayLimit(numbers: Array<Pick<AiCampaignNumber, "callsPerDay">>, ruleDefault: number): number {
  return numbers.reduce((sum, number) => sum + (number.callsPerDay ?? ruleDefault), 0);
}

// --- per-number AI calling settings (Settings → WhatsApp → Calling numbers) ---

/** A calling number's own AI calls-a-day and calling hours; null = the organization's rule. */
export type StationAiSettings = {
  stationId: string;
  callsPerDay: number | null;
  callingHours: WeeklyHours | null;
};

export type StationAiSettingsResponse = {
  settings: StationAiSettings[];
  /** The organization's Sending rules these fall back to. */
  rules: { callsPerDay: number; callingHours: WeeklyHours };
};

export type UpdateStationAiSettingsRequest = {
  callsPerDay?: number | null;
  callingHours?: WeeklyHours | null;
};
