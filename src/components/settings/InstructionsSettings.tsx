"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import * as Button from "@/components/alignui/button";
import * as SegmentedControl from "@/components/alignui/segmented-control";
import { Callout } from "./SettingsKit";
import { ListSkeleton } from "./SettingsSkeletons";
import {
  INSTRUCTION_SECTIONS,
  InstructionSection,
  type InstructionField,
} from "@/components/crm/CrmAiInstructions";
import { asObject, crmFetch, errorMessage } from "@/components/crm/crm-utils";
import type { AiInstructionBlock } from "@/lib/crm/ai/instructions";
import { DEFAULT_CALLING_INSTRUCTIONS } from "@/lib/calls/callingInstructions";

type Saved = Record<InstructionField, AiInstructionBlock[]> & { callingInstructionsCustomized: boolean };

function parseBlocks(value: unknown): AiInstructionBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { id, title, content } = entry as Record<string, unknown>;
    if (typeof id !== "string" || typeof title !== "string" || typeof content !== "string") return [];
    return [{ id, title, content }];
  });
}

const FIELDS = Object.keys(INSTRUCTION_SECTIONS) as InstructionField[];

export default function InstructionsSettings() {
  const t = useTranslations("settingsKnowledge.instructions");
  const [pipelineId, setPipelineId] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = asObject(await crmFetch("/settings/ai-instructions"));
      setPipelineId(String(data.pipelineId ?? ""));
      setSaved({
        draftInstructions: parseBlocks(data.draftInstructions),
        classificationInstructions: parseBlocks(data.classificationInstructions),
        callingInstructions: parseBlocks(data.callingInstructions),
        callingInstructionsCustomized: data.callingInstructionsCustomized === true,
      });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ListSkeleton rows={4} />;
  if (error)
    return (
      <Callout
        tone="error"
        title={t("load.errorTitle")}
        action={<Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => void load()}>{t("load.retry")}</Button.Root>}
      >
        {error}
      </Callout>
    );
  if (!saved) return null;
  if (!pipelineId) return <Callout tone="warning" title={t("noPipeline.title")}>{t("noPipeline.body")}</Callout>;

  return (
    // Both panels stay mounted (forceMount + hidden when inactive) so unsaved
    // edits in one tab survive switching to the other.
    <SegmentedControl.Root defaultValue={FIELDS[0]}>
      <SegmentedControl.List className="w-full auto-cols-fr sm:w-fit sm:auto-cols-auto">
        {FIELDS.map((field) => (
          <SegmentedControl.Trigger key={field} value={field} className="gap-1.5 px-3">
            {t(`sections.${field}.title`)}
            <span className="tabular-nums text-text-soft-400">{saved[field].length}</span>
          </SegmentedControl.Trigger>
        ))}
      </SegmentedControl.List>
      {FIELDS.map((field) => (
        <SegmentedControl.Content
          key={field}
          value={field}
          forceMount
          className="mt-5 data-[state=inactive]:hidden"
        >
          <InstructionSection
            {...INSTRUCTION_SECTIONS[field]}
            field={field}
            saved={saved[field]}
            pipelineId={pipelineId}
            onSaved={(blocks) => setSaved((current) => (current ? { ...current, [field]: blocks } : current))}
            {...(field === "callingInstructions"
              ? { defaults: DEFAULT_CALLING_INSTRUCTIONS, customized: saved.callingInstructionsCustomized }
              : {})}
          />
        </SegmentedControl.Content>
      ))}
    </SegmentedControl.Root>
  );
}
