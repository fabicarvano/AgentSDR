"use client";

import { useTranslations } from "next-intl";
import type { AgentVoiceId } from "@/lib/calls/contract";

/** "Kore — firm, female" in the interface language, for a voice id. */
export function useAgentVoiceLabel(): (id: AgentVoiceId) => string {
  const t = useTranslations("serverCalling.voice");
  return (id) => t(id);
}
