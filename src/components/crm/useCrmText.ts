"use client";

import { useCallback, useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { Messages } from "@/i18n/catalog";
import { CrmHttpError, displayNameOr, type CrmCategory, type CrmChannel } from "./crm-utils";
import { useApiErrorText } from "@/i18n/useApiErrorText";

type CategoryKey = keyof Messages["crmShared"]["category"];
type ChannelKey = keyof Messages["crmShared"]["channel"];

// Compile-time exhaustiveness: a category or channel added to crm-utils without a label fails tsc here.
const _categoriesCovered: Exclude<CrmCategory | "unclassified", CategoryKey> extends never ? true : false = true;
const _channelsCovered: Exclude<CrmChannel, ChannelKey> extends never ? true : false = true;
void _categoriesCovered;
void _channelsCovered;

/**
 * The translated counterparts of the text helpers in `crm-utils.ts`. Those keep their English
 * output for the screens of batches that are not translated yet (E to H); screens of the CRM and
 * the inbox call this hook instead. Anything it does not know (a category key from the database,
 * a channel it has not seen) is shown as stored, never thrown.
 */
export function useCrmText() {
  const t = useTranslations("crmShared");
  const format = useFormatter();

  const categoryLabel = useCallback(
    (key: string | null | undefined): string => {
      const k = key ?? "unclassified";
      // A category the catalog does not know (one the organization created, or a seeded name) is shown as stored, readable: "meeting_requested" -> "Meeting requested".
      return Object.hasOwn(CATEGORY_KEYS, k) ? t(`category.${k as CategoryKey}`) : humanizeKey(k);
    },
    [t],
  );

  const channelLabel = useCallback(
    (key: unknown): string => {
      if (typeof key !== "string" || !key) return "—";
      return Object.hasOwn(CHANNEL_KEYS, key) ? t(`channel.${key as ChannelKey}`) : key;
    },
    [t],
  );

  const displayName = useCallback((value: Record<string, unknown>) => displayNameOr(value, t("unknownContact")), [t]);

  const formatDate = useCallback(
    (value: unknown, fallback = "—"): string => {
      if (!value) return fallback;
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) return fallback;
      return format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });
    },
    [format],
  );

  const timeAgo = useCallback(
    (value: unknown, fallback = "—"): string => {
      if (!value) return fallback;
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) return fallback;
      const minutes = Math.round((Date.now() - date.getTime()) / 60000);
      if (minutes < 1) return t("timeAgo.justNow");
      if (minutes < 60) return t("timeAgo.minutes", { count: minutes });
      const hours = Math.round(minutes / 60);
      if (hours < 24) return t("timeAgo.hours", { count: hours });
      const days = Math.round(hours / 24);
      if (days < 30) return t("timeAgo.days", { count: days });
      return formatDate(value, fallback);
    },
    [t, formatDate],
  );

  const relativeDate = useCallback(
    (value: unknown): string => {
      if (!value) return "—";
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) return "—";
      const minutes = Math.round((date.getTime() - Date.now()) / 60000);
      if (Math.abs(minutes) < 60) return minutes < 0 ? t("relative.overdueMinutes", { count: Math.abs(minutes) }) : t("relative.inMinutes", { count: minutes });
      const hours = Math.round(minutes / 60);
      if (Math.abs(hours) < 24) return hours < 0 ? t("relative.overdueHours", { count: Math.abs(hours) }) : t("relative.inHours", { count: hours });
      const days = Math.round(hours / 24);
      return days < 0 ? t("relative.overdueDays", { count: Math.abs(days) }) : t("relative.inDays", { count: days });
    },
    [t],
  );

  /** The route's coded error in our words, else its English message as it arrives; our own fallbacks are translated. */
  const apiErrorText = useApiErrorText();
  const errorMessage = useCallback(
    (error: unknown): string => {
      if (error instanceof CrmHttpError && !error.fromServer) return t("requestFailed", { status: error.status });
      return error instanceof Error ? apiErrorText(error, t("somethingWentWrong")) : t("somethingWentWrong");
    },
    [t, apiErrorText],
  );

  return useMemo(
    () => ({ categoryLabel, channelLabel, displayName, formatDate, timeAgo, relativeDate, errorMessage }),
    [categoryLabel, channelLabel, displayName, formatDate, timeAgo, relativeDate, errorMessage],
  );
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/[_-]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key;
}

const CATEGORY_KEYS: Record<CategoryKey, true> = { customer: true, interested: true, not_interested: true, other: true, unclassified: true };
const CHANNEL_KEYS: Record<ChannelKey, true> = { email: true, linkedin: true, whatsapp: true };
