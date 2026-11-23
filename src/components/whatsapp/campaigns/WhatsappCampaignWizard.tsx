"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RiArrowLeftLine, RiArrowRightLine, RiCheckLine, RiDraftLine, RiLoader4Line, RiRocketLine, RiStackLine, RiTeamLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import AddPeopleToCampaignModal from "@/components/leads/AddPeopleToCampaignModal";
import CampaignCsvMappingDialog from "@/components/leads/CampaignCsvMappingDialog";
import { PageHeader } from "@/components/page/PageHeader";
import type {
  CreateWhatsappCampaignRequest,
  UpdateWhatsappCampaignRequest,
  WhatsappCampaignDetail,
  WhatsappCampaignImportResponse,
  WhatsappCampaignStep,
  WhatsappCampaignSummary,
} from "@/lib/whatsapp/campaigns/contract";
import type { WhatsappAccountSummary } from "@/lib/whatsapp/contract";
import { cn } from "@/utils/cn";
import { apiJson, errorText, fetchWhatsappAccounts } from "./api";
import { launchBlocker } from "./metrics";
import { useCampaignFormat, useImportSummary } from "./useCampaignFormat";
import { SenderPicker } from "./SenderPicker";
import { WhatsappSequenceEditor } from "./WhatsappSequenceEditor";
import { LeadSourceCards, StepDot, StepHeading, SummaryRow, WizardStepList } from "@/components/campaigns/wizardParts";

const STEPS = [
  { id: "setup", labelKey: "stepSetupLabel", hintKey: "stepSetupHint", icon: RiDraftLine },
  { id: "leads", labelKey: "stepLeadsLabel", hintKey: "stepLeadsHint", icon: RiTeamLine },
  { id: "sequence", labelKey: "stepSequenceLabel", hintKey: "stepSequenceHint", icon: RiStackLine },
  { id: "review", labelKey: "stepReviewLabel", hintKey: "stepReviewHint", icon: RiCheckLine },
] as const;

