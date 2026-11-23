"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RiErrorWarningLine, RiLoader4Line, RiSaveLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { aiSequencesError, type AiCampaignDetail, type AiStepStat } from "@/lib/calls/aiCampaigns/api";
import { updateAiCampaign } from "@/lib/calls/aiCampaigns/client";
import type { AiCampaignStep } from "@/lib/calls/aiCampaigns/contract";
import { cn } from "@/utils/cn";
import { useBeforeUnload, useErrorText } from "./aiShared";
import { AiStepsEditor } from "./AiStepsEditor";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The first step runs as soon as the lead is queued, so its wait is always 0. */
const withFirstWaitCleared = (steps: AiCampaignStep[]): AiCampaignStep[] => steps.map((step, index) => (index === 0 ? { ...step, delayHours: 0 } : step));

/**
 * The Sequence tab: "Reach them" (calls and messages until they have a real
 * conversation) and, unless the goal is a hand-over, "If they said yes but
 * haven't booked". One Save for both; unsaved edits survive tab changes (the
 * tab stays mounted) and ask before the page is closed.
 */
export function AiSequenceTab({
  campaign,
  stats,
  onSaved,
  onDirtyChange,
}: {
  campaign: AiCampaignDetail;
  stats: AiStepStat[] | undefined;
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useTranslations("callingAiSetup.sequence");
  const errorText = useErrorText();
  const [steps, setSteps] = useState<AiCampaignStep[]>(() => campaign.steps.map((step) => ({ ...step })));
  const [chaseSteps, setChaseSteps] = useState<AiCampaignStep[]>(() => campaign.chaseSteps.map((step) => ({ ...step })));
  const [saved, setSaved] = useState({ steps: campaign.steps, chaseSteps: campaign.chaseSteps });
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = !same(withFirstWaitCleared(steps), withFirstWaitCleared(saved.steps)) || !same(withFirstWaitCleared(chaseSteps), withFirstWaitCleared(saved.chaseSteps));
  useBeforeUnload(dirty);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const showChase = campaign.goal !== "human_callback";
  const problem = useMemo(() => aiSequencesError(steps, showChase ? chaseSteps : []), [steps, chaseSteps, showChase]);

  async function save() {
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError(null);
    try {
      const nextSteps = withFirstWaitCleared(steps);
      const nextChase = withFirstWaitCleared(chaseSteps);
      const updated = await updateAiCampaign(campaign.id, { steps: nextSteps, chaseSteps: nextChase });
      setSaved({ steps: updated.steps, chaseSteps: updated.chaseSteps });
      setSteps(updated.steps.map((step) => ({ ...step })));
      setChaseSteps(updated.chaseSteps.map((step) => ({ ...step })));
      setJustSaved(true);
      onSaved();
    } catch (cause) {
      setError(errorText(cause, t("saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  const change = <T,>(setter: (value: T) => void) => (value: T) => {
    setJustSaved(false);
    setError(null);
    setter(value);
  };

  return (
    <div className="space-y-4">
      <Frame>
        <FrameHeader
          title={t("reachTitle")}
          description={t("reachDescription")}
        />
        <FramePanel>
          <AiStepsEditor
            steps={steps}
            onChange={change(setSteps)}
            campaignId={campaign.id}
            agentName={campaign.agentName}
            agentVoice={campaign.agentVoice}
            stats={stats}
            statsPhase="reach"
            emptyText={t("reachEmpty")}
          />
        </FramePanel>
        <FrameFooter>
          {t("reachFooter")}
        </FrameFooter>
      </Frame>

      {showChase && (
        <Frame>
          <FrameHeader
            title={t("chaseTitle")}
            description={t("chaseDescription")}
          />
          <FramePanel>
            <AiStepsEditor
              steps={chaseSteps}
              onChange={change(setChaseSteps)}
              allowEmpty
              campaignId={campaign.id}
              agentName={campaign.agentName}
              agentVoice={campaign.agentVoice}
              stats={stats}
              statsPhase="chase"
              emptyText={t("chaseEmpty")}
            />
          </FramePanel>
        </Frame>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {(problem || error) && (
          <p role="alert" className="mr-auto flex items-center gap-2 rounded-xl bg-error-lighter px-3 py-2 text-paragraph-sm text-error-base">
            <RiErrorWarningLine className="size-4 shrink-0" />{error ?? problem}
          </p>
        )}
        {dirty && !problem && <span className="text-paragraph-xs text-warning-dark">{t("unsaved")}</span>}
        {justSaved && !dirty && <span role="status" className="text-paragraph-xs text-success-base">{t("saved")}</span>}
        <Button.Root variant="primary" mode="filled" size="small" onClick={() => void save()} disabled={saving || !dirty || Boolean(problem)}>
          <Button.Icon as={saving ? RiLoader4Line : RiSaveLine} className={cn(saving && "animate-spin")} />
          {saving ? t("saving") : t("save")}
        </Button.Root>
      </div>
    </div>
  );
}
