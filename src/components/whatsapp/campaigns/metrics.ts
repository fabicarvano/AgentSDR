import type * as Badge from "@/components/alignui/badge";
import type { Messages } from "@/i18n/catalog";
import type {
  WhatsappCampaignLeadStatus,
  WhatsappCampaignStats,
  WhatsappCampaignStatus,
} from "@/lib/whatsapp/campaigns/contract";

type BadgeColor = React.ComponentProps<typeof Badge.Root>["color"];

/** Status values are enums (stable in code and DB); the label comes from a typed key, see useCampaignFormat(). */
type StatusLabelKey = keyof Messages["whatsappCampaigns"]["status"];

export const CAMPAIGN_STATUS: Record<WhatsappCampaignStatus, { labelKey: StatusLabelKey; color: BadgeColor }> = {
  active: { labelKey: "active", color: "green" },
  paused: { labelKey: "paused", color: "orange" },
};

/** Every lead status, in sequence order, with its label and badge colour. */
export const LEAD_STATUS: Record<WhatsappCampaignLeadStatus, { labelKey: StatusLabelKey; color: BadgeColor }> = {
  queued: { labelKey: "queued", color: "gray" },
  in_sequence: { labelKey: "inSequence", color: "blue" },
  completed: { labelKey: "completed", color: "purple" },
  replied: { labelKey: "replied", color: "green" },
  stopped: { labelKey: "stopped", color: "orange" },
  failed: { labelKey: "failed", color: "red" },
};

/**
 * What a campaign's lead-status counts add up to. A lead's status is where
 * it is now, so "messaged" is every lead past the queue that received a
 * message: in sequence, completed or replied. Stopped and failed leads may
 * or may not have been messaged first, so they are not counted as messaged.
 * Reply rate is replied / messaged.
 */
export type CampaignFunnel = {
  total: number;
  queued: number;
  inSequence: number;
  completed: number;
  replied: number;
  stopped: number;
  failed: number;
  messaged: number;
  messagesSent: number;
  replyRate: number | null;
  /** 0-1 share of leads that have left the queue; null with no leads. */
  progress: number | null;
};

export function campaignFunnel(s: WhatsappCampaignStats): CampaignFunnel {
  const messaged = s.in_sequence + s.completed + s.replied;
  return {
    total: s.total,
    queued: s.queued,
    inSequence: s.in_sequence,
    completed: s.completed,
    replied: s.replied,
    stopped: s.stopped,
    failed: s.failed,
    messaged,
    messagesSent: s.messagesSent,
    replyRate: messaged > 0 ? s.replied / messaged : null,
    progress: s.total > 0 ? Math.min((s.total - s.queued) / s.total, 1) : null,
  };
}

export type LaunchBlocker = "noSender" | "noLeads" | "noFirstMessage";

/** Why a campaign cannot launch yet, or null. Mirrors the API's own checks; the screens turn the code into text. */
export function launchBlocker(input: { connectedSenders: number; leads: number; firstMessage: string | undefined }): LaunchBlocker | null {
  if (input.connectedSenders === 0) return "noSender";
  if (input.leads === 0) return "noLeads";
  if (!input.firstMessage?.trim()) return "noFirstMessage";
  return null;
}
