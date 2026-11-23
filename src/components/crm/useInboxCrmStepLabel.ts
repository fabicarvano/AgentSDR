"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { inboxCrmStep, type InboxCrmStepInfo, type InboxCrmSummary } from "@/lib/crm/inboxContext";

/**
 * The translated counterpart of `inboxCrmStepLabel` (src/lib/crm/inboxContext.ts): one catalog
 * message per case, from `serverCrm.inboxStep`. Pass `now` only in tests.
 */
export function useInboxCrmStepLabel() {
  const t = useTranslations("serverCrm.inboxStep");
  return useCallback(
    (summary: InboxCrmSummary, now = new Date()): string => {
      const info: InboxCrmStepInfo = inboxCrmStep(summary, now);
      if (info.kind === "reply") return t(`reply.${info.phase}`, { value: info.value ?? 0 });
      if (info.kind === "followUp") return t(`followUp.${info.phase}`, { n: info.n, value: info.value ?? 0 });
      return t(info.kind);
    },
    [t],
  );
}

/**
 * "Follow-up 2 · Nudge" from the follow-up number and the step's stored name, or just "Follow-up 2"
 * when the name is the generic one. The name is the user's own text and stays as stored.
 */
export function useFollowUpStepLabel() {
  const t = useTranslations("serverCrm.followUpStep");
  return useCallback(
    (followUp: number, name: string): string => {
      const generic = `Follow-up ${followUp}`;
      const trimmed = name.trim();
      // The server seeds steps with the English generic name; treat it (or an empty name) as "no custom name".
      if (!trimmed || trimmed.toLowerCase() === generic.toLowerCase()) return t("generic", { n: followUp });
      return t("named", { n: followUp, name });
    },
    [t],
  );
}
