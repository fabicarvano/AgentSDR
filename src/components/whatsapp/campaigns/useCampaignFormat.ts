"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { WhatsappCampaignImportResponse, WhatsappCampaignLeadStatus, WhatsappCampaignStatus } from "@/lib/whatsapp/campaigns/contract";
import { CAMPAIGN_STATUS, LEAD_STATUS } from "./metrics";

/**
 * Locale-aware text for the WhatsApp campaign screens: status labels, waits,
 * relative times and dates. Status values are enums; an unknown one shows its raw value.
 */
export function useCampaignFormat() {
  const t = useTranslations("whatsappCampaigns.time");
  const ts = useTranslations("whatsappCampaigns.status");
  const format = useFormatter();

  const campaignStatus = (status: WhatsappCampaignStatus) => {
    const meta = CAMPAIGN_STATUS[status] as (typeof CAMPAIGN_STATUS)[WhatsappCampaignStatus] | undefined;
    return meta ? { label: ts(meta.labelKey), color: meta.color } : { label: String(status), color: "gray" as const };
  };

  const leadStatus = (status: WhatsappCampaignLeadStatus) => {
    const meta = LEAD_STATUS[status] as (typeof LEAD_STATUS)[WhatsappCampaignLeadStatus] | undefined;
    return meta ? { label: ts(meta.labelKey), color: meta.color } : { label: String(status), color: "gray" as const };
  };

  return {
    campaignStatus,
    leadStatus,
    number: (value: number) => format.number(value),
    /** "3 days" / "5 hours": whole days when the wait is a multiple of 24 hours. */
    delay: (hours: number) => (hours % 24 === 0 ? t("days", { count: hours / 24 }) : t("hours", { count: hours })),
    /** "5 minutes ago" / "in 3 hours"; a short date beyond 30 days; "—" for no value. */
    relative: (iso: string | null): string => {
      if (!iso) return "—";
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "—";
      const now = new Date();
      const abs = Math.abs(Math.round((date.getTime() - now.getTime()) / 60000));
      if (abs < 1) return t("justNow");
      if (abs >= 60 * 24 * 30) return format.dateTime(date, { month: "short", day: "numeric" });
      return format.relativeTime(date, now);
    },
    shortDate: (iso: string) => format.dateTime(new Date(iso), { month: "short", day: "numeric" }),
    longDate: (iso: string) => format.dateTime(new Date(iso), { month: "short", day: "numeric", year: "numeric" }),
  };
}

/** "12 added · 2 already in the campaign · 1 skipped (reason, …)" after a spreadsheet import. */
export function useImportSummary() {
  const tl = useTranslations("whatsappCampaigns.leads");
  return (result: WhatsappCampaignImportResponse): string =>
    tl("importSummary", {
      added: result.added,
      already: result.alreadyInCampaign ?? 0,
      skipped: result.skipped.length,
      // The first reason comes from the server as it is written (batch I).
      first: result.skipped[0] ?? "",
      more: Math.max(0, result.skipped.length - 1),
    });
}
