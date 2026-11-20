import type { Messages } from "@/i18n/catalog";
import type { OutreachLeadStatus } from "@/lib/outreach/schema";

// Every status has a label key (the Record fails tsc when a status is added without one);
// a value the code does not know yet falls back to the raw status at render time.
export type StatusKey = keyof Messages["emailLeads"]["status"];
export const STATUS_KEY: Record<OutreachLeadStatus, StatusKey> = {
  pending: "pending",
  initial_sent: "initial_sent",
  in_follow_up: "in_follow_up",
  reply_processing: "reply_processing",
  sequence_completed: "sequence_completed",
  reply_received: "reply_received",
  bounced: "bounced",
  suppressed: "suppressed",
};
