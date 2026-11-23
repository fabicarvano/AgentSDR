"use client";

import { useTranslations } from "next-intl";
import * as Badge from "@/components/alignui/badge";
import type { Messages } from "@/i18n/catalog";
import type { AgentOutcome } from "@/lib/calls/contract";

const COLOR = {
  meeting_booked: "green",
  interested: "green",
  human_callback: "green",
  call_back: "blue",
  not_interested: "red",
  wrong_person: "orange",
  do_not_contact: "red",
  no_response: "gray",
  other: "gray",
} as const satisfies Record<AgentOutcome["outcome"], string>;

type OutcomeKey = keyof Messages["callsMain"]["agentOutcome"];
// Compile-time exhaustiveness: an outcome added to the contract without a label fails tsc here.
const _outcomesCovered: Exclude<AgentOutcome["outcome"], OutcomeKey> extends never ? true : false = true;
void _outcomesCovered;

/** The translated label of what the AI agent reported; a value the catalog does not know is shown as stored. */
export function useAgentOutcomeLabel() {
  const t = useTranslations("callsMain.agentOutcome");
  return (outcome: string): string => (Object.hasOwn(COLOR, outcome) ? t(outcome as OutcomeKey) : outcome);
}

/** What the AI agent reported with record_outcome: a badge, when, and a one-line summary. */
export function AgentOutcomeLine({ outcome }: { outcome: AgentOutcome }) {
  const outcomeLabel = useAgentOutcomeLabel();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge.Root variant="lighter" size="medium" color={COLOR[outcome.outcome] ?? "gray"} className="shrink-0 whitespace-nowrap">
          <Badge.Dot />
          {outcomeLabel(outcome.outcome)}
        </Badge.Root>
        {outcome.when && <span className="text-paragraph-xs text-text-sub-600">{outcome.when}</span>}
      </div>
      {outcome.summary && <p className="text-paragraph-sm text-text-sub-600">{outcome.summary}</p>}
    </div>
  );
}
