"use client";

import { useTranslations } from "next-intl";
import type { SequenceStep } from "@/lib/outreach/schema";
import SequenceComposer from "../SequenceComposer";

export default function StepSequence({
  campaignId,
  initialSequence,
  onBack,
  onContinue,
}: {
  campaignId: string;
  initialSequence: SequenceStep[];
  onBack: () => void;
  onContinue: (sequence: SequenceStep[]) => void;
}) {
  const t = useTranslations("emailSequence.wizardStep");
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-title-h5 text-text-strong-950">{t("title")}</h2>
        <p className="mt-1 text-paragraph-sm text-text-sub-600">
          {t("description")}
        </p>
      </div>
      <SequenceComposer
        campaignId={campaignId}
        initialSequence={initialSequence}
        onBack={onBack}
        onSaved={onContinue}
        saveLabel={t("saveContinue")}
      />
    </div>
  );
}
