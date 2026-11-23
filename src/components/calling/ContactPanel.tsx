"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRefreshOnReturn } from "./useRefreshOnReturn";
import { useTranslations } from "next-intl";
import {
  RiArrowDownSLine,
  RiDeleteBinLine,
  RiMailLine,
  RiFileTextLine,
  RiLoader4Line,
  RiMoreLine,
  RiPencilLine,
  RiPhoneLine,
  RiRefreshLine,
  RiSendPlaneLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as Select from "@/components/alignui/select";
import * as Textarea from "@/components/alignui/textarea";
import { ErrorState } from "@/components/analytics/kit/ErrorState";
import { Skeleton } from "@/components/page/Skeletons";
import { useCrmText } from "@/components/crm/useCrmText";
import { CallButton } from "@/components/calls/CallButton";
import { LiveCallStrip } from "@/components/calls/LiveCallStrip";
import { useLatestLiveCall, useLiveCall } from "@/components/calls/useLiveCall";
import {
  getCampaignContact,
  logCallMessage,
  openWhatsAppMessage,
  removeCampaignContact,
  transcribeCall,
  updateCampaignContact,
} from "@/lib/calls/client";
import {
  CONTACT_CALL_STATUSES,
  CONTACT_CALL_STATUS_DEFINITIONS,
  type CallDetail,
  type ContactCallStatus,
  type CampaignContact,
  type CampaignContactDetailResponse,
} from "@/lib/calls/contract";
import { transcriptLooksStuck } from "@/lib/calls/transcriptState";
import { followUpMessageFor } from "@/lib/calls/templates";
import { selectLiveCallId } from "@/components/calling/liveCallSelection";
import { formatCallDuration, formatOffset } from "@/components/calls/formatElapsed";
import { CALL_POLL_INTERVAL_MS, CALL_POLL_TIMEOUT_MS } from "@/components/calls/polling";
import { RecordingPlayer } from "@/components/calls/RecordingPlayer";
import { PersonWhatsappPanel } from "@/components/whatsapp/PersonWhatsappPanel";
import { EditContactModal } from "@/components/calling/EditContactModal";
import { Avatar, CallStatusBadge, LeadStagePicker, titleAtCompany, useCallingHints, useCallingLabels, useCrmCategories } from "@/components/calling/callingShared";
import { CallSessionBadge } from "@/components/calls/CallSessionBadge";
import { FormError } from "@/components/calls/fields";


/** For the datetime-local input: local time, no timezone/seconds. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ContactPanel({
  contactId,
  onClose,
  onChanged,
}: {
  contactId: string;
  onClose: () => void;
  /** Called after any save that can move the contact between tabs, so the table behind refreshes. */
  onChanged?: () => void;
}) {
  const t = useTranslations("callingMain.panel");
  const tShared = useTranslations("callingMain.shared");
  const { errorMessage, formatDate } = useCrmText();
  const { callStatusLabel } = useCallingLabels();
  const { attemptHint } = useCallingHints();
  const [detail, setDetail] = useState<CampaignContactDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await getCampaignContact(contactId);
      setDetail(response);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [contactId, errorMessage]);

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    void load();
  }, [load]);
  useRefreshOnReturn(load);

  // Notes are re-synced from the server once per contact — not on every poll
  // refresh, or a rep mid-edit would have their draft overwritten.
  const [notes, setNotes] = useState("");
  const notesInitializedFor = useRef<string | null>(null);
  useEffect(() => {
    if (detail && notesInitializedFor.current !== contactId) {
      setNotes(detail.contact.notes ?? "");
      notesInitializedFor.current = contactId;
    }
  }, [detail, contactId]);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState("");

  const sortedCalls = useMemo(
    () => [...(detail?.calls ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [detail],
  );
  const sortedMessages = useMemo(
    () => [...(detail?.messages ?? [])].sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    [detail],
  );
  const latestCall = sortedCalls[0] ?? null;

  // --- Live call strip: which call (if any) the extension is reporting on -
  // Prefers this contact's own latest call once it's loaded and in flight or
  // just placed; falls back to whatever call most recently pushed an update
  // in this tab, for the window before the panel's own poll has caught up.
  const latestLiveCall = useLatestLiveCall();
  const callIds = useMemo(() => sortedCalls.map((call) => call.id), [sortedCalls]);
  const liveCallId = selectLiveCallId({ latestCall, callIds, latestLiveCallId: latestLiveCall?.callId ?? null });
  const livePhase = useLiveCall(liveCallId);
  const lastRefreshedPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!livePhase) {
      lastRefreshedPhaseRef.current = null;
      return;
    }
    // These phases mean the calls list / outcome UI is now stale — the call
    // ended (one way or another) or moved into post-call processing.
    const catchesUpUi =
      livePhase.kind === "not-answered" ||
      livePhase.kind === "not-on-whatsapp" ||
      livePhase.kind === "done" ||
      livePhase.kind === "error" ||
      livePhase.kind === "processing";
    if (!catchesUpUi) {
      lastRefreshedPhaseRef.current = null;
      return;
    }
    // Dedupe on (call, phase, step) so a repeated push of the same phase
    // doesn't reload on every message, but "processing" moving from
    // uploading to transcribing still gets its own refresh.
    const key = `${liveCallId}:${livePhase.kind}:${"step" in livePhase ? livePhase.step : ""}`;
    if (lastRefreshedPhaseRef.current === key) return;
    lastRefreshedPhaseRef.current = key;
    void load();
  }, [livePhase, liveCallId, load]);

  // --- Polling: while a call is in flight or a transcript is pending -----
  const shouldPoll =
    (latestCall != null && (latestCall.status === "pending" || latestCall.status === "in_progress")) ||
    sortedCalls.some((call) => call.transcriptStatus === "pending");
  const pollStartedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!shouldPoll) {
      pollStartedAt.current = null;
      return;
    }
    pollStartedAt.current ??= Date.now();
    const interval = setInterval(() => {
      const startedAt = pollStartedAt.current;
      if (startedAt != null && Date.now() - startedAt > CALL_POLL_TIMEOUT_MS) {
        clearInterval(interval);
        return;
      }
      void load();
    }, CALL_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [shouldPoll, load]);

  // --- Call status, follow-up, message ------------------------------------
  const categories = useCrmCategories();
  const [followUpAt, setFollowUpAt] = useState("");
  const [savingField, setSavingField] = useState<"status" | "followUp" | null>(null);
  const [outcomeError, setOutcomeError] = useState("");
  // Bumped by each call-status template so the WhatsApp composer re-prefills.
  const [prefill, setPrefill] = useState<{ key: number; text: string } | null>(null);

  // The date input mirrors the server's value whenever it changes there (a
  // call rescheduled it), but is left alone while the rep has an unsaved edit.
  const serverFollowUp = detail?.contact.followUpAt ?? null;
  useEffect(() => {
    setFollowUpAt(toDatetimeLocal(serverFollowUp));
  }, [serverFollowUp]);

  const offerFollowUp = (status: ContactCallStatus) => {
    if (!detail) return;
    const message = followUpMessageFor(status, {
      firstName: detail.contact.person.firstName,
      fullName: detail.contact.person.fullName,
    });
    if (message !== null) setPrefill((current) => ({ key: (current?.key ?? 0) + 1, text: message }));
  };

  const saveCallStatus = async (status: ContactCallStatus) => {
    if (!detail || status === detail.contact.callStatus) return;
    setSavingField("status");
    setOutcomeError("");
    try {
      await updateCampaignContact(contactId, { callStatus: status });
      offerFollowUp(status);
      await load();
      onChanged?.();
    } catch (cause) {
      setOutcomeError(errorMessage(cause));
    } finally {
      setSavingField(null);
    }
  };

  const saveFollowUp = async (value: string) => {
    setSavingField("followUp");
    setOutcomeError("");
    try {
      await updateCampaignContact(contactId, { followUpAt: value ? new Date(value).toISOString() : null });
      await load();
      onChanged?.();
    } catch (cause) {
      setOutcomeError(errorMessage(cause));
    } finally {
      setSavingField(null);
    }
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    setNotesError("");
    try {
      await updateCampaignContact(contactId, { notes: notes.trim() || null });
      await load();
      onChanged?.();
    } catch (cause) {
      setNotesError(errorMessage(cause));
    } finally {
      setNotesSaving(false);
    }
  };

  // No linked number: the old flow — log the message, open WhatsApp Web with it prefilled.
  const openInWhatsAppWeb = async (text: string) => {
    const phone = detail?.contact.person.phone;
    if (!phone) throw new Error(t("noPhoneError"));
    await logCallMessage(contactId, { body: text, callId: latestCall?.id ?? null });
    await openWhatsAppMessage(phone, text);
  };

  const [retryingCallId, setRetryingCallId] = useState<string | null>(null);
  const retryTranscript = async (callId: string) => {
    setRetryingCallId(callId);
    try {
      await transcribeCall(callId);
      await load();
    } catch {
      // The call row's status still shows "failed" — the rep can retry again.
    } finally {
      setRetryingCallId(null);
    }
  };

  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const contact = detail?.contact ?? null;
  const person = contact?.person ?? null;
  const name = person ? person.fullName || person.firstName || tShared("unnamedContact") : "";

  return (
    <>
    <Modal.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.SideContent size="max-w-xl">
        <Modal.Header>
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              {person ? (
                <Avatar name={name} src={person.profilePictureUrl} className="size-10 text-label-sm" />
              ) : (
                <Skeleton className="size-10 shrink-0 rounded-full" />
              )}
              <div className="min-w-0">
                <Modal.Title className="truncate">{loading ? t("loading") : name || t("contactFallback")}</Modal.Title>
                {person && <Modal.Description className="mt-0.5 truncate">{titleAtCompany(person) ?? (person.companyWebsite || person.phone || undefined)}</Modal.Description>}
              </div>
            </div>
            {contact && (
              <Dropdown.Root>
                <Dropdown.Trigger asChild>
                  <Button.Root variant="neutral" mode="ghost" size="xxsmall" className="shrink-0" aria-label={t("moreActionsFor", { name })}>
                    <Button.Icon as={RiMoreLine} />
                  </Button.Root>
                </Dropdown.Trigger>
                <Dropdown.Content align="end">
                  <Dropdown.Item onSelect={() => setEditDetailsOpen(true)}>
                    <Dropdown.ItemIcon as={RiPencilLine} />
                    {t("editContact")}
                  </Dropdown.Item>
                  <Dropdown.Separator />
                  <Dropdown.Item destructive onSelect={() => setRemoveOpen(true)}>
                    <Dropdown.ItemIcon as={RiDeleteBinLine} />
                    {t("removeFromCampaign")}
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Root>
            )}
          </div>
        </Modal.Header>
        <Modal.Body className="space-y-5">
          {loading ? (
            <div aria-busy="true" aria-label={t("loadingContact")} className="space-y-5">
              <Skeleton className="h-16 w-full rounded-xl" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-9 rounded-lg" />
                  <Skeleton className="h-9 rounded-lg" />
                </div>
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : error && !detail ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : contact && person ? (
            <>
              {error && <FormError>{t("refreshError", { error })}</FormError>}
              <LiveCallStrip
                callId={liveCallId}
                serverStatus={sortedCalls.find((call) => call.id === liveCallId)?.status ?? null}
                agentOutcome={sortedCalls.find((call) => call.id === liveCallId)?.agentOutcome ?? null}
                onCancelled={() => {
                  void load();
                  onChanged?.();
                }}
              />

              {/* Who to call, and the button that calls them. */}
              <section aria-label={t("detailsAria")} className="flex items-center justify-between gap-3 rounded-xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200">
                <dl className="min-w-0 space-y-1 text-paragraph-sm">
                  <div className="flex items-center gap-2">
                    <dt><RiPhoneLine className="size-4 text-text-soft-400" aria-label={t("whatsappNumberAria")} /></dt>
                    <dd className={person.phone ? "tabular-nums text-text-strong-950" : "text-text-soft-400"}>{person.phone || t("noNumber")}</dd>
                  </div>
                  {person.email && (
                    <div className="flex min-w-0 items-center gap-2">
                      <dt><RiMailLine className="size-4 text-text-soft-400" aria-label={t("emailAria")} /></dt>
                      <dd className="truncate text-text-sub-600" title={person.email}>{person.email}</dd>
                    </div>
                  )}
                </dl>
                <CallButton personId={person.id} campaignContactId={contact.id} phone={person.phone} onCallStarted={() => void load()} />
              </section>

              <PanelSection title={t("status")} aside={<CallStatusBadge status={contact.callStatus} />}>
                {outcomeError && <FormError>{outcomeError}</FormError>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1.5 flex items-center gap-2 text-label-xs text-text-sub-600">
                      {t("callStatus")}
                      {attemptHint(contact) && <span className="text-text-soft-400">{attemptHint(contact)}</span>}
                    </span>
                    <Select.Root
                      size="small"
                      value={contact.callStatus}
                      disabled={savingField === "status"}
                      onValueChange={(next) => void saveCallStatus(next as ContactCallStatus)}
                    >
                      <Select.Trigger aria-label={t("callStatus")}>
                        <Select.Value>{callStatusLabel(contact.callStatus)}</Select.Value>
                      </Select.Trigger>
                      <Select.Content>
                        {/* The current status is listed even when set by a call, so the trigger can show it. */}
                        {CONTACT_CALL_STATUSES.filter((status) => CONTACT_CALL_STATUS_DEFINITIONS[status].manual || status === contact.callStatus).map((status) => (
                          <Select.Item key={status} value={status} disabled={!CONTACT_CALL_STATUS_DEFINITIONS[status].manual}>
                            {callStatusLabel(status)}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                    <p className="mt-1 text-paragraph-xs text-text-soft-400">{t("callStatusHelp")}</p>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-label-xs text-text-sub-600">{t("leadStatus")}</span>
                    <LeadStagePicker contact={contact} categories={categories} onUpdated={() => { void load(); onChanged?.(); }} />
                  </div>
                </div>
                <div>
                  <label htmlFor={`follow-up-${contactId}`} className="mb-1.5 block text-label-xs text-text-sub-600">{t("nextFollowUp")}</label>
                  <div className="flex items-center gap-2">
                    <Input.Root size="small" className="flex-1">
                      <Input.Wrapper>
                        <Input.Input
                          id={`follow-up-${contactId}`}
                          type="datetime-local"
                          value={followUpAt}
                          onChange={(event) => setFollowUpAt(event.target.value)}
                          onBlur={() => { if (followUpAt !== toDatetimeLocal(serverFollowUp)) void saveFollowUp(followUpAt); }}
                          disabled={savingField === "followUp"}
                        />
                      </Input.Wrapper>
                    </Input.Root>
                    {followUpAt && (
                      <Button.Root
                        variant="neutral"
                        mode="ghost"
                        size="xsmall"
                        disabled={savingField === "followUp"}
                        onClick={() => { setFollowUpAt(""); void saveFollowUp(""); }}
                      >
                        {t("clear")}
                      </Button.Root>
                    )}
                  </div>
                </div>
                {CONTACT_CALL_STATUS_DEFINITIONS[contact.callStatus].template !== null && (
                  <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => offerFollowUp(contact.callStatus)}>
                    <Button.Icon as={RiSendPlaneLine} />
                    {t("writeFollowUp")}
                  </Button.Root>
                )}
              </PanelSection>

              {/* WhatsApp thread + composer; a call-status template lands in the box. */}
              <PanelSection title={t("whatsappSection")}>
                <PersonWhatsappPanel
                  personId={person.id}
                  campaignContactId={contact.id}
                  callSessionId={latestCall?.id ?? null}
                  prefill={prefill}
                  fallbackSend={person.phone ? openInWhatsAppWeb : undefined}
                  onSent={() => { void load(); onChanged?.(); }}
                />
              </PanelSection>

              <PanelSection title={t("notes")}>
                <Textarea.Root simple rows={3} aria-label={t("notes")} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("notesPlaceholder")} />
                {notesError && <FormError>{notesError}</FormError>}
                <div className="flex justify-end">
                  <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={notesSaving} onClick={() => void saveNotes()}>
                    {notesSaving ? t("saving") : t("saveNotes")}
                  </Button.Root>
                </div>
              </PanelSection>

              <PanelSection title={t("calls")} count={sortedCalls.length}>
                {sortedCalls.length ? (
                  <div className="space-y-2">
                    {sortedCalls.map((call) => (
                      <CallHistoryRow
                        key={call.id}
                        call={call}
                        expanded={expandedCallId === call.id}
                        onToggleExpand={() => setExpandedCallId((current) => (current === call.id ? null : call.id))}
                        onRetryTranscript={() => void retryTranscript(call.id)}
                        retrying={retryingCallId === call.id}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-paragraph-sm text-text-sub-600">{t("noCalls")}</p>
                )}
              </PanelSection>

              <PanelSection title={t("messagesLogged")} count={sortedMessages.length}>
                {sortedMessages.length ? (
                  <div className="space-y-2">
                    {sortedMessages.map((message) => (
                      <div key={message.id} className="rounded-xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200">
                        <p className="whitespace-pre-wrap text-paragraph-sm text-text-strong-950">{message.body}</p>
                        <p className="mt-1 text-paragraph-xs text-text-sub-600">{formatDate(message.openedAt)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-paragraph-sm text-text-sub-600">{t("noMessages")}</p>
                )}
              </PanelSection>
            </>
          ) : null}
        </Modal.Body>
      </Modal.SideContent>
    </Modal.Root>

    {contact && (
      <EditContactModal
        open={editDetailsOpen}
        onOpenChange={setEditDetailsOpen}
        contact={contact}
        onSaved={() => { setEditDetailsOpen(false); void load(); onChanged?.(); }}
        onContactChanged={() => { void load(); onChanged?.(); }}
      />
    )}
    {contact && (
      <RemoveContactModal
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        contact={contact}
        onRemoved={() => { setRemoveOpen(false); onChanged?.(); onClose(); }}
      />
    )}
    </>
  );
}

export function RemoveContactModal({
  open,
  onOpenChange,
  contact,
  onRemoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: CampaignContact;
  onRemoved: () => void;
}) {
  const t = useTranslations("callingMain.panel");
  const tShared = useTranslations("callingMain.shared");
  const { errorMessage } = useCrmText();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const name = contact.person.fullName || contact.person.firstName || tShared("thisContact");

  useEffect(() => {
    if (open) {
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await removeCampaignContact(contact.id);
      onRemoved();
    } catch (cause) {
      setError(errorMessage(cause));
      setSubmitting(false);
    }
  };

  return (
    <Modal.Root open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <Modal.Content>
        <Modal.Header icon={RiDeleteBinLine}>
          <Modal.Title>{t("removeTitle")}</Modal.Title>
          <Modal.Description>
            {t("removeBody", { name })}
          </Modal.Description>
        </Modal.Header>
        {error && (
          <Modal.Body>
            <FormError>{error}</FormError>
          </Modal.Body>
        )}
        <Modal.Footer>
          <Modal.Close asChild>
            <Button.Root variant="neutral" mode="stroke" size="small" disabled={submitting}>{t("cancel")}</Button.Root>
          </Modal.Close>
          <Button.Root variant="error" mode="filled" size="small" disabled={submitting} onClick={() => void submit()}>
            {submitting ? t("removing") : t("removeFromCampaign")}
          </Button.Root>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

function CallHistoryRow({
  call,
  expanded,
  onToggleExpand,
  onRetryTranscript,
  retrying,
}: {
  call: CallDetail;
  expanded: boolean;
  onToggleExpand: () => void;
  onRetryTranscript: () => void;
  retrying: boolean;
}) {
  const t = useTranslations("callingMain.panel");
  const { formatDate } = useCrmText();
  const { dispositionLabel } = useCallingLabels();
  const duration = formatCallDuration(call.durationMs);
  return (
    <div className="space-y-2 rounded-xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-label-sm text-text-strong-950">{formatDate(call.startedAt ?? call.createdAt)}</span>
        {duration && <span className="text-paragraph-xs tabular-nums text-text-sub-600">{duration}</span>}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <CallSessionBadge status={call.status} />
          {call.disposition && (
            <Badge.Root variant="lighter" size="medium" color="blue">{dispositionLabel(call.disposition)}</Badge.Root>
          )}
        </span>
      </div>
      {(call.status === "failed" || call.status === "no_recording") && call.error && (
        <p className={call.status === "failed" ? "text-paragraph-xs text-error-dark" : "text-paragraph-xs text-text-sub-600"}>{call.error}</p>
      )}
      {call.hasRecording && <RecordingPlayer callId={call.id} offsetMs={call.recordingOffsetMs} />}

      {call.transcriptStatus === "pending" && !transcriptLooksStuck(call) && (
        <p className="flex items-center gap-1.5 text-paragraph-xs text-text-sub-600">
          <RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />
          {t("transcribing")}
        </p>
      )}
      {transcriptLooksStuck(call) && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-paragraph-xs text-text-sub-600">{t("transcriptStuck")}</p>
          <Button.Root variant="neutral" mode="stroke" size="xxsmall" className="shrink-0 gap-1.5 text-label-xs" disabled={retrying} onClick={onRetryTranscript}>
            <RiRefreshLine className={retrying ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
            {t("retry")}
          </Button.Root>
        </div>
      )}
      {call.transcriptStatus === "failed" && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-paragraph-xs text-error-dark">{call.transcriptError || t("transcriptionFailed")}</p>
          <Button.Root variant="neutral" mode="stroke" size="xxsmall" className="shrink-0 gap-1.5 text-label-xs" disabled={retrying} onClick={onRetryTranscript}>
            <RiRefreshLine className={retrying ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
            {t("retry")}
          </Button.Root>
        </div>
      )}
      {call.transcriptStatus === "done" && call.transcript && (
        <div className="space-y-2">
          <p className="flex items-start gap-1.5 text-paragraph-xs text-text-sub-600">
            <RiFileTextLine className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {call.transcript.summary}
          </p>
          <Button.Root variant="neutral" mode="ghost" size="xxsmall" className="-ml-2 gap-1.5 text-label-xs" aria-expanded={expanded} onClick={onToggleExpand}>
            <RiArrowDownSLine className={expanded ? "size-3.5 rotate-180 transition" : "size-3.5 transition"} aria-hidden="true" />
            {expanded ? t("hideTranscript") : t("showTranscript")}
          </Button.Root>
          {expanded && (
            <div className="space-y-1.5 rounded-lg bg-bg-white-0 p-3 ring-1 ring-inset ring-stroke-soft-200">
              {call.transcript.utterances.map((utterance, index) => (
                <div key={index} className="flex gap-2 text-paragraph-xs">
                  <span className="w-14 shrink-0 text-text-soft-400">{formatOffset(utterance.startSeconds)}</span>
                  <span className={utterance.speaker === "rep" ? "w-10 shrink-0 font-medium text-information-base" : "w-10 shrink-0 font-medium text-text-sub-600"}>
                    {utterance.speaker === "rep" ? t("speakerRep") : t("speakerLead")}
                  </span>
                  <span className="text-text-strong-950">{utterance.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A titled block of the side panel, separated from the one above by a hairline. */
function PanelSection({ title, count, aside, children }: { title: string; count?: number; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-stroke-soft-200 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-label-sm text-text-strong-950">
          {title}
          {count !== undefined && count > 0 && (
            <span className="rounded-md bg-bg-weak-50 px-1.5 py-0.5 text-label-xs tabular-nums text-text-sub-600">{count}</span>
          )}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
