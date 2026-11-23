import type { Messages } from "@/i18n/catalog";
import type { SearchQueryStatus } from "@/lib/linkedin/schema";

// Status of a search query, shared by the search batch list and detail screens.
export type BadgeColor = "gray" | "blue" | "orange" | "red" | "green" | "yellow" | "purple" | "sky" | "pink" | "teal";

export type StatusLabelKey = keyof Messages["linkedinSearch"]["status"];

// Enum values stay stable; the label comes from a typed key (Record keeps it exhaustive).
export const STATUS_META: Record<SearchQueryStatus, { labelKey: StatusLabelKey; color: BadgeColor }> = {
  QUEUED: { labelKey: "queued", color: "gray" },
  RUNNING: { labelKey: "running", color: "blue" },
  PAUSED_LIMIT: { labelKey: "pausedQuota", color: "orange" },
  COMPLETED: { labelKey: "completed", color: "green" },
  FAILED: { labelKey: "failed", color: "red" },
  CANCELLED: { labelKey: "cancelled", color: "gray" },
};
