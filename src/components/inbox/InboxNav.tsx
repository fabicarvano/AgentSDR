"use client";

import { useFormatter, useTranslations } from "next-intl";
import { TriageTabs, type TriageTab } from "./shell/InboxShell";
import { INBOX_SECTIONS, SECTION_COUNT_HINT_KEY, type InboxSectionKey } from "./inboxSections";

type Counts = Partial<Record<InboxSectionKey, number>>;

/** The folders that decide what to work on next; the rest sit under "More". */
const PRIMARY: InboxSectionKey[] = ["inbox", "replied", "pendingApproval"];

/** Shorter names for the tab bar, where space is tight. */
const TAB_SHORT: Partial<Record<InboxSectionKey, "replied" | "pendingApproval">> = {
  replied: "replied",
  pendingApproval: "pendingApproval",
};

const TAB_TITLED: InboxSectionKey[] = ["inbox", "replied", "pendingApproval", "outOfOffice", "important", "scheduled"];

/**
 * Master Inbox folders as the list's tab bar: Inbox, Replies and To approve
 * up front, Important, Out of office, Sent and Scheduled under "More". Counts
 * are what `/api/outreach/inbox/counts` reports (unread, starred, queued).
 */
export default function InboxFolderTabs({
  active,
  onSelect,
  counts,
}: {
  active: InboxSectionKey;
  onSelect: (key: InboxSectionKey) => void;
  counts: Counts;
}) {
  const t = useTranslations("inboxMain.nav");
  const tSections = useTranslations("inboxMain.sections");
  const format = useFormatter();

  function toTab(key: InboxSectionKey): TriageTab {
    const section = INBOX_SECTIONS.find((s) => s.key === key)!;
    const count = counts[key];
    const hintKey = key in SECTION_COUNT_HINT_KEY ? SECTION_COUNT_HINT_KEY[key as keyof typeof SECTION_COUNT_HINT_KEY] : undefined;
    const shortKey = TAB_SHORT[key];
    return {
      key,
      label: shortKey ? t(`tabShort.${shortKey}`) : tSections(section.labelKey),
      count: count ?? null,
      countTitle: count !== undefined ? (hintKey ? t(hintKey, { count }) : format.number(count)) : undefined,
      title: TAB_TITLED.includes(key) ? t(`tabTitle.${key as "inbox" | "replied" | "pendingApproval" | "outOfOffice" | "important" | "scheduled"}`) : undefined,
    };
  }

  const more = INBOX_SECTIONS.map((s) => s.key).filter((key) => !PRIMARY.includes(key));
  return (
    <TriageTabs
      label={t("folders")}
      tabs={PRIMARY.map((key) => toTab(key))}
      more={more.map((key) => toTab(key))}
      value={active}
      onChange={(key) => onSelect(key as InboxSectionKey)}
    />
  );
}
