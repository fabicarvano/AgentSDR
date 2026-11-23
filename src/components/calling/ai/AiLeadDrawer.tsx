"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  RiArrowDownSLine,
  RiChat1Line,
  RiErrorWarningLine,
  RiLoader4Line,
  RiPhoneLine,
  RiPlayCircleLine,
  RiRobot2Line,
  RiStopCircleLine,
  RiVoiceprintLine,
} from "@remixicon/react";
import { useTranslations } from "next-intl";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Modal from "@/components/alignui/modal";
import * as Textarea from "@/components/alignui/textarea";
import { useDialogs } from "@/components/DialogProvider";
import { AgentOutcomeLine } from "@/components/calls/AgentOutcomeLine";
import { AgentVoiceRehearsal } from "@/components/calls/AgentVoiceRehearsal";
import { RecordingPlayer } from "@/components/calls/RecordingPlayer";
import { isRemoteRepCallActive, startRemoteRepCall, subscribeRemoteRepCall } from "@/components/calls/remoteRepCall";
import { formatOffset } from "@/components/calls/formatElapsed";
import { Skeleton } from "@/components/page/Skeletons";
import { AI_LEAD_MAX_INSTRUCTIONS, type AiActivityCallResult, type AiLeadActivity, type AiLeadDetail } from "@/lib/calls/aiCampaigns/api";
import { callAiLead, getAiLead, updateAiLead } from "@/lib/calls/aiCampaigns/client";
import { getCall } from "@/lib/calls/client";
import type { AgentOutcomeKind, CallDetail } from "@/lib/calls/contract";
import type { Messages } from "@/i18n/catalog";
import { useAnalyticsFormat } from "@/components/analytics/useAnalyticsFormat";
import { cn } from "@/utils/cn";
import { AiStatusBadge, errorText, useAiFormat } from "./aiShared";
import { useAiStepText } from "./useAiServerText";

/** While a call is queued or on, the sheet refreshes this often. */
const LIVE_REFRESH_MS = 5_000;

type DrawerMessages = Messages["callingAiWork"]["drawer"];
type SharedMessages = DrawerMessages;

const CALL_RESULT: Record<AiActivityCallResult, { labelKey: keyof DrawerMessages["callResult"]; color: "green" | "gray" | "orange" | "red" | "blue" }> = {
  queued: { labelKey: "queued", color: "blue" },
  in_progress: { labelKey: "inProgress", color: "blue" },
  connected: { labelKey: "connected", color: "green" },
  no_answer: { labelKey: "noAnswer", color: "gray" },
  not_on_whatsapp: { labelKey: "notOnWhatsapp", color: "orange" },
  failed: { labelKey: "failed", color: "red" },
};

const CALL_MODE_KEY = { rep: "rep", agent: "agentLaptop", agent_cloud: "agentCloud" } as const satisfies Record<"rep" | "agent" | "agent_cloud", keyof DrawerMessages["callMode"]>;

const MESSAGE_ORIGIN_KEY = { lead: "lead", agentsdr: "agentsdr", phone: "phone" } as const satisfies Record<"lead" | "agentsdr" | "phone", keyof DrawerMessages["messageOrigin"]>;

const DELIVERY: Record<"queued" | "sending" | "failed" | "uncertain", { labelKey: keyof DrawerMessages["delivery"]; color: "blue" | "red" | "orange" }> = {
  queued: { labelKey: "queued", color: "blue" },
  sending: { labelKey: "sending", color: "blue" },
  failed: { labelKey: "failed", color: "red" },
  uncertain: { labelKey: "uncertain", color: "orange" },
};

// Copy of AGENT_OUTCOME_LABELS (lib/calls/contract.ts) as typed keys; the lib text stays English for the API.
const OUTCOME_KEY: Record<AgentOutcomeKind, keyof SharedMessages["outcome"]> = {
  meeting_booked: "meetingBooked",
  interested: "interested",
  human_callback: "humanCallback",
  call_back: "callBack",
  not_interested: "notInterested",
  wrong_person: "wrongPerson",
  do_not_contact: "doNotContact",
  no_response: "noResponse",
  other: "other",
};

/** The label of a call outcome (also used by the Leads tab and Overview). */
export function useAiOutcomeLabel(): (outcome: AgentOutcomeKind) => string {
  const t = useTranslations("callingAiWork.drawer");
  return (outcome) => {
    const key = OUTCOME_KEY[outcome] as keyof SharedMessages["outcome"] | undefined;
    return key ? t(`outcome.${key}`) : outcome;
  };
}

