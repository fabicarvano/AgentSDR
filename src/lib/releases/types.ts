import type { Locale } from "@/i18n/config";

export const RELEASE_ITEM_TYPES = ["new", "improvement", "fix"] as const;
export type ReleaseItemType = (typeof RELEASE_ITEM_TYPES)[number];

export type LocalizedText = Record<Locale, string>;

/** One entry of content/releases.json. */
export type ReleaseNote = {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  /** Marks sample content: it is exempt from the "pt-BR differs from en" test and must be replaced before releasing. Never sent to the client. */
  placeholder?: boolean;
  title: LocalizedText;
  items: { type: ReleaseItemType; text: LocalizedText }[];
};

/** A release note already in one language: what GET /api/releases/current returns (plus `dismissed`). */
export type LocalizedRelease = {
  version: string;
  date: string;
  title: string;
  items: { type: ReleaseItemType; text: string }[];
};
