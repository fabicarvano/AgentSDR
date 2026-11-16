import type { Messages } from "@/i18n/catalog";

export type InboxSectionKey = "inbox" | "sent" | "replied" | "scheduled" | "important" | "outOfOffice" | "pendingApproval";

/** Key into `inboxMain.sections`; render with `useTranslations("inboxMain.sections")` and `t(section.labelKey)`. */
export type InboxSectionLabelKey = keyof Messages["inboxMain"]["sections"];

// Compile-time exhaustiveness: a folder added to InboxSectionKey without a label fails tsc here.
const _sectionsCovered: Exclude<InboxSectionKey, InboxSectionLabelKey> extends never ? true : false = true;
void _sectionsCovered;

export const INBOX_SECTIONS: { key: InboxSectionKey; label: string; labelKey: InboxSectionLabelKey; parent?: InboxSectionKey }[] = [
  // `label` is the English name, kept for importers that have not moved to `labelKey` yet.
  { key: "inbox", label: "Inbox", labelKey: "inbox" },
  { key: "replied", label: "Replied", labelKey: "replied", parent: "inbox" },
  { key: "outOfOffice", label: "Out of office", labelKey: "outOfOffice", parent: "inbox" },
  { key: "pendingApproval", label: "Pending approval", labelKey: "pendingApproval" },
  { key: "sent", label: "Sent", labelKey: "sent" },
  { key: "important", label: "Important", labelKey: "important" },
  { key: "scheduled", label: "Scheduled", labelKey: "scheduled" },
];

/** What each folder's count means, for its tooltip. `/api/outreach/inbox/counts` only reports these three. */
export const SECTION_COUNT_HINT: Partial<Record<InboxSectionKey, string>> = {
  inbox: "unread",
  important: "starred",
  scheduled: "waiting to send",
};

/** The same hints as keys of `inboxMain.nav` (full messages taking `{count}`). */
export const SECTION_COUNT_HINT_KEY = {
  inbox: "countUnread",
  important: "countStarred",
  scheduled: "countQueued",
} as const satisfies Partial<Record<InboxSectionKey, keyof Messages["inboxMain"]["nav"]>>;
