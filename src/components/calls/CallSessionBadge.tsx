"use client";

import { useTranslations } from "next-intl";
import * as Badge from "@/components/alignui/badge";
import type { Messages } from "@/i18n/catalog";
import type { CallStatus } from "@/lib/calls/contract";
import { CALL_STATUS_TONE } from "./callStatus";

const COLOR = { neutral: "gray", success: "green", info: "blue", danger: "red", warning: "orange" } as const;

type StatusKey = keyof Messages["callsMain"]["callStatus"];
// Compile-time exhaustiveness: a status added to the contract without a label fails tsc here.
const _statusesCovered: Exclude<CallStatus, StatusKey> extends never ? true : false = true;
void _statusesCovered;

/** One call's status ("Recorded", "Not connected") as a dot badge; the label carries the meaning. */
export function CallSessionBadge({ status }: { status: CallStatus }) {
  const t = useTranslations("callsMain.callStatus");
  return (
    <Badge.Root variant="lighter" size="medium" color={COLOR[CALL_STATUS_TONE[status]]} className="shrink-0 whitespace-nowrap">
      <Badge.Dot />
      {Object.hasOwn(CALL_STATUS_TONE, status) ? t(status) : status}
    </Badge.Root>
  );
}
