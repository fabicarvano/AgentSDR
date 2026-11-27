import type { Locale } from "@/i18n/config";

export const RELEASE_ITEM_TYPES = ["new", "improvement", "fix"] as const;
export type ReleaseItemType = (typeof RELEASE_ITEM_TYPES)[number];

export type LocalizedText = Record<Locale, string>;

/** One entry of content/releases.json. */
export type ReleaseNote = {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  /** Marks the open entry: the notes of the next version, which pull requests add to until it is released. The release removes the mark (src/lib/releases/readiness.ts refuses a version tag with it). Never sent to the client. */
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
