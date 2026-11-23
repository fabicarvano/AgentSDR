"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, FileSpreadsheet, Loader2, Rocket, Users } from "lucide-react";
import { RiCheckLine, RiDraftLine, RiStackLine, RiTeamLine } from "@remixicon/react";
import * as AlignButton from "@/components/alignui/button";
import * as Checkbox from "@/components/alignui/checkbox";
import * as Input from "@/components/alignui/input";
import * as Textarea from "@/components/alignui/textarea";
import AddPeopleToCampaignModal from "@/components/leads/AddPeopleToCampaignModal";
import CampaignCsvMappingDialog from "@/components/leads/CampaignCsvMappingDialog";
import { LinkedInAccountTag } from "@/components/linkedin/LinkedInAccountTag";
import { LinkedInSequenceEditor } from "@/components/linkedin/LinkedInSequenceEditor";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { DocsLink } from "@/components/page/DocsLink";
import { PageHeader } from "@/components/page/PageHeader";
import { EMPTY_LINKEDIN_SEQUENCE, type LinkedinCampaignSequence } from "@/lib/linkedin/campaignSequence";
import { cn } from "@/utils/cn";

type Account = { id: string; username: string; name: string | null; profilePictureUrl: string | null };

const STEPS = [
  { id: "setup", labelKey: "stepSetupLabel", hintKey: "stepSetupHint", icon: RiDraftLine },
  { id: "leads", labelKey: "stepLeadsLabel", hintKey: "stepLeadsHint", icon: RiTeamLine },
  { id: "sequence", labelKey: "stepSequenceLabel", hintKey: "stepSequenceHint", icon: RiStackLine },
  { id: "review", labelKey: "stepReviewLabel", hintKey: "stepReviewHint", icon: RiCheckLine },
] as const;

function StepDot({ index, active, done }: { index: number; active: boolean; done: boolean }) {
  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-label-xs transition",
        done
          ? "bg-success-lighter text-success-base"
          : active
            ? "bg-primary-base text-static-white shadow-regular-xs"
            : "bg-bg-weak-50 text-text-soft-400",
      )}
    >
      {done ? <RiCheckLine className="size-4" /> : index + 1}
    </div>
  );
}

