"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { RiArrowDownSLine, RiLoader4Line, RiPhoneLine, RiRobot2Line } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import { VoicePreviewButton } from "@/components/calls/VoicePreviewButton";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Modal from "@/components/alignui/modal";
import * as Select from "@/components/alignui/select";
import * as Input from "@/components/alignui/input";
import * as Textarea from "@/components/alignui/textarea";
import { DocsLink } from "@/components/page/DocsLink";
import { AGENT_VOICES, DEFAULT_AGENT_NAME, DEFAULT_AGENT_VOICE, MAX_AGENT_BRIEF_CHARS, MAX_AGENT_NAME_CHARS, MIN_AGENT_RECORDER_VERSION, MIN_RECORDER_VERSION, type RecorderAgent } from "@/lib/calls/contract";
import type { DocsPage } from "@/lib/support";
import { isOlderVersion, RECORDER_SETUP_PATH } from "@/lib/calls/recorderRelease";
import { abandonCall, isRecorderInstalled, isRecorderOutdated, listCallingStations, recorderVersion, sendToRecorder, startCall } from "@/lib/calls/client";
import type { CallingStation } from "@/lib/calls/stationContract";
import { cn } from "@/utils/cn";
import { useCrmText } from "@/components/crm/useCrmText";
import { FormError, TextField } from "./fields";

// Example phone number for the placeholder, not interface text.
const EXAMPLE_PHONE = "+91 98765 43210";

type Phase = "idle" | "starting" | "opening";

/** The "Call from" choice that places the call from this browser through the extension. */
const THIS_BROWSER = "browser";

/** The AI agent's last brief, kept in this browser so the next agent call starts from it. */
const AGENT_BRIEF_KEY = "agentsdr.agentBrief";

const AGENT_NAME_KEY = "agentsdr.agentName";
const AGENT_VOICE_KEY = "agentsdr.agentVoice";

