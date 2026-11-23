"use client";

import { useTranslations } from "next-intl";
import type {
  AiLaunchProblem,
  AiLeadStepRef,
  AiSequencesProblem,
  AiSettingsProblem,
  AiStepPosition,
  AiStepRef,
  AiSystemStep,
} from "@/lib/calls/aiCampaigns/api";
import type { AiStepsProblem } from "@/lib/calls/aiCampaigns/contract";

/** Words a sequence problem (the steps editor's checks) from the catalog. */
export function useAiStepsProblemText(): (problem: AiStepsProblem) => string {
  const t = useTranslations("serverCalling.steps");
  return (problem) => {
    switch (problem.code) {
      case "notList":
        return t("notList");
      case "empty":
        return t("empty");
      case "tooMany":
        return t("tooMany", { max: problem.max });
      case "notStep":
        return t("notStep", { n: problem.n });
      case "invalidId":
        return t("invalidId", { n: problem.n });
      case "repeatedId":
        return t("repeatedId", { n: problem.n });
      case "waitRange":
        return t("waitRange", { n: problem.n, max: problem.max });
      case "callInstructionsLong":
        return t("callInstructionsLong", { n: problem.n, max: problem.max });
      case "messageEmpty":
        return t("messageEmpty", { n: problem.n });
      case "messageLong":
        return t("messageLong", { n: problem.n, max: problem.max });
      case "badKind":
        return t("badKind", { n: problem.n });
    }
  };
}

/** Words the launch, settings and sequence problems of lib/calls/aiCampaigns/api from the catalog. */
export function useAiProblemText() {
  const t = useTranslations("serverCalling");
  const stepsText = useAiStepsProblemText();
  return {
    launch(problem: AiLaunchProblem): string {
      return t(`launch.${problem.code}`);
    },
    settings(problem: AiSettingsProblem): string {
      switch (problem.code) {
        case "goal":
          return t("settings.goal");
        case "instructionsLong":
          return t("settings.instructionsLong", { max: problem.max });
        case "bookingUrl":
          return t("settings.bookingUrl");
        case "bookingMessageLong":
          return t("settings.bookingMessageLong", { max: problem.max });
        case "bookingMessageToken":
          return t("settings.bookingMessageToken");
        case "callbacks":
          return t("settings.callbacks", { max: problem.max });
      }
    },
    sequences(found: AiSequencesProblem): string {
      return t(`sequences.${found.sequence}`, { problem: stepsText(found.problem) });
    },
  };
}

/** Words where a lead or a step run sits in a sequence ("Call 2 of 4", "Reach them · Call 1 of 3") from the catalog. */
export function useAiStepText() {
  const t = useTranslations("serverCalling.step");
  const position = (value: AiStepPosition): string => {
    const params = { index: value.index, total: value.total };
    if (value.kind === "call") return value.chase ? t("callChasing", params) : t("call", params);
    return value.chase ? t("messageChasing", params) : t("message", params);
  };
  const system = (value: AiSystemStep): string => {
    switch (value.type) {
      case "callback":
        return t("callback", { n: value.n });
      case "bookingLink":
        return t("bookingLink");
      case "inbound":
        return t("inbound");
      case "now":
        return t("now");
      case "other":
        // An engine key this build does not know is shown as stored.
        return value.key;
    }
  };
  return {
    position,
    /** A lead's current step. */
    lead(ref: AiLeadStepRef): string {
      return ref.type === "step" ? position(ref.position) : t("callback", { n: String(ref.n) });
    },
    /** A step run as the activity feed shows it. */
    activity(ref: AiStepRef): string {
      if (ref.type === "system") return system(ref.system);
      const phase = ref.phase === "chase" ? t("phaseChase") : t("phaseReach");
      return ref.position ? t("withPosition", { phase, position: position(ref.position) }) : phase;
    },
    /** A step as the funnel and bar charts label it. */
    stat(ref: AiStepRef): string {
      if (ref.type === "system") return system(ref.system);
      const phase = ref.phase === "chase" ? t("phaseChase") : t("phaseReach");
      if (ref.removed || !ref.position) return t("removed", { label: phase });
      return ref.phase === "chase" ? t("chaseConfigured", { position: position(ref.position) }) : position(ref.position);
    },
    /** A step run that never started and has no stored reason. */
    errorKind(kind: "starting" | "notStarted"): string {
      return kind === "starting" ? t("errorStarting") : t("errorNotStarted");
    },
  };
}
