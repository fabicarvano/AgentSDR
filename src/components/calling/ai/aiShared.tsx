"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { Messages } from "@/i18n/catalog";
import * as Badge from "@/components/alignui/badge";
import * as Checkbox from "@/components/alignui/checkbox";
import type { AiCampaignGoal, AiContactStatus } from "@/lib/calls/aiCampaigns/contract";
import type { AiCampaignState } from "@/lib/calls/aiCampaigns/api";
import type { CallingStation, StationStatus } from "@/lib/calls/stationContract";
import { cn } from "@/utils/cn";
import { useApiErrorText } from "@/i18n/useApiErrorText";

type BadgeColor = React.ComponentProps<typeof Badge.Root>["color"];

export const AI_STATUS_COLOR: Record<AiContactStatus, BadgeColor> = {
  queued: "gray",
  reaching: "blue",
  callback: "sky",
  chasing: "purple",
  booked: "green",
  handoff: "teal",
  not_interested: "gray",
  unreached: "yellow",
  replied: "sky",
  stopped: "orange",
  failed: "red",
};

type Shared = Messages["callingAiSetup"]["shared"];

// Enum values stay as stored; the label comes from a typed key. `Record` makes the compiler flag a new value.
const STATUS_KEY: Record<AiContactStatus, keyof Shared["status"]> = {
  queued: "queued",
  reaching: "reaching",
  callback: "callback",
  chasing: "chasing",
  booked: "booked",
  handoff: "handoff",
  not_interested: "notInterested",
  unreached: "unreached",
  replied: "replied",
  stopped: "stopped",
  failed: "failed",
};

/** The label of a lead's AI status; a value this build does not know is shown as stored. */
export function useAiStatusLabel(): (status: AiContactStatus) => string {
  const t = useTranslations("callingAiSetup.shared");
  return (status) => {
    const key = STATUS_KEY[status] as keyof Shared["status"] | undefined;
    return key ? t(`status.${key}`) : status;
  };
}

const GOAL_KEY: Record<AiCampaignGoal, keyof Shared["goal"]> = {
  book_meeting: "bookMeeting",
  human_callback: "humanCallback",
  either: "either",
};

/** The name and the one-line explanation of a campaign goal; a value this build does not know is shown as stored. */
export function useAiGoalText(): (goal: AiCampaignGoal) => { label: string; help: string } {
  const t = useTranslations("callingAiSetup.shared");
  return (goal) => {
    const key = GOAL_KEY[goal] as keyof Shared["goal"] | undefined;
    return key ? { label: t(`goal.${key}.label`), help: t(`goal.${key}.help`) } : { label: goal, help: "" };
  };
}

export function AiStatusBadge({ status }: { status: AiContactStatus }) {
  const statusLabel = useAiStatusLabel();
  return (
    <Badge.Root size="small" variant="lighter" color={AI_STATUS_COLOR[status]} className="whitespace-nowrap">
      <Badge.Dot />
      {statusLabel(status)}
    </Badge.Root>
  );
}

const STATE_COLOR: Record<AiCampaignState, BadgeColor> = { draft: "gray", active: "green", paused: "orange" };

export function AiCampaignStateBadge({ state, size = "medium" }: { state: AiCampaignState; size?: "small" | "medium" }) {
  const t = useTranslations("callingAiSetup.shared");
  return (
    <Badge.Root size={size} variant="lighter" color={STATE_COLOR[state]} className="shrink-0">
      <Badge.Dot />
      {t(`state.${state}`)}
    </Badge.Root>
  );
}

/** Marks a campaign the AI agent runs on its own. */
export function AiAgentBadge() {
  const t = useTranslations("callingAiSetup.shared");
  return (
    <Badge.Root size="small" variant="light" color="purple" className="shrink-0">
      {t("agentBadge")}
    </Badge.Root>
  );
}

/** An Error's message arrives from the server as is (English, batch I); `fallback` is shown for anything else. Pass a translated one: the default is English. */
export function errorText(cause: unknown, fallback = "Something went wrong. Please try again."): string {
  return cause instanceof Error ? cause.message : fallback;
}

/** `errorText` with a translated default fallback. */
export function useErrorText(): (cause: unknown, fallback?: string) => string {
  const t = useTranslations("callingAiSetup.shared");
  const apiErrorText = useApiErrorText();
  // Stable between renders, so it can sit in a hook's dependency list. A coded server error is shown in our words.
  return useCallback((cause, fallback) => apiErrorText(cause instanceof Error ? cause : null, fallback ?? t("errors.generic")), [t, apiErrorText]);
}