/**
 * A lead's side sheet: where it stands in the campaign, trying a call on it
 * (a rehearsal in the browser, or a real call now), its own instructions, and
 * everything that happened with the person — every call and WhatsApp message,
 * from this campaign or anywhere else, newest first.
 */
export function AiLeadDrawer({
  campaignId,
  contactId,
  onClose,
  onChanged,
}: {
  campaignId: string;
  contactId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("callingAiWork.drawer");
  const stepText = useAiStepText();
  const { formatWhen, actionRequiredText } = useAiFormat();
  const dialogs = useDialogs();
  const [detail, setDetail] = useState<AiLeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"stop" | "requeue" | "call" | "ai-call" | "instructions" | null>(null);
  // The rep's own call through a number (remoteRepCall.ts) — any lead's: there is one microphone.
  const repCallOn = useSyncExternalStore(subscribeRemoteRepCall, isRemoteRepCallActive, () => false);
  const [rehearsing, setRehearsing] = useState(false);
  const [instructions, setInstructions] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getAiLead(campaignId, contactId);
      setDetail(next);
      setInstructions((current) => current ?? next.lead.instructions ?? "");
      setError(null);
    } catch (cause) {
      setError(errorText(cause, t("loadFailed")));
    }
  }, [campaignId, contactId, t]);

  useEffect(() => {
    // Fetch on open; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // A call queued or on: keep the feed current until it ends.
  const live = !!detail?.activity.some((entry) => entry.call && (entry.call.result === "queued" || entry.call.result === "in_progress"));
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => void load(), LIVE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [live, load]);

  async function act(action: "stop" | "requeue") {
    setBusy(action);
    setError(null);
    try {
      await updateAiLead(campaignId, contactId, { action });
      await load();
      onChanged();
    } catch (cause) {
      setError(errorText(cause, t("updateFailed")));
    } finally {
      setBusy(null);
    }
  }

  /** The rep's own call: they talk from this tab, through the campaign's number. */
  async function callNow() {
    const lead = detail?.lead;
    if (!lead) return;
    const who = lead.name || lead.phone;
    const confirmed = await dialogs.confirm({
      title: t("callConfirmTitle", { who }),
      description: t("callConfirmBody", { who, number: lead.numberName ?? t("firstActiveNumber") }),
      confirmLabel: t("callNow"),
    });
    if (!confirmed) return;
    setBusy("call");
    setError(null);
    setNotice(null);
    try {
      // How it goes (or why it did not) shows in the call bar.
      const callId = await startRemoteRepCall({
        leadName: who,
        numberName: lead.numberName,
        place: () => callAiLead(campaignId, contactId, { remoteRep: true }),
      });
      if (callId) {
        await load();
        onChanged();
      }
    } catch (cause) {
      setError(errorText(cause, t("callFailed")));
    } finally {
      setBusy(null);
    }
  }

  async function aiCall() {
    const lead = detail?.lead;
    if (!lead) return;
    const confirmed = await dialogs.confirm({
      title: t("aiCallConfirmTitle", { who: lead.name || lead.phone }),
      description: t("aiCallConfirmBody", { phone: lead.phone, own: lead.instructions ? "yes" : "no" }),
      confirmLabel: t("aiCall"),
    });
    if (!confirmed) return;
    setBusy("ai-call");
    setError(null);
    setNotice(null);
    try {
      const placed = await callAiLead(campaignId, contactId);
      setNotice(t("aiCallStarted", { number: placed.numberName ?? t("campaignNumber") }));
      await load();
      onChanged();
    } catch (cause) {
      setError(errorText(cause, t("callFailed")));
    } finally {
      setBusy(null);
    }
  }

  async function saveInstructions() {
    setBusy("instructions");
    setError(null);
    try {
      const { lead } = await updateAiLead(campaignId, contactId, { instructions: instructions?.trim() || null });
      setDetail((current) => (current ? { ...current, lead } : current));
      setInstructions(lead.instructions ?? "");
    } catch (cause) {
      setError(errorText(cause, t("saveInstructionsFailed")));
    } finally {
      setBusy(null);
    }
  }

  const lead = detail?.lead ?? null;
  const summary = detail?.summary ?? null;
  const open = lead && ["queued", "reaching", "callback", "chasing"].includes(lead.status);
  const requeueable = lead && (lead.status === "failed" || lead.status === "unreached" || (lead.status === "stopped" && (lead.note ?? "").startsWith("Stopped by ")));
  const instructionsDirty = lead !== null && instructions !== null && instructions.trim() !== (lead.instructions ?? "");
  const firstName = lead?.name?.split(/\s+/)[0] || t("fallbackName");

  return (
    <Modal.Root open onOpenChange={(next) => { if (!next) onClose(); }}>
      <Modal.SideContent size="max-w-xl">
        <Modal.Header>
          <div className="min-w-0">
            <Modal.Title className="truncate">{lead ? lead.name || t("unnamedLead") : t("loading")}</Modal.Title>
            <Modal.Description className="mt-0.5 truncate text-paragraph-xs tabular-nums text-text-sub-600">
              {lead ? [lead.phone, lead.title, lead.companyName].filter(Boolean).join(" · ") : " "}
            </Modal.Description>
          </div>
        </Modal.Header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-lg bg-error-lighter px-3 py-2 text-paragraph-xs text-error-dark ring-1 ring-inset ring-error-light">{error}</p>}
          {notice && <p role="status" className="rounded-lg bg-information-lighter px-3 py-2 text-paragraph-xs text-information-dark ring-1 ring-inset ring-information-light">{notice}</p>}
          {!lead || !summary ? (
            !error && (
              <div aria-busy="true" aria-label={t("loading")} className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            )
          ) : (
            <>
              <section className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <AiStatusBadge status={lead.status} />
                  {lead.currentStep && <span className="text-paragraph-sm text-text-sub-600">{lead.currentStepRef ? stepText.lead(lead.currentStepRef) : lead.currentStep}</span>}
                  {lead.numberName && <span className="text-paragraph-xs text-text-soft-400">{t("fromNumber", { name: lead.numberName })}</span>}
                </div>
                {lead.nextAt && <p className="text-paragraph-sm text-text-sub-600" suppressHydrationWarning>{t("nextAction", { when: formatWhen(lead.nextAt) })}</p>}
                {lead.note && <p className="text-paragraph-sm text-text-sub-600">{lead.note}</p>}
                {lead.meetingAt && <p className="text-paragraph-sm text-text-sub-600" suppressHydrationWarning>{t("meeting", { when: formatWhen(lead.meetingAt) })}</p>}
                {lead.actionRequiredAt && <p className="text-paragraph-sm text-text-sub-600" suppressHydrationWarning>{actionRequiredText(lead.actionRequiredAt)}</p>}
                <dl className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-paragraph-xs text-text-sub-600">
                  <Stat label={t("statCalls")} value={summary.calls} />
                  <Stat label={t("statConnected")} value={summary.connected} />
                  <Stat label={t("statMessagesSent")} value={summary.messagesSent} />
                  <Stat label={t("statReplies")} value={summary.messagesReceived} />
                  {summary.crmStage && (
                    <div className="flex gap-1">
                      <dt>{t("crmStage")}</dt>
                      <dd className="text-label-xs text-text-strong-950">{summary.crmStage}</dd>
                    </div>
                  )}
                </dl>
                {(open || requeueable) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {open && (
                      <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy !== null} onClick={() => void act("stop")}>
                        <Button.Icon as={busy === "stop" ? RiLoader4Line : RiStopCircleLine} className={cn(busy === "stop" && "animate-spin")} />
                        {t("stopLead")}
                      </Button.Root>
                    )}
                    {requeueable && (
                      <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy !== null} onClick={() => void act("requeue")}>
                        <Button.Icon as={busy === "requeue" ? RiLoader4Line : RiPlayCircleLine} className={cn(busy === "requeue" && "animate-spin")} />
                        {t("queueAgain")}
                      </Button.Root>
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-label-sm text-text-strong-950">{t("tryCallTitle")}</h3>
                <p className="text-paragraph-xs text-text-sub-600">
                  {t("tryCallBody", { name: firstName })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button.Root variant="neutral" mode="stroke" size="xsmall" aria-expanded={rehearsing} onClick={() => setRehearsing((current) => !current)}>
                    <Button.Icon as={RiVoiceprintLine} />
                    {rehearsing ? t("closeRehearsal") : t("rehearse")}
                  </Button.Root>
                  <Button.Root variant="primary" mode="filled" size="xsmall" disabled={busy !== null || live || repCallOn} onClick={() => void callNow()}>
                    <Button.Icon as={busy === "call" ? RiLoader4Line : RiPhoneLine} className={cn(busy === "call" && "animate-spin")} />
                    {live || repCallOn ? t("callOn") : t("callNow")}
                  </Button.Root>
                  <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy !== null || live} onClick={() => void aiCall()}>
                    <Button.Icon as={busy === "ai-call" ? RiLoader4Line : RiRobot2Line} className={cn(busy === "ai-call" && "animate-spin")} />
                    {t("aiCall")}
                  </Button.Root>
                </div>
                {rehearsing && (
                  <div className="pt-1">
                    {instructionsDirty && <p className="mb-2 text-paragraph-xs text-warning-dark">{t("saveFirst")}</p>}
                    <AgentVoiceRehearsal campaignId={campaignId} contactId={contactId} />
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <label htmlFor="lead-instructions" className="block text-label-sm text-text-strong-950">{t("instructionsLabel")}</label>
                <p className="text-paragraph-xs text-text-sub-600">{t("instructionsHint", { name: firstName })}</p>
                <Textarea.Root
                  id="lead-instructions"
                  simple
                  rows={3}
                  maxLength={AI_LEAD_MAX_INSTRUCTIONS}
                  value={instructions ?? ""}
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder={t("instructionsPlaceholder")}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-paragraph-xs tabular-nums text-text-soft-400">{(instructions ?? "").length}/{AI_LEAD_MAX_INSTRUCTIONS}</span>
                  <div className="flex gap-2">
                    {instructionsDirty && (
                      <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy !== null} onClick={() => setInstructions(lead.instructions ?? "")}>
                        {t("discard")}
                      </Button.Root>
                    )}
                    <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={!instructionsDirty || busy !== null} onClick={() => void saveInstructions()}>
                      {busy === "instructions" ? t("saving") : t("save")}
                    </Button.Root>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-label-sm text-text-strong-950">{t("activity")}</h3>
                {detail!.activity.length === 0 ? (
                  <p className="mt-2 rounded-xl bg-bg-weak-50 p-4 text-paragraph-sm text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">
                    {t("noActivity", { name: firstName, queued: lead.status === "queued" ? "yes" : "no" })}
                  </p>
                ) : (
                  <ol className="mt-3 space-y-3 border-l border-stroke-soft-200 pl-4">
                    {detail!.activity.map((entry) => <ActivityEntry key={`${entry.kind}-${entry.id}`} entry={entry} />)}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </Modal.SideContent>
    </Modal.Root>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex gap-1">
      <dt>{label}</dt>
      <dd className="text-label-xs tabular-nums text-text-strong-950">{value}</dd>
    </div>
  );
}

function ActivityEntry({ entry }: { entry: AiLeadActivity }) {
  const t = useTranslations("callingAiWork.drawer");
  const stepText = useAiStepText();
  const stepLabel = entry.stepRef ? stepText.activity(entry.stepRef) : entry.stepLabel;
  const { formatWhen } = useAiFormat();
  const fmt = useAnalyticsFormat();
  const callTitle = (c: NonNullable<AiLeadActivity["call"]>): string => {
    if (c.direction === "inbound") return t("callInbound");
    if (c.remoteRep) return c.numberName ? t("callRepFrom", { number: c.numberName }) : t("callRepFromNumber");
    return t(`callMode.${CALL_MODE_KEY[c.mode]}`);
  };
  const Icon = entry.kind === "message" ? RiChat1Line : entry.kind === "call" ? RiPhoneLine : RiErrorWarningLine;
  const call = entry.call;
  const message = entry.message;
  const title = call
    ? callTitle(call)
    : message ? t(`messageOrigin.${MESSAGE_ORIGIN_KEY[message.origin]}`) : t("stepNotStarted");
  const length = call?.result === "connected" && call.durationMs && call.durationMs >= 1000 ? fmt.duration(call.durationMs) : null;
  const where = call?.numberName ?? message?.numberName ?? null;
  return (
    <li className="relative">
      <span className="absolute -left-[1.4rem] top-0.5 flex size-5 items-center justify-center rounded-full bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200">
        <Icon className="size-3 text-text-sub-600" aria-hidden="true" />
      </span>
      <div className="space-y-2 rounded-xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-label-sm text-text-strong-950">{title}</span>
          {call && (
            <Badge.Root size="small" variant="light" color={CALL_RESULT[call.result]?.color ?? "gray"}>
              {CALL_RESULT[call.result] ? t(`callResult.${CALL_RESULT[call.result].labelKey}`) : call.result}{length ? ` · ${length}` : ""}
            </Badge.Root>
          )}
          {message?.delivery && <Badge.Root size="small" variant="light" color={DELIVERY[message.delivery].color}>{t(`delivery.${DELIVERY[message.delivery].labelKey}`)}</Badge.Root>}
          <span className="ml-auto text-paragraph-xs tabular-nums text-text-soft-400" suppressHydrationWarning>{formatWhen(entry.at)}</span>
        </div>
        {(stepLabel || entry.campaignName || where) && (
          <p className="text-paragraph-xs text-text-sub-600">
            {[stepLabel, entry.campaignName ? t("campaignName", { name: entry.campaignName }) : null, where ? t(call?.direction === "inbound" ? "toNumber" : "viaNumber", { where }) : null].filter(Boolean).join(" · ")}
          </p>
        )}
        {entry.error && <p className="text-paragraph-xs text-error-dark">{entry.errorKind ? stepText.errorKind(entry.errorKind) : entry.error}</p>}
        {call?.error && call.result !== "connected" && <p className="text-paragraph-xs text-text-sub-600">{call.error}</p>}
        {message?.error && <p className="text-paragraph-xs text-error-dark">{message.error}</p>}
        {message && message.body && (
          <p
            className={cn(
              "max-w-md whitespace-pre-wrap break-words rounded-xl px-3.5 py-2.5 text-paragraph-sm leading-6 text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200",
              message.direction === "inbound" ? "rounded-tl-sm bg-bg-white-0" : "ml-auto rounded-tr-sm bg-information-lighter",
            )}
          >
            {message.body}
          </p>
        )}
        {call?.outcome && <AgentOutcomeLine outcome={{ ...call.outcome, recordedAt: entry.at }} />}
        {call?.hasRecording && <RecordingPlayer callId={call.id} offsetMs={call.recordingOffsetMs} />}
        {call && call.transcriptStatus === "done" && <Transcript callId={call.id} />}
      </div>
    </li>
  );
}

/** The call's transcript, fetched when opened. */
function Transcript({ callId }: { callId: string }) {
  const t = useTranslations("callingAiWork.drawer");
  const [open, setOpen] = useState(false);
  const [call, setCall] = useState<CallDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !call) {
      try {
        setCall(await getCall(callId));
      } catch (cause) {
        setError(errorText(cause, t("loadTranscriptFailed")));
      }
    }
  }

  return (
    <div>
      <Button.Root variant="neutral" mode="ghost" size="xxsmall" className="-ml-2 gap-1.5 text-label-xs" aria-expanded={open} onClick={() => void toggle()}>
        <RiArrowDownSLine className={cn("size-3.5 transition", open && "rotate-180")} aria-hidden="true" />
        {open ? t("hideTranscript") : t("showTranscript")}
      </Button.Root>
      {open && (
        <div className="mt-1 space-y-1.5 rounded-lg bg-bg-white-0 p-3 ring-1 ring-inset ring-stroke-soft-200">
          {error && <p className="text-paragraph-xs text-error-dark">{error}</p>}
          {!call && !error && <p className="flex items-center gap-1.5 text-paragraph-xs text-text-sub-600"><RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />{t("loading")}</p>}
          {call?.transcript?.summary && <p className="pb-1 text-paragraph-xs text-text-sub-600">{call.transcript.summary}</p>}
          {call?.transcript?.utterances.map((utterance, index) => (
            <div key={index} className="flex gap-2 text-paragraph-xs">
              <span className="w-12 shrink-0 text-text-soft-400">{formatOffset(utterance.startSeconds)}</span>
              <span className={utterance.speaker === "rep" ? "w-10 shrink-0 font-medium text-information-base" : "w-10 shrink-0 font-medium text-text-sub-600"}>
                {utterance.speaker === "rep" ? (call.mode === "rep" || call.remoteRep ? t("speakerRep") : t("speakerAgent")) : t("speakerLead")}
              </span>
              <span className="text-text-strong-950">{utterance.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
