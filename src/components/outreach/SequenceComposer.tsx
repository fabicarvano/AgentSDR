"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiTimeLine,
} from "@remixicon/react";

import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { cn } from "@/utils/cn";
import type { SequenceStep } from "@/lib/outreach/schema";
import MergeFieldChips from "./MergeFieldChips";
import PreviewModal from "./PreviewModal";

function emptyStep(stepNumber: number): SequenceStep {
  return {
    stepNumber,
    subject: "",
    body: "",
    waitDays: stepNumber === 1 ? 0 : 3,
  };
}

function sequenceError(
  steps: SequenceStep[],
  t: ReturnType<typeof useTranslations>,
): string | null {
  if (!steps[0]?.subject.trim()) return t("subjectRequired");
  const emptyBody = steps.findIndex((step) => !step.body.trim());
  if (emptyBody >= 0) return t("bodyRequired", { step: emptyBody + 1 });
  return null;
}

export default function SequenceComposer({
  campaignId,
  initialSequence,
  onBack,
  onSaved,
  saveLabel,
  savingLabel,
}: {
  campaignId: string;
  initialSequence: SequenceStep[];
  onBack?: () => void;
  onSaved?: (sequence: SequenceStep[]) => void;
  saveLabel?: string;
  savingLabel?: string;
}) {
  const t = useTranslations("emailSequence.composer");
  const [steps, setSteps] = useState<SequenceStep[]>(() =>
    initialSequence.length > 0 ? initialSequence : [emptyStep(1)],
  );
  // What the server last stored (or the blank first step), so edits that are
  // not saved yet can be told apart and the page can warn before losing them.
  const [savedSteps, setSavedSteps] = useState<SequenceStep[]>(steps);
  const dirty = JSON.stringify(steps) !== JSON.stringify(savedSteps);
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [previewStep, setPreviewStep] = useState<SequenceStep | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Guards against the selected index dangling after a removal.
  const index = Math.min(selected, steps.length - 1);
  const step = steps[index];

  function updateStep(i: number, patch: Partial<SequenceStep>) {
    setSavedAt(null);
    setError(null);
    setSteps((prev) => prev.map((item, n) => (n === i ? { ...item, ...patch } : item)));
  }

  function addStep() {
    setSavedAt(null);
    setError(null);
    setSteps((prev) => [...prev, emptyStep(prev.length + 1)]);
    setSelected(steps.length);
  }

  function removeStep(i: number) {
    setSavedAt(null);
    setError(null);
    setSteps((prev) =>
      prev.filter((_, n) => n !== i).map((item, n) => ({ ...item, stepNumber: n + 1 })),
    );
    setSelected((prev) => Math.max(0, prev > i ? prev - 1 : prev));
  }

  async function handleSave() {
    const validationError = sequenceError(steps, t);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/outreach/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence: steps }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? t("saveFailed"));
        return;
      }
      setSavedAt(Date.now());
      setSavedSteps(steps);
      onSaved?.(steps);
    } catch {
      setError(t("saveFailedNetwork"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Frame>
          <FrameHeader
            title={t("flowTitle")}
            description={t("flowDescription", { count: steps.length })}
          />
          <FramePanel className="p-2 sm:p-3">
            <div className="flex flex-col">
              {steps.map((item, i) => (
                <div key={i}>
                  {i > 0 && (
                    <div className="flex items-center gap-2 py-2 pl-3">
                      <span className="h-6 w-px bg-stroke-soft-200" />
                      <span className="flex items-center gap-1.5 text-paragraph-xs text-text-sub-600">
                        <RiTimeLine className="size-3.5 text-text-soft-400" />
                        {t("waitBefore")}
                        <input
                          type="number"
                          min={1}
                          value={item.waitDays}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            updateStep(i, {
                              waitDays: Number(event.target.value) || 1,
                            })
                          }
                          className="h-6 w-11 rounded-md bg-bg-weak-50 px-1 text-center text-paragraph-xs text-text-strong-950 outline-none ring-1 ring-inset ring-stroke-soft-200 focus:ring-primary-base"
                          aria-label={t("waitAria", { step: item.stepNumber })}
                        />
                        {t("waitAfter")}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    className={cn(
                      "group/step flex w-full items-start gap-2.5 rounded-xl p-3 text-left",
                      "transition duration-200 ease-out",
                      index === i
                        ? "bg-primary-alpha-10 ring-1 ring-inset ring-primary-base"
                        : "hover:bg-bg-weak-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md text-label-xs",
                        index === i
                          ? "bg-primary-base text-static-white"
                          : "bg-bg-weak-50 text-text-sub-600",
                      )}
                    >
                      {item.stepNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-label-sm text-text-strong-950">
                        {t("stepLabel", { step: item.stepNumber })}
                      </span>
                      <span className="mt-0.5 block truncate text-paragraph-xs text-text-soft-400">
                        {item.subject.trim() || (i === 0 ? t("noSubjectYet") : t("sameThread"))}
                      </span>
                    </span>
                    {steps.length > 1 && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={t("removeStep", { step: item.stepNumber })}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeStep(i);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            removeStep(i);
                          }
                        }}
                        className="shrink-0 rounded p-0.5 text-text-soft-400 opacity-0 transition duration-200 ease-out hover:text-error-base focus:opacity-100 group-hover/step:opacity-100"
                      >
                        <RiDeleteBinLine className="size-4" />
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>

            <Button.Root
              variant="neutral"
              mode="stroke"
              size="xsmall"
              className="mt-3 w-full"
              onClick={addStep}
            >
              <Button.Icon as={RiAddLine} />
              {t("addFollowUp")}
            </Button.Root>
          </FramePanel>
        </Frame>

        <Frame>
          <FrameHeader
            title={index === 0 ? t("initialEmail") : t("followUp", { number: index })}
            description={
              index === 0
                ? t("sendsOnStart")
                : t("sendsAfter", { days: step.waitDays })
            }
            actions={
              <Button.Root
                variant="neutral"
                mode="stroke"
                size="xsmall"
                onClick={() => setPreviewStep(step)}
              >
                <Button.Icon as={RiEyeLine} />
                {t("preview")}
              </Button.Root>
            }
          />
          <FramePanel>
            <div>
              <label
                htmlFor={`subject-${index}`}
                className="mb-1.5 block text-label-sm text-text-strong-950"
              >
                {t("subject")}
              </label>
              <Input.Root size="small">
                <Input.Wrapper>
                  <Input.Input
                    id={`subject-${index}`}
                    placeholder={
                      index === 0 ? t("subjectPlaceholder") : t("followUpSubjectPlaceholder")
                    }
                    value={step.subject}
                    onChange={(event) => updateStep(index, { subject: event.target.value })}
                  />
                </Input.Wrapper>
              </Input.Root>
            </div>

            <div className="mt-4">
              <label
                htmlFor={`body-${index}`}
                className="mb-1.5 block text-label-sm text-text-strong-950"
              >
                {t("body")}
              </label>
              <MergeFieldChips
                campaignId={campaignId}
                targetRef={bodyRef}
                value={step.body}
                onChange={(next) => updateStep(index, { body: next })}
              />
              <div>
                <Textarea.Root
                  id={`body-${index}`}
                  ref={bodyRef}
                  simple
                  rows={12}
                  placeholder={t("bodyPlaceholder", { spin: "{A|B}", merge: "{{firstName}}" })}
                  value={step.body}
                  onChange={(event) => updateStep(index, { body: event.target.value })}
                  className="min-h-64"
                />
              </div>
            </div>
          </FramePanel>
        </Frame>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-error-lighter px-4 py-3 text-paragraph-sm text-error-base"
        >
          {error}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-stroke-soft-200 pt-5">
        <div>
          {onBack && (
            <Button.Root variant="neutral" mode="stroke" size="small" onClick={onBack}>
              <Button.Icon as={RiArrowLeftLine} />
              {t("back")}
            </Button.Root>
          )}
        </div>
        <div className="flex items-center gap-3">
          {dirty && !saving ? (
            <span className="text-paragraph-xs text-text-sub-600">{t("unsaved")}</span>
          ) : (
            savedAt && !saving && <span className="text-paragraph-xs text-success-base">{t("saved")}</span>
          )}
          <Button.Root
            variant="primary"
            mode="filled"
            size="small"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (savingLabel ?? t("saving")) : (saveLabel ?? t("save"))}
          </Button.Root>
        </div>
      </div>

      {previewStep && (
        <PreviewModal
          campaignId={campaignId}
          step={previewStep}
          onClose={() => setPreviewStep(null)}
        />
      )}
    </div>
  );
}