function savedValue(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function savedAgentBrief(): string {
  return savedValue(AGENT_BRIEF_KEY);
}

function savedAgentVoice(): string {
  const voice = savedValue(AGENT_VOICE_KEY);
  return AGENT_VOICES.some((candidate) => candidate.id === voice) ? voice : DEFAULT_AGENT_VOICE;
}

export function CallButton({ personId, crmRecordId, campaignContactId, phone, onCallStarted, numberMenu = true }: {
  personId: string;
  crmRecordId?: string | null;
  /** The Calling-section contact this call is placed from, when there is one. */
  campaignContactId?: string | null;
  phone: string | null;
  onCallStarted?: (callId: string) => void;
  /** Show the dropdown arrow with "Change number". Default true. */
  numberMenu?: boolean;
}) {
  const t = useTranslations("callsMain.callButton");
  const { errorMessage } = useCrmText();
  // Anything that is not about the number itself — no extension, an
  // outdated one, the extension refusing — is a notice, not the number modal:
  // opening "Change number" for those sends the rep fixing the wrong thing.
  /** `download`: the fix is getting the extension, so the notice links to it (and `guide`, our docs on it). */
  const [notice, setNotice] = useState<{ title: string; description: string; download?: boolean; guide?: { page: DocsPage; label: string } } | null>(null);
  const [numberOpen, setNumberOpen] = useState(false);
  const [numberValue, setNumberValue] = useState("");
  const [modalError, setModalError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentBrief, setAgentBrief] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentVoice, setAgentVoice] = useState<string>(DEFAULT_AGENT_VOICE);
  /** Active cloud calling stations, fetched when the agent modal opens; `null` until then. */
  const [stations, setStations] = useState<CallingStation[] | null>(null);
  const [callFrom, setCallFrom] = useState<string>(THIS_BROWSER);
  const busy = phase !== "idle";

  const openNumberModal = (prefill: string) => {
    setNumberValue(prefill);
    setModalError("");
    setNumberOpen(true);
  };

  const failed = (title: string, cause: unknown) => {
    setNumberOpen(false);
    setAgentOpen(false);
    setNotice({ title, description: errorMessage(cause) });
    setPhase("idle");
  };

  const begin = async (newPhone?: string, agent?: RecorderAgent) => {
    const clickedAt = Date.now();
    setModalError("");
    setPhase("starting");
    try {
      // Only send `phone` when the rep gave or corrected one here — the
      // contract treats it as an override, and a person who already has a
      // stored number should keep dialing that one untouched.
      const response = await startCall({
        personId,
        crmRecordId: crmRecordId ?? null,
        campaignContactId: campaignContactId ?? null,
        ...(newPhone ? { phone: newPhone } : {}),
      });
      try {
        const reply = await sendToRecorder({
          type: "call:start",
          callId: response.call.id,
          phone: response.call.phone,
          recorderToken: response.recorderToken,
          lead: response.lead,
          clickedAt,
          agent: agent ?? null,
        });
        if (reply.type === "call:accepted") {
          setNumberOpen(false);
          setAgentOpen(false);
          setPhase("opening");
          onCallStarted?.(response.call.id);
          // Give the rep a moment of confirmation before the button resets —
          // the extension takes over from here, opening WhatsApp itself.
          setTimeout(() => setPhase("idle"), 1500);
        } else {
          // This button only ever sends "call:start", so the reply is really
          // always "call:accepted" | "call:rejected" — the message:* branch
          // is unreachable but keeps this exhaustive against the bridge's
          // now-wider reply type.
          const error = reply.type === "call:rejected" ? reply.error : "Something went wrong. Please try again."; // sent to the server, so not translated
          void abandonCall(response.call.id, response.recorderToken, error);
          failed(t("recorderRejected"), new Error(reply.type === "call:rejected" ? error : t("genericError")));
        }
      } catch (cause) {
        // Sent to the server as the reason the call was abandoned: stays raw, never translated text.
        void abandonCall(response.call.id, response.recorderToken, cause instanceof Error ? cause.message : String(cause));
        failed(t("recorderNoAnswer"), cause);
      }
    } catch (cause) {
      // A number the rep just typed was rejected: keep them in the modal to
      // fix it. Otherwise the problem is not one the number modal can solve.
      if (newPhone !== undefined) {
        setModalError(errorMessage(cause));
        setNumberOpen(true);
        setPhase("idle");
      } else {
        failed(t("couldNotStart"), cause);
      }
    }
  };

  /** Installed and new enough to speak this page's bridge protocol. */
  const recorderReady = (): boolean => {
    if (!isRecorderInstalled()) {
      setNotice({
        title: t("notFoundTitle"),
        description: t("notFoundBody"),
        download: true,
        guide: { page: "whatsapp/calling#install-the-extension", label: t("howToInstall") },
      });
      return false;
    }
    const version = recorderVersion();
    if (isRecorderOutdated(version)) {
      setNotice({
        title: t("reloadTitle"),
        description: t("outdatedBody", { version: version ?? t("unknownVersion"), required: MIN_RECORDER_VERSION }),
        download: true,
        guide: { page: "whatsapp/calling#update-the-extension", label: t("howToUpdate") },
      });
      return false;
    }
    return true;
  };

  const handleCallClick = () => {
    if (!recorderReady()) return;
    if (!phone) { openNumberModal(""); return; }
    void begin();
  };

  const handleChangeNumber = () => {
    if (!recorderReady()) return;
    openNumberModal(phone ?? "");
  };

  /** The extension is installed and new enough for AI agent calls; otherwise says why in a notice. */
  const agentRecorderReady = (): boolean => {
    if (!recorderReady()) return false;
    const version = recorderVersion();
    if (!version || isOlderVersion(version, MIN_AGENT_RECORDER_VERSION)) {
      setNotice({
        title: t("reloadTitle"),
        description: t("agentOutdatedBody", { required: MIN_AGENT_RECORDER_VERSION, version: version ?? t("unknownVersion") }),
      });
      return false;
    }
    return true;
  };

  // The extension is only needed when "This browser" is chosen, so the modal
  // opens without it and the readiness checks run at Start.
  const handleAgentCall = () => {
    setAgentBrief((current) => current || savedAgentBrief());
    setAgentName((current) => current || savedValue(AGENT_NAME_KEY));
    setAgentVoice(savedAgentVoice());
    setStations(null);
    setCallFrom(THIS_BROWSER);
    setAgentOpen(true);
    void listCallingStations()
      .then(({ stations: all }) => {
        const active = all.filter((station) => station.status === "active");
        setStations(active);
        if (active.length > 0) setCallFrom(active[0].id);
      })
      .catch(() => setStations([]));
  };

  const beginCloud = async (brief: string, name: string, voice: string, stationId: string) => {
    setModalError("");
    setPhase("starting");
    try {
      const response = await startCall({
        personId,
        crmRecordId: crmRecordId ?? null,
        campaignContactId: campaignContactId ?? null,
        mode: "agent_cloud",
        agentBrief: brief,
        agentName: name || null,
        agentVoice: voice,
        stationId,
      });
      setAgentOpen(false);
      setPhase("opening");
      onCallStarted?.(response.call.id);
      setTimeout(() => setPhase("idle"), 1500);
    } catch (cause) {
      failed(t("couldNotStart"), cause);
    }
  };

  const startAgentCall = () => {
    const brief = agentBrief.trim();
    const name = agentName.trim();
    try {
      window.localStorage.setItem(AGENT_BRIEF_KEY, brief);
      window.localStorage.setItem(AGENT_NAME_KEY, name);
      window.localStorage.setItem(AGENT_VOICE_KEY, agentVoice);
    } catch {
      // Only a convenience for the next call.
    }
    if (callFrom !== THIS_BROWSER) {
      void beginCloud(brief, name, agentVoice, callFrom);
      return;
    }
    if (!agentRecorderReady()) return;
    void begin(undefined, { brief, name: name || null, voice: agentVoice });
  };

  const label = phase === "starting" ? t("starting") : phase === "opening" ? t("opening") : t("call");

  return (
    <>
      <div className="inline-flex">
        <Button.Root
          variant="neutral"
          mode="stroke"
          size="xxsmall"
          disabled={busy}
          onClick={handleCallClick}
          className={cn("gap-1.5 whitespace-nowrap px-2.5 text-label-xs", phone && numberMenu && "rounded-r-none")}
        >
          {busy
            ? <RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />
            : <RiPhoneLine className="size-3.5" aria-hidden="true" />}
          {label}
        </Button.Root>
        {/* A number is already known — the button above dials it directly.
            Changing it is secondary, so it hides behind a split-button
            dropdown rather than a second always-visible control. */}
        {phone && numberMenu && (
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button.Root
                variant="neutral"
                mode="stroke"
                size="xxsmall"
                disabled={busy}
                aria-label={t("callOptions")}
                title={t("callingPhone", { phone })}
                className="-ml-px w-6 shrink-0 rounded-l-none px-0"
              >
                <RiArrowDownSLine className="size-3.5" aria-hidden="true" />
              </Button.Root>
            </Dropdown.Trigger>
            <Dropdown.Content align="end">
              <Dropdown.Item onSelect={handleChangeNumber}>{t("changeNumber")}</Dropdown.Item>
              <Dropdown.Item onSelect={handleAgentCall}>
                <RiRobot2Line className="size-4" aria-hidden="true" />
                {t("callWithAgent")}
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Root>
        )}
      </div>

      <Modal.Root open={notice !== null} onOpenChange={(open) => { if (!open) setNotice(null); }}>
        <Modal.Content>
          <Modal.Header icon={RiPhoneLine}>
            <Modal.Title>{notice?.title}</Modal.Title>
            <Modal.Description>{notice?.description}</Modal.Description>
          </Modal.Header>
          <Modal.Footer>
            {notice?.guide && <DocsLink page={notice.guide.page}>{notice.guide.label}</DocsLink>}
            {notice?.download && (
              <Button.Root asChild variant="neutral" mode="stroke" size="small">
                <Link href={RECORDER_SETUP_PATH} onClick={() => setNotice(null)}>{t("getExtension")}</Link>
              </Button.Root>
            )}
            <Modal.Close asChild>
              <Button.Root variant="primary" mode="filled" size="small">{t("gotIt")}</Button.Root>
            </Modal.Close>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      <Modal.Root open={agentOpen} onOpenChange={(open) => { if (!busy) setAgentOpen(open); }}>
        <Modal.Content>
          <Modal.Header icon={RiRobot2Line}>
            <Modal.Title>{t("agentTitle")}</Modal.Title>
            <Modal.Description>
              {t("agentDescription", { target: phone ?? t("theLead") })}
            </Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-label-sm text-text-strong-950">{t("callFrom")}</label>
              <Select.Root size="small" value={callFrom} onValueChange={setCallFrom} disabled={busy}>
                <Select.Trigger aria-label={t("callFrom")}><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value={THIS_BROWSER}>{t("thisBrowser")}</Select.Item>
                  {(stations ?? []).map((station) => (
                    <Select.Item key={station.id} value={station.id}>{t("stationOption", { name: station.name, phone: station.phone })}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              {callFrom !== THIS_BROWSER && (
                <p className="text-paragraph-xs text-text-sub-600">{t("cloudNote")}</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="agent-name" className="block text-label-sm text-text-strong-950">{t("agentName")}</label>
                <Input.Root size="small">
                  <Input.Wrapper>
                    <Input.Input
                      id="agent-name"
                      value={agentName}
                      maxLength={MAX_AGENT_NAME_CHARS}
                      onChange={(event) => setAgentName(event.target.value)}
                      disabled={busy}
                      placeholder={DEFAULT_AGENT_NAME}
                    />
                  </Input.Wrapper>
                </Input.Root>
              </div>
              <div className="space-y-1.5">
                <label className="block text-label-sm text-text-strong-950">{t("voice")}</label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Select.Root size="small" value={agentVoice} onValueChange={setAgentVoice} disabled={busy}>
                      <Select.Trigger aria-label={t("voice")}><Select.Value /></Select.Trigger>
                      <Select.Content>
                        {AGENT_VOICES.map((voice) => (
                          <Select.Item key={voice.id} value={voice.id}>{voice.label}</Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </div>
                  <VoicePreviewButton voice={agentVoice} name={agentName} />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
            <label htmlFor="agent-brief" className="block text-label-sm text-text-strong-950">{t("goal")}</label>
            <Textarea.Root
              id="agent-brief"
              simple
              rows={8}
              autoFocus
              maxLength={MAX_AGENT_BRIEF_CHARS}
              value={agentBrief}
              onChange={(event) => setAgentBrief(event.target.value)}
              disabled={busy}
              placeholder={t("goalPlaceholder")}
            />
            <p className="text-paragraph-xs text-text-sub-600">{t("goalHint")}</p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close asChild>
              <Button.Root variant="neutral" mode="stroke" size="small" disabled={busy}>{t("cancel")}</Button.Root>
            </Modal.Close>
            <Button.Root variant="primary" mode="filled" size="small" disabled={busy || !agentBrief.trim()} onClick={startAgentCall}>
              {busy
                ? <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />
                : <RiRobot2Line className="size-4" aria-hidden="true" />}
              {busy ? label : t("startAiCall")}
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      <Modal.Root open={numberOpen} onOpenChange={(open) => { if (!busy) setNumberOpen(open); }}>
        <Modal.Content>
          <Modal.Header icon={RiPhoneLine}>
            <Modal.Title>{phone ? t("changeNumberTitle") : t("addNumberTitle")}</Modal.Title>
            <Modal.Description>{t("numberDescription")}</Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            {modalError && <FormError>{modalError}</FormError>}
            <TextField label={t("whatsappNumber")} autoFocus value={numberValue} onChange={setNumberValue} placeholder={EXAMPLE_PHONE} disabled={busy} />
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close asChild>
              <Button.Root variant="neutral" mode="stroke" size="small" disabled={busy}>{t("cancel")}</Button.Root>
            </Modal.Close>
            <Button.Root
              variant="primary"
              mode="filled"
              size="small"
              disabled={busy || !numberValue.trim()}
              onClick={() => void begin(numberValue.trim())}
            >
              {busy
                ? <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />
                : <RiPhoneLine className="size-4" aria-hidden="true" />}
              {label}
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </>
  );
}