export function LinkedInCampaignWizard({ accounts }: { accounts: Account[] }) {
  const t = useTranslations("linkedinCampaigns.wizard");
  const format = useFormatter();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"REGULAR" | "PERSONAL">("REGULAR");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [sequence, setSequence] = useState<LinkedinCampaignSequence>(EMPTY_LINKEDIN_SEQUENCE);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  async function saveSetup() {
    if (!name.trim()) { setError(t("nameRequired")); return; }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(campaignId ? `/api/linkedin/campaigns/${campaignId}` : "/api/linkedin/campaigns", {
        method: campaignId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, type, linkedinAccountIds: accountIds, ...(!campaignId ? { status: "PAUSED" } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error ?? t("saveFailed"));
      if (!campaignId) setCampaignId(data.campaign.id);
      setStep(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function finish(status: "PAUSED" | "ACTIVE") {
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/linkedin/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error ?? t("finishFailed"));
      router.push(`/linkedin/campaigns/${campaignId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("finishFailed"));
    } finally {
      setBusy(false);
    }
  }

  const canLaunch = leadCount > 0 && accountIds.length > 0;
  const summaryItems = [
    { id: "invitation", label: t("itemInvitation"), enabled: Boolean(sequence.invitationMessage) },
    { id: "acceptance", label: t("itemAcceptance"), enabled: Boolean(sequence.acceptanceMessage) },
    { id: "followUp1", label: t("itemFollowUp", { number: 1 }), enabled: Boolean(sequence.followUp1Message) },
    { id: "followUp2", label: t("itemFollowUp", { number: 2 }), enabled: Boolean(sequence.followUp2Message) },
    { id: "followUp3", label: t("itemFollowUp", { number: 3 }), enabled: Boolean(sequence.followUp3Message) },
  ];
  const sequenceStepsBuilt = summaryItems.filter((item) => item.enabled).length;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        back={{ href: "/linkedin/campaigns", label: t("backLabel") }}
        title={t("title")}
        description={t("description")}
      />

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-5">
        <Frame>
          <FrameHeader title={t("stepsTitle")} description={t("stepProgress", { current: step + 1, total: STEPS.length })} />
          <FramePanel className="p-2 sm:p-2">
            <ol className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
              {STEPS.map((item, index) => {
                const active = index === step;
                const done = index < step;
                const reachable = index <= step;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!reachable || active}
                      onClick={() => reachable && setStep(index)}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition duration-200 ease-out",
                        active ? "bg-bg-weak-50" : reachable ? "hover:bg-bg-weak-50" : "cursor-default",
                      )}
                    >
                      <StepDot index={index} active={active} done={done} />
                      <span className="min-w-0">
                        <span className={cn("block text-label-sm", active ? "text-text-strong-950" : "text-text-sub-600")}>{t(item.labelKey)}</span>
                        <span className="mt-0.5 hidden text-paragraph-xs text-text-soft-400 lg:block">{t(item.hintKey)}</span>
                      </span>
                      <Icon className="ml-auto hidden size-4 text-text-soft-400 sm:block lg:hidden" />
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mx-1 mb-1 mt-3 hidden border-t border-stroke-soft-200 px-2 pt-3 lg:block">
              <p className="text-paragraph-xs text-text-soft-400">{t("summary")}</p>
              <dl className="mt-2 space-y-2 text-paragraph-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-text-sub-600">{t("summaryName")}</dt>
                  <dd className="min-w-0 truncate text-label-sm text-text-strong-950">{name || t("notNamed")}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-text-sub-600">{t("summarySenders")}</dt>
                  <dd className="text-label-sm tabular-nums text-text-strong-950">{format.number(accountIds.length)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-text-sub-600">{t("summaryLeads")}</dt>
                  <dd className="text-label-sm tabular-nums text-text-strong-950">{format.number(leadCount)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-text-sub-600">{t("summarySequence")}</dt>
                  <dd className="text-label-sm tabular-nums text-text-strong-950">{t("sequenceSteps", { count: sequenceStepsBuilt })}</dd>
                </div>
              </dl>
            </div>
          </FramePanel>
        </Frame>

        <Frame>
          <FramePanel className="min-h-[560px] p-5 sm:p-7">
            {step === 0 && (
              <div className="mx-auto max-w-2xl">
                <StepHeading title={t("stepSetupLabel")} description={t("setupDescription")} />
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
                    <legend className="mb-2 block text-label-sm text-text-strong-950">{t("typeLegend")}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(["REGULAR", "PERSONAL"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={type === value}
                          onClick={() => setType(value)}
                          className={cn(
                            "rounded-xl p-4 text-left outline-none ring-1 ring-inset transition focus-visible:ring-2 focus-visible:ring-primary-base",
                            type === value ? "bg-bg-weak-50 ring-primary-base" : "bg-bg-white-0 ring-stroke-soft-200 hover:bg-bg-weak-50",
                          )}
                        >
                          <span className="text-label-sm text-text-strong-950">{value === "REGULAR" ? t("typeRegular") : t("typePersonal")}</span>
                          <span className="mt-1 block text-paragraph-xs text-text-sub-600">
                            {value === "REGULAR" ? t("typeRegularHint") : t("typePersonalHint")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-2 block text-label-sm text-text-strong-950">{t("sendersLegend")}</legend>
                    {accounts.length === 0 ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-warning-lighter p-3 text-paragraph-sm text-warning-dark">
                        <span className="min-w-0 flex-1">{t("noAccountsWarning")}</span>
                        <span className="flex flex-wrap items-center gap-3 text-paragraph-xs">
                          <Link href="/settings/linkedin-accounts" className="font-medium underline underline-offset-2">
                            {t("connectAccount")}
                          </Link>
                          <DocsLink page="linkedin/accounts#add-a-linkedin-account" appearance="inline" className="text-current underline" />
                        </span>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {accounts.map((account) => {
                          const checked = accountIds.includes(account.id);
                          return (
                            <label
                              key={account.id}
                              className={cn("flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 ring-inset transition", checked ? "bg-bg-weak-50 ring-primary-base" : "ring-stroke-soft-200 hover:bg-bg-weak-50")}
                            >
                              <Checkbox.Root
                                checked={checked}
                                onCheckedChange={() => setAccountIds((current) => (checked ? current.filter((id) => id !== account.id) : [...current, account.id]))}
                              />
                              <LinkedInAccountTag account={account} size="sm" />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                </div>
                <WizardFooter error={error} backLabel={t("cancel")} onBack={() => router.push("/linkedin/campaigns")} onNext={() => void saveSetup()} busy={busy} nextLabel={t("continueToLeads")} />
              </div>
            )}

            {step === 1 && campaignId && (
              <div className="mx-auto max-w-3xl">
                <StepHeading title={t("stepLeadsLabel")} description={t("leadsDescription")} />
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-stroke-sub-300 bg-bg-weak-50 p-6 text-center outline-none transition hover:border-primary-base focus-visible:ring-2 focus-visible:ring-primary-base">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200"><FileSpreadsheet className="size-5 text-text-sub-600" /></span>
                    <span className="mt-3 text-label-md text-text-strong-950">{t("importTitle")}</span>
                    <span className="mt-1 text-paragraph-xs text-text-sub-600">{t("importBody")}</span>
                  </button>
                  <button type="button" onClick={() => setShowPeople(true)} className="flex min-h-44 flex-col items-center justify-center rounded-2xl bg-bg-white-0 p-6 text-center shadow-regular-xs outline-none ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-base">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200"><Users className="size-5 text-text-sub-600" /></span>
                    <span className="mt-3 text-label-md text-text-strong-950">{t("peopleTitle")}</span>
                    <span className="mt-1 text-paragraph-xs text-text-sub-600">{t("peopleBody")}</span>
                  </button>
                </div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)} />
                <div role="status" className="mt-4 rounded-xl bg-bg-weak-50 p-4 ring-1 ring-inset ring-stroke-soft-200">
                  <p className="text-label-sm text-text-strong-950">{t("leadsAdded", { count: leadCount })}</p>
                  <p className="mt-1 text-paragraph-xs text-text-sub-600">{importSummary ?? t("leadsAddedHint")}</p>
                </div>
                <WizardFooter error={error} onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel={t("continueToSequence")} />
                {pendingFile && (
                  <CampaignCsvMappingDialog
                    file={pendingFile}
                    endpoint={`/api/linkedin/campaigns/${campaignId}/upload`}
                    channel="linkedin"
                    onClose={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    onImported={(result) => {
                      const added = Number(result.created ?? 0) + Number(result.attached ?? 0);
                      setLeadCount((current) => current + added);
                      setImportSummary(t("importSummary", { added, failed: Number(result.failed ?? 0) }));
                      setPendingFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  />
                )}
                {showPeople && (
                  <AddPeopleToCampaignModal
                    campaignId={campaignId}
                    channel="linkedin"
                    onClose={() => setShowPeople(false)}
                    onAdded={(result) => {
                      setLeadCount((current) => current + result.added);
                      setImportSummary(t("peopleSummary", { added: result.added, skipped: result.skippedDuplicate ?? 0 }));
                    }}
                  />
                )}
              </div>
            )}

            {step === 2 && campaignId && (
              <div>
                <StepHeading title={t("sequenceTitle")} description={t("sequenceDescription")} />
                <div className="mt-5">
                  <LinkedInSequenceEditor campaignId={campaignId} initialSequence={sequence} saveLabel={t("saveAndReview")} onSaved={(next) => { setSequence(next); setStep(3); }} />
                </div>
                <div className="mt-5">
                  <AlignButton.Root variant="neutral" mode="ghost" size="small" onClick={() => setStep(1)}>
                    <AlignButton.Icon as={ArrowLeft} />{t("backToLeads")}
                  </AlignButton.Root>
                </div>
              </div>
            )}

            {step === 3 && campaignId && (
              <div className="mx-auto max-w-3xl">
                <StepHeading title={t("reviewTitle")} description={t("reviewDescription")} />
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <SummaryCard label={t("cardCampaign")} value={name} detail={type === "PERSONAL" ? t("typePersonal") : t("typeRegular")} />
                  <SummaryCard label={t("cardLeads")} value={format.number(leadCount)} detail={t("detailEnrolled")} />
                  <SummaryCard label={t("cardSenders")} value={format.number(accountIds.length)} detail={t("detailConnected")} />
                </div>
                <div className="mt-4 rounded-2xl bg-bg-weak-50 p-1 ring-1 ring-inset ring-stroke-soft-200">
                  <h3 className="px-3 pb-2 pt-2 text-label-sm text-text-strong-950">{t("sequenceHeading")}</h3>
                  <ul className="divide-y divide-stroke-soft-200 rounded-xl bg-bg-white-0 px-4 ring-1 ring-inset ring-stroke-soft-200">
                    {summaryItems.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-4 py-2.5 text-paragraph-sm">
                        <span className="text-text-sub-600">{item.label}</span>
                        <span className={cn("inline-flex items-center gap-1", item.enabled ? "text-success-base" : "text-text-soft-400")}>
                          {item.enabled && <RiCheckLine className="size-4" aria-hidden="true" />}
                          {item.enabled ? t("ready") : t("skipped")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {!canLaunch && <p className="mt-4 rounded-xl bg-warning-lighter p-3 text-paragraph-sm text-warning-dark">{t("launchBlocked")}</p>}
                <WizardFooter error={error} onBack={() => setStep(2)} busy={busy} secondaryLabel={t("savePaused")} onSecondary={() => void finish("PAUSED")} nextLabel={t("launch")} onNext={() => void finish("ACTIVE")} nextDisabled={!canLaunch} nextIcon={Rocket} />
              </div>
            )}
          </FramePanel>
        </Frame>
      </div>
    </div>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-label-lg text-text-strong-950">{title}</h2>
      <p className="mt-1 text-paragraph-sm text-text-sub-600">{description}</p>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-xl bg-bg-white-0 p-4 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200"><p className="text-paragraph-xs text-text-sub-600">{label}</p><p className="mt-1 truncate text-label-lg text-text-strong-950" title={value}>{value}</p><p className="text-paragraph-xs text-text-sub-600">{detail}</p></div>; }


function WizardFooter({ error, onBack, onNext, busy, backLabel, nextLabel, nextDisabled, secondaryLabel, onSecondary, nextIcon: NextIcon = ArrowRight }: { error?: string | null; onBack: () => void; onNext: () => void; busy?: boolean; backLabel?: string; nextLabel: string; nextDisabled?: boolean; secondaryLabel?: string; onSecondary?: () => void; nextIcon?: typeof ArrowRight }) {
  const t = useTranslations("linkedinCampaigns.wizard");
  return <div className="mt-8 border-t border-stroke-soft-200 pt-5">{error && <p role="alert" className="mb-3 text-paragraph-sm text-error-base">{error}</p>}<div className="flex flex-wrap items-center justify-between gap-3"><AlignButton.Root variant="neutral" mode="ghost" size="small" onClick={onBack} disabled={busy}><AlignButton.Icon as={ArrowLeft} />{backLabel ?? t("back")}</AlignButton.Root><div className="flex gap-2">{secondaryLabel && onSecondary && <AlignButton.Root variant="neutral" mode="stroke" size="small" onClick={onSecondary} disabled={busy}>{secondaryLabel}</AlignButton.Root>}<AlignButton.Root variant="primary" mode="filled" size="small" onClick={onNext} disabled={busy || nextDisabled}>{busy ? <AlignButton.Icon as={Loader2} className="animate-spin" /> : <AlignButton.Icon as={NextIcon} />}{busy ? t("saving") : nextLabel}</AlignButton.Root></div></div></div>;
}
