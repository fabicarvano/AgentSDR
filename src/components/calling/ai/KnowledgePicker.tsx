"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RiArrowDownSLine, RiBookOpenLine, RiLoader4Line } from "@remixicon/react";
import * as Checkbox from "@/components/alignui/checkbox";
import * as Popover from "@/components/alignui/popover";
import type { Messages } from "@/i18n/catalog";

type KnowledgeOption = { id: string; title: string; kind: string; alwaysInclude: boolean; chars: number };

// Document kinds are stored as these values; the label comes from a key, and a kind not listed here shows as stored.
const KIND_KEYS: Record<string, keyof Messages["callingAiSetup"]["knowledge"]["kind"]> = {
  company: "company",
  product: "product",
  pricing: "pricing",
  faq: "faq",
  scheduling: "scheduling",
  objection: "objection",
  case_study: "caseStudy",
  custom: "custom",
};

/** Chips shown in the closed dropdown before "+N". */
const MAX_CHIPS = 4;

/**
 * Which CRM Knowledge documents an AI campaign's calls know: a dropdown of the
 * organization's documents with checkboxes and "Select all". `value` null
 * means the documents marked "always include" (what a call placed by hand
 * knows); choosing anything stores the exact list.
 */
export function KnowledgePicker({ value, onChange, disabled }: {
  value: string[] | null;
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("callingAiSetup.knowledge");
  const [options, setOptions] = useState<KnowledgeOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/crm/knowledge")
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          documents?: { id: string; title: string; kind: string; alwaysInclude: boolean; latest?: { content?: string } | null }[];
          error?: string;
        } | null;
        if (!response.ok || !body?.documents) throw new Error(body?.error ?? `HTTP ${response.status}`);
        if (live) {
          setOptions(body.documents.map((document) => ({
            id: document.id,
            title: document.title,
            kind: document.kind,
            alwaysInclude: document.alwaysInclude,
            chars: document.latest?.content?.trim().length ?? 0,
          })));
        }
      })
      .catch((caught: unknown) => live && setError(caught instanceof Error ? caught.message : String(caught)));
    return () => {
      live = false;
    };
  }, []);

  const selected = useMemo(() => {
    if (value) return new Set(value);
    return new Set((options ?? []).filter((option) => option.alwaysInclude).map((option) => option.id));
  }, [value, options]);

  const chosen = (options ?? []).filter((option) => selected.has(option.id));
  const used = chosen.reduce((sum, option) => sum + option.chars, 0);
  const allSelected = !!options?.length && chosen.length === options.length;

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onChange((options ?? []).filter((option) => next.has(option.id)).map((option) => option.id));
  };

  // The closed dropdown names what is picked: each title as a short chip ("Case study: Acme…").
  const summary = options === null
    ? t("loading")
    : !options.length
      ? t("noDocuments")
      : !chosen.length
        ? t("noneSelected")
        : null;
  const shown = chosen.slice(0, MAX_CHIPS);
  const hidden = chosen.length - shown.length;

  return (
    <div className="space-y-1.5">
      <Popover.Root>
        <Popover.Trigger asChild disabled={disabled || !options?.length}>
          <button
            type="button"
            className="flex h-9 w-full items-center gap-2 rounded-lg bg-bg-white-0 px-3 text-left text-paragraph-sm text-text-strong-950 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-weak-50 focus:outline-none focus-visible:ring-stroke-strong-950 disabled:cursor-not-allowed disabled:text-text-disabled-300"
            aria-label={t("ariaLabel")}
          >
            {options === null ? <RiLoader4Line className="size-4 shrink-0 animate-spin text-text-soft-400" /> : <RiBookOpenLine className="size-4 shrink-0 text-text-soft-400" />}
            {summary !== null ? (
              <span className="min-w-0 flex-1 truncate">{summary}</span>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden" title={chosen.map((option) => option.title).join(", ")}>
                {shown.map((option) => (
                  <span key={option.id} className="max-w-[9rem] shrink truncate rounded-md bg-bg-weak-50 px-1.5 py-0.5 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">
                    {option.title}
                  </span>
                ))}
                {hidden > 0 && <span className="shrink-0 text-label-xs text-text-soft-400">{t("more", { count: hidden })}</span>}
              </span>
            )}
            <RiArrowDownSLine className="size-4 shrink-0 text-text-soft-400" />
          </button>
        </Popover.Trigger>
        <Popover.Content align="start" showArrow={false} sideOffset={6} className="w-[min(28rem,calc(100vw-2rem))] p-0">
          <div className="flex items-center justify-between border-b border-stroke-soft-200 px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-label-sm text-text-strong-950">
              <Checkbox.Root
                checked={allSelected ? true : chosen.length ? "indeterminate" : false}
                onCheckedChange={(checked) => onChange(checked === true ? (options ?? []).map((option) => option.id) : [])}
              />
              {t("selectAll")}
            </label>
            <span className="text-paragraph-xs text-text-soft-400">{t("selected", { count: chosen.length })}</span>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {(options ?? []).map((option) => (
              <li key={option.id}>
                <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 hover:bg-bg-weak-50">
                  <Checkbox.Root className="mt-0.5" checked={selected.has(option.id)} onCheckedChange={(checked) => toggle(option.id, checked === true)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label-sm text-text-strong-950">{option.title}</span>
                    <span className="block text-paragraph-xs text-text-sub-600">
                      {t(option.alwaysInclude ? "metaCharsAlways" : "metaChars", { kind: KIND_KEYS[option.kind] ? t(`kind.${KIND_KEYS[option.kind]}`) : option.kind, count: option.chars })}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Root>
      {error ? (
        <p className="text-paragraph-xs text-error-base">{t("loadFailed", { error })}</p>
      ) : (
        <p className="text-paragraph-xs text-text-sub-600">
          {used ? t("hintUsed", { count: used }) : t("hint")}
        </p>
      )}
    </div>
  );
}