/** Asks the browser to confirm leaving the page while `dirty`. */
export function useBeforeUnload(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

const STATION_LABEL_KEY: Record<StationStatus, keyof Shared["numberPicker"]["status"]> = {
  onboarding: "onboarding",
  active: "active",
  paused: "paused",
  logged_out: "loggedOut",
  banned: "banned",
};
const STATION_COLOR: Record<StationStatus, BadgeColor> = { onboarding: "gray", active: "green", paused: "orange", logged_out: "red", banned: "red" };

/** The calling numbers a campaign may place its calls from. Only active or still-onboarding numbers can be chosen. */
export function NumberPicker({
  stations,
  selectedIds,
  onChange,
  error,
  disabled,
}: {
  stations: CallingStation[] | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const tp = useTranslations("callingAiSetup.shared.numberPicker");
  if (stations === null) {
    return <p className="rounded-xl bg-bg-weak-50 p-3 text-paragraph-sm text-text-sub-600">{error ?? tp("loading")}</p>;
  }
  if (stations.length === 0) {
    return (
      <p className="rounded-xl bg-warning-lighter p-3 text-paragraph-sm text-warning-dark">
        {tp.rich("empty", { link: (chunks) => <Link href="/settings/whatsapp-stations" className="underline">{chunks}</Link> })}
      </p>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {stations.map((station) => {
        const checked = selectedIds.includes(station.id);
        const usable = station.status === "active" || station.status === "onboarding";
        return (
          <label
            key={station.id}
            className={cn(
              "flex items-center gap-3 rounded-xl p-3 ring-1 ring-inset transition",
              usable && !disabled ? "cursor-pointer" : "cursor-not-allowed opacity-60",
              checked ? "bg-bg-weak-50 ring-primary-base" : "ring-stroke-soft-200",
              usable && !checked && !disabled && "hover:bg-bg-weak-50",
            )}
          >
            <Checkbox.Root
              checked={checked}
              disabled={disabled || (!usable && !checked)}
              onCheckedChange={() => onChange(checked ? selectedIds.filter((id) => id !== station.id) : [...selectedIds, station.id])}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-label-sm text-text-strong-950">{station.name}</span>
              <span className="block truncate text-paragraph-xs tabular-nums text-text-sub-600">{station.phone}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge.Root size="small" variant="light" color={STATION_COLOR[station.status]}>{STATION_LABEL_KEY[station.status] ? tp(`status.${STATION_LABEL_KEY[station.status]}`) : station.status}</Badge.Root>
                {station.openOn && (
                  <Badge.Root size="small" variant="light" color="green" title={tp("readyOnTitle", { host: station.openOn })}>
                    {tp("readyOn", { host: station.openOn })}
                  </Badge.Root>
                )}
                {station.status === "onboarding" && (
                  <span className="text-paragraph-xs text-text-soft-400">{tp("linkBeforeLaunch")}</span>
                )}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Date, "action required" and call-length text in the interface language. */
export function useAiFormat() {
  const t = useTranslations("callingAiSetup.shared");
  const format = useFormatter();
  const formatWhen = (iso: string | null): string => {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return format.dateTime(date, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };
  const actionRequiredText = (iso: string): string => {
    const due = new Date(iso).getTime() <= Date.now();
    return t(due ? "when.actionRequiredSince" : "when.actionRequiredFrom", { date: formatWhen(iso) });
  };
  const formatCallLength = (ms: number | null): string | null => {
    if (!ms || ms < 1000) return null;
    const seconds = Math.round(ms / 1000);
    return seconds < 60
      ? t("callLength.seconds", { seconds })
      : t("callLength.minutes", { minutes: Math.floor(seconds / 60), seconds: String(seconds % 60).padStart(2, "0") });
  };
  return { formatWhen, actionRequiredText, formatCallLength };
}

/** "2 days" / "5 hours": a wait between steps, in whole days when it is a multiple of 24 hours. */
export function useFormatDelay(): (hours: number) => string {
  const td = useTranslations("callingAiSetup.shared.delay");
  return (hours) => (hours % 24 === 0 ? td("days", { count: hours / 24 }) : td("hours", { count: hours }));
}
