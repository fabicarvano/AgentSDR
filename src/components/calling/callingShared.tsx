"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { RiSparklingLine } from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import { ClassificationPicker } from "@/components/crm/ActionRowTools";
import { useCrmText } from "@/components/crm/useCrmText";
import type { Messages } from "@/i18n/catalog";
import { listCrmCategories, setLeadStage } from "@/lib/calls/client";
import {
  CONTACT_CALL_STATUS_DEFINITIONS,
  RETRY_AFTER_DAYS,
  type CallDisposition,
  type CallCampaignStatus,
  type CampaignContact,
  type CampaignContactStage,
  type ContactCallStatus,
  type LeadStageCategory,
} from "@/lib/calls/contract";
import { cn } from "@/utils/cn";

/** Total calls the retry schedule allows before a lead is done: the first plus one per retry step, plus the last unanswered one. */
export const MAX_UNANSWERED_ATTEMPTS = RETRY_AFTER_DAYS.length + 1;

type SharedMessages = Messages["callingMain"]["shared"];

// Compile-time exhaustiveness: a status, stage or outcome added to lib/calls/contract.ts without a label fails tsc here.
const CALL_STATUS_KEYS: Record<ContactCallStatus, true> = { new: true, calling: true, no_answer: true, busy: true, connected: true, not_on_whatsapp: true, wrong_number: true, failed: true };
const STAGE_KEYS: Record<CampaignContactStage, true> = { to_call: true, follow_up: true, done: true };
const DISPOSITION_KEYS: Record<CallDisposition, true> = { no_answer: true, busy: true, not_on_whatsapp: true, wrong_number: true, interested: true, meeting_booked: true, callback: true, send_details: true, not_interested: true, do_not_call: true };
const _callStatusCovered: Exclude<ContactCallStatus, keyof SharedMessages["callStatus"]> extends never ? true : false = true;
const _stageCovered: Exclude<CampaignContactStage, keyof SharedMessages["stage"]> extends never ? true : false = true;
const _dispositionCovered: Exclude<CallDisposition, keyof SharedMessages["disposition"]> extends never ? true : false = true;
void _callStatusCovered;
void _stageCovered;
void _dispositionCovered;

/**
 * Translated labels for the enums of lib/calls/contract.ts (the code and the database keep the stable
 * values; only the text comes from the catalog). A value this build does not know is shown as stored.
 */
export function useCallingLabels() {
  const t = useTranslations("callingMain.shared");
  const callStatusLabel = useCallback(
    (status: string) => (Object.hasOwn(CALL_STATUS_KEYS, status) ? t(`callStatus.${status as ContactCallStatus}`) : status),
    [t],
  );
  const stageLabel = useCallback(
    (stage: string) => (Object.hasOwn(STAGE_KEYS, stage) ? t(`stage.${stage as CampaignContactStage}`) : stage),
    [t],
  );
  const dispositionLabel = useCallback(
    (disposition: string) => (Object.hasOwn(DISPOSITION_KEYS, disposition) ? t(`disposition.${disposition as CallDisposition}`) : disposition),
    [t],
  );
  return useMemo(() => ({ callStatusLabel, stageLabel, dispositionLabel }), [callStatusLabel, stageLabel, dispositionLabel]);
}

/** Where the lead is in the calling flow, spelled out; the colour only reinforces it. */
export function CallStatusBadge({ status }: { status: ContactCallStatus }) {
  const { callStatusLabel } = useCallingLabels();
  const definition = CONTACT_CALL_STATUS_DEFINITIONS[status];
  return (
    <Badge.Root variant="lighter" size="medium" color={definition.tone} className="shrink-0 whitespace-nowrap">
      <Badge.Dot />
      {callStatusLabel(status)}
    </Badge.Root>
  );
}

/** Active / Paused, as the campaign list and the campaign page show it. */
export function CampaignStatusBadge({ status }: { status: CallCampaignStatus }) {
  const t = useTranslations("callingMain.shared");
  const paused = status === "paused";
  return (
    <Badge.Root variant="lighter" size="medium" color={paused ? "orange" : "green"} className="shrink-0">
      <Badge.Dot />
      {paused ? t("campaignStatus.paused") : t("campaignStatus.active")}
    </Badge.Root>
  );
}

/**
 * The translated hints of a contact row: `attemptHint` ("Attempt 2 of 4", for statuses that count toward the
 * retry schedule) and `followUpHint` ("Due today", "Due in 3 days", or "Overdue · 12 Sep" with overdue: true).
 */