export function WhatsappCampaignWizard() {
  const t = useTranslations("whatsappCampaigns.wizard");
  const cf = useCampaignFormat();
  const importSummary = useImportSummary();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<WhatsappAccountSummary[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [leadCount, setLeadCount] = useState(0);
  const [steps, setSteps] = useState<WhatsappCampaignStep[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWhatsappAccounts()
      .then((list) => { if (!cancelled) setAccounts(list); })
      .catch((cause) => { if (!cancelled) setAccountsError(errorText(cause, t("loadNumbersFailed"))); });
    return () => { cancelled = true; };
  }, [t]);

  // Review shows what the server holds, not what this page remembers.
  useEffect(() => {
    if (step !== 3 || !campaignId) return;
    let cancelled = false;
    apiJson<WhatsappCampaignDetail>(`/api/whatsapp/campaigns/${campaignId}`)
      .then((detail) => {
        if (cancelled) return;
        setLeadCount(detail.stats.total);
        setSteps(detail.steps);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [step, campaignId]);

  const connectedSelected = useMemo(
    () => (accounts ?? []).filter((a) => accountIds.includes(a.id) && a.status === "connected").length,
    [accounts, accountIds],
  );
  const blocker = launchBlocker({ connectedSenders: connectedSelected, leads: leadCount, firstMessage: steps[0]?.body });
  const writtenSteps = steps.filter((s) => s.body.trim()).length;

  async function saveSetup() {
    if (!name.trim()) { setError(t("nameRequired")); return; }
    setBusy(true);
    setError(null);
    try {
      if (campaignId) {
        const body: UpdateWhatsappCampaignRequest = { name: name.trim(), description: description.trim() || null, accountIds };
        await apiJson(`/api/whatsapp/campaigns/${campaignId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        const body: CreateWhatsappCampaignRequest = { name: name.trim(), description: description.trim() || null, accountIds };
        const created = await apiJson<WhatsappCampaignSummary>("/api/whatsapp/campaigns", { method: "POST", body: JSON.stringify(body) });
        setCampaignId(created.id);
      }
      setStep(1);
    } catch (cause) {
      setError(errorText(cause, t("saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function finish(launch: boolean) {
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      if (launch) {
        const body: UpdateWhatsappCampaignRequest = { status: "active" };
        await apiJson(`/api/whatsapp/campaigns/${campaignId}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      router.push(`/whatsapp/campaigns/${campaignId}`);
    } catch (cause) {
      setError(errorText(cause, t("launchFailed")));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        back={{ href: "/whatsapp/campaigns", label: t("backLabel") }}
        title={t("title")}
        description={t("description")}
      />

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-5">
        <Frame>
          <FrameHeader title={t("stepsTitle")} description={t("stepProgress", { current: step + 1, total: STEPS.length })} />
          <FramePanel className="p-2 sm:p-2">
            <WizardStepList items={STEPS.map((item) => ({ id: item.id, label: t(item.labelKey), hint: t(item.hintKey), icon: item.icon }))} step={step} busy={busy} onSelect={setStep} />

            <div className="mx-1 mb-1 mt-3 hidden border-t border-stroke-soft-200 px-2 pt-3 lg:block">
              <p className="text-paragraph-xs text-text-soft-400">{t("summary")}</p>
              <dl className="mt-2 space-y-2 text-paragraph-sm">
                <SummaryRow label={t("summaryName")} value={name || t("notNamed")} truncate />
                <SummaryRow label={t("summaryNumbers")} value={cf.number(accountIds.length)} />
                <SummaryRow label={t("summaryLeads")} value={cf.number(leadCount)} />
                <SummaryRow label={t("summaryMessages")} value={cf.number(writtenSteps || steps.length)} />
              </dl>
            </div>
          </FramePanel>
        </Frame>

        <Frame>
          <FramePanel className="min-h-[560px] p-5 sm:p-7">
            {step === 0 && (
              <div className="mx-auto max-w-2xl">
                <StepHeading title={t("setupTitle")} description={t("setupDescription")} />
                <div className="mt-6 space-y-5">
                  <label className="block">
                    <span className="mb-1.5 block text-label-sm text-text-strong-950">{t("nameLabel")}</span>
                    <Input.Root hasError={Boolean(error && !name.trim())}>
                      <Input.Wrapper>
                        <Input.Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("namePlaceholder")} autoFocus />
                      </Input.Wrapper>
                    </Input.Root>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-label-sm text-text-strong-950">{t.rich("descriptionLabel", { soft: (chunks) => <span className="text-text-soft-400">{chunks}</span> })}</span>
                    <Textarea.Root simple rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("descriptionPlaceholder")} />
                  </label>
                  <fieldset>
                    <legend className="mb-2 block text-label-sm text-text-strong-950">{t("numbersLegend")}</legend>
                    <SenderPicker accounts={accounts} selectedIds={accountIds} onChange={setAccountIds} error={accountsError} />
                    <p className="mt-2 text-paragraph-xs text-text-sub-600">{t("numbersNote")}</p>
                  </fieldset>
                </div>
                <WizardFooter error={error} backLabel={t("cancel")} onBack={() => router.push("/whatsapp/campaigns")} onNext={() => void saveSetup()} busy={busy} nextLabel={t("continueToLeads")} />
              </div>
            )}

            {step === 1 && campaignId && (
              <div className="mx-auto max-w-3xl">
                <StepHeading title={t("leadsTitle")} description={t("leadsDescription")} />
                <LeadSourceCards
                  fileRef={fileRef}
                  onPickFile={setPendingFile}
                  onPickPeople={() => setShowPeople(true)}
                  importTitle={t("importTitle")}
                  importBody={t("importBody")}
                  peopleTitle={t("peopleTitle")}
                  peopleBody={t("peopleBody")}
                  addedText={t("leadsAdded", { count: leadCount })}
                  hintText={importNote ?? t("leadsAddedHint")}
                />
                <WizardFooter error={error} onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel={t("continueToMessages")} />
                {pendingFile && (
                  <CampaignCsvMappingDialog
                    file={pendingFile}
                    endpoint={`/api/whatsapp/campaigns/${campaignId}/upload`}
                    channel="whatsapp"
                    onClose={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    onImported={(result) => {
                      const imported = result as WhatsappCampaignImportResponse;
                      setLeadCount((current) => current + imported.added);
                      setImportNote(importSummary(imported));
                      setPendingFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  />
                )}
                {showPeople && (
                  <AddPeopleToCampaignModal
                    campaignId={campaignId}
                    channel="whatsapp"
                    onClose={() => setShowPeople(false)}
                    onAdded={(result) => {
                      setLeadCount((current) => current + result.added);
                      setImportNote(t("peopleSummary", { added: result.added, duplicates: result.skippedDuplicate, missing: result.skippedMissingIdentity }));
                    }}
                  />
                )}
              </div>
            )}

            {step === 2 && campaignId && (
              <div>
                <StepHeading title={t("sequenceTitle")} description={t("sequenceDescription")} />
                <div className="mt-5">
                  <WhatsappSequenceEditor
                    campaignId={campaignId}
                    initialSteps={steps}
                    leadsVersion={leadCount}
                    saveLabel={t("saveAndReview")}
                    onSaved={(next) => { setSteps(next); setStep(3); }}
                  />
                </div>
                <div className="mt-5">
                  <Button.Root variant="neutral" mode="ghost" size="small" onClick={() => setStep(1)}>
                    <Button.Icon as={RiArrowLeftLine} />{t("backToLeads")}
                  </Button.Root>
                </div>
              </div>
            )}

            {step === 3 && campaignId && (
              <div className="mx-auto max-w-3xl">
                <StepHeading title={t("reviewTitle")} description={t("reviewDescription")} />
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <SummaryCard label={t("cardCampaign")} value={name} detail={t("cardCampaignDetail")} />
                  <SummaryCard label={t("cardLeads")} value={cf.number(leadCount)} detail={t("cardLeadsDetail")} />
                  <SummaryCard label={t("cardNumbers")} value={cf.number(accountIds.length)} detail={t("cardNumbersDetail", { count: connectedSelected })} />
                </div>
                <div className="mt-4 rounded-2xl bg-bg-weak-50 p-1 ring-1 ring-inset ring-stroke-soft-200">
                  <h3 className="px-3 pb-2 pt-2 text-label-sm text-text-strong-950">{t("sequenceHeading")}</h3>
                  <ul className="divide-y divide-stroke-soft-200 rounded-xl bg-bg-white-0 px-4 ring-1 ring-inset ring-stroke-soft-200">
                    {steps.map((item, index) => (
                      <li key={item.id} className="flex items-center justify-between gap-4 py-2.5 text-paragraph-sm">
                        <span className="min-w-0">
                          <span className="block text-text-sub-600">{index === 0 ? t("firstMessage") : t("followUpAfter", { number: index, delay: cf.delay(item.delayHours) })}</span>
                          <span className="block max-w-md truncate text-paragraph-xs text-text-soft-400">{item.body}</span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-success-base"><RiCheckLine className="size-4" aria-hidden="true" />{t("ready")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-4 text-paragraph-xs text-text-sub-600">{t("sendingNote")}</p>
                {blocker && <p className="mt-4 rounded-xl bg-warning-lighter p-3 text-paragraph-sm text-warning-dark">{t("blockedBeforeLaunch", { reason: blocker })}</p>}
                <WizardFooter error={error} onBack={() => setStep(2)} busy={busy} secondaryLabel={t("savePaused")} onSecondary={() => void finish(false)} nextLabel={t("launch")} onNext={() => void finish(true)} nextDisabled={Boolean(blocker)} nextIcon={RiRocketLine} />
              </div>
            )}
          </FramePanel>
        </Frame>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl bg-bg-white-0 p-4 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200">
      <p className="text-paragraph-xs text-text-sub-600">{label}</p>
      <p className="mt-1 truncate text-label-lg text-text-strong-950" title={value}>{value}</p>
      <p className="text-paragraph-xs text-text-sub-600">{detail}</p>
    </div>
  );
}

function WizardFooter({
  error,
  onBack,
  onNext,
  busy,
  backLabel,
  nextLabel,
  nextDisabled,
  secondaryLabel,
  onSecondary,
  nextIcon: NextIcon = RiArrowRightLine,
}: {
  error?: string | null;
  onBack: () => void;
  onNext: () => void;
  busy?: boolean;
  backLabel?: string;
  nextLabel: string;
  nextDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  nextIcon?: typeof RiArrowRightLine;
}) {
  const t = useTranslations("whatsappCampaigns.wizard");
  return (
    <div className="mt-8 border-t border-stroke-soft-200 pt-5">
      {error && <p role="alert" className="mb-3 text-paragraph-sm text-error-base">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button.Root variant="neutral" mode="ghost" size="small" onClick={onBack} disabled={busy}>
          <Button.Icon as={RiArrowLeftLine} />{backLabel ?? t("back")}
        </Button.Root>
        <div className="flex gap-2">
          {secondaryLabel && onSecondary && (
            <Button.Root variant="neutral" mode="stroke" size="small" onClick={onSecondary} disabled={busy}>{secondaryLabel}</Button.Root>
          )}
          <Button.Root variant="primary" mode="filled" size="small" onClick={onNext} disabled={busy || nextDisabled}>
            <Button.Icon as={busy ? RiLoader4Line : NextIcon} className={cn(busy && "animate-spin")} />
            {busy ? t("saving") : nextLabel}
          </Button.Root>
        </div>
      </div>
    </div>
  );
}