export function useCallingHints() {
  const t = useTranslations("callingMain.shared");
  const format = useFormatter();
  const attemptHint = useCallback(
    (contact: Pick<CampaignContact, "callStatus" | "unansweredAttempts">): string | null => {
      if (contact.callStatus !== "no_answer" && contact.callStatus !== "busy") return null;
      if (contact.unansweredAttempts <= 0) return null;
      return t("attempt", { current: Math.min(contact.unansweredAttempts, MAX_UNANSWERED_ATTEMPTS), total: MAX_UNANSWERED_ATTEMPTS });
    },
    [t],
  );
  const followUpHint = useCallback(
    (contact: Pick<CampaignContact, "stage" | "followUpAt">, now = new Date()): { text: string; overdue: boolean } | null => {
      if (!contact.followUpAt || contact.stage === "done") return null;
      const due = new Date(contact.followUpAt);
      if (Number.isNaN(due.getTime())) return null;
      const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
      const days = Math.round((day(due) - day(now)) / 86_400_000);
      if (days < 0) return { text: t("followUp.overdue", { date: format.dateTime(due, { day: "numeric", month: "short" }) }), overdue: true };
      if (days === 0) return { text: t("followUp.today"), overdue: false };
      if (days === 1) return { text: t("followUp.tomorrow"), overdue: false };
      return { text: t("followUp.inDays", { count: days }), overdue: false };
    },
    [t, format],
  );
  return useMemo(() => ({ attemptHint, followUpHint }), [attemptHint, followUpHint]);
}

/** The company's favicon; one that fails to load is dropped, not left broken. */
export function CompanyFavicon({ domain, className }: { domain: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element -- remote favicon service, sized by CSS
  return <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`} alt="" className={cn("size-3.5 shrink-0 rounded-sm", className)} onError={() => setFailed(true)} />;
}

export function bareDomain(website: string): string {
  return website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
}

let categoriesCache: Promise<Record<string, unknown>[]> | null = null;

/** The CRM's categories, fetched once per page load and shared by every picker. */
export function useCrmCategories(): Record<string, unknown>[] {
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    let active = true;
    categoriesCache ??= listCrmCategories().catch((cause) => {
      categoriesCache = null;
      throw cause;
    });
    categoriesCache.then((next) => { if (active) setCategories(next); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return categories;
}

/**
 * The lead's CRM stage as a picker — the CRM's own ClassificationPicker, so it
 * looks and groups exactly like the CRM's. A pick calls setLeadStage and hands
 * the updated contact back so the row can be replaced in place.
 */
export function LeadStagePicker({
  contact,
  categories,
  compact,
  onUpdated,
}: {
  contact: CampaignContact;
  categories: Record<string, unknown>[];
  compact?: boolean;
  onUpdated: (contact: CampaignContact) => void;
}) {
  const t = useTranslations("callingMain.shared");
  const { errorMessage } = useCrmText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const crm = contact.crm;
  const byModel = crm?.categorySource === "integration" || crm?.categorySource === "ai";

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <ClassificationPicker
          compact={compact}
          categories={categories}
          categoryKey={crm?.categoryKey ?? null}
          subcategoryId={crm?.subcategoryId ?? null}
          subcategoryName={crm?.subcategoryName ?? null}
          disabled={busy}
          onChange={async (choice) => {
            setBusy(true);
            setError("");
            try {
              onUpdated(await setLeadStage(contact.id, {
                categoryKey: choice.categoryKey as LeadStageCategory,
                subcategoryId: choice.subcategoryId,
              }));
            } catch (cause) {
              setError(errorMessage(cause));
            } finally {
              setBusy(false);
            }
          }}
        />
        {byModel && crm?.categoryKey && (
          <span title={t("aiStageTitle")} className={cn("inline-flex h-5 shrink-0 items-center gap-0.5 rounded px-1 text-label-xs text-feature-dark ring-1 ring-inset ring-feature-light bg-feature-lighter")}>
            <RiSparklingLine className="size-3" aria-hidden="true" />{t("aiTag")}
          </span>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-paragraph-xs text-error-dark">{error}</p>}
    </div>
  );
}

const AVATAR_TONES = [
  "bg-information-lighter text-information-dark",
  "bg-success-lighter text-success-dark",
  "bg-warning-lighter text-warning-dark",
  "bg-error-lighter text-error-dark",
  "bg-feature-lighter text-feature-dark",
  "bg-verified-lighter text-verified-dark",
  "bg-away-lighter text-away-dark",
  "bg-stable-lighter text-stable-dark",
];

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0] ?? "?";
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function toneFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** A round avatar: the photo when there is one and it loads, otherwise initials on a colour derived from the name. */
export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  // Keyed by the URL, so a new photo gets a fresh chance after one failed.
  return <AvatarInner key={src ?? ""} name={name} src={src} className={className} />;
}

function AvatarInner({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const base = "inline-flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full";
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element -- remote or uploaded photo, sized by CSS
    return <img src={src} alt="" className={cn(base, "object-cover", className)} onError={() => setFailed(true)} referrerPolicy="no-referrer" />;
  }
  return <span aria-hidden="true" className={cn(base, "text-label-xs", toneFor(name), className)}>{initialsOf(name)}</span>;
}

/** "Title @ Company", or whichever half exists; null when neither. */
export function titleAtCompany(person: { title: string | null; companyName: string | null }): string | null {
  const title = person.title?.trim();
  const company = person.companyName?.trim();
  if (title && company) return `${title} @ ${company}`;
  return title || company || null;
}
