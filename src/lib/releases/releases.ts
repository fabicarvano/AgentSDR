import releasesJson from "../../../content/releases.json";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import type { LocalizedRelease, ReleaseNote } from "./types";

/**
 * The release notes, newest first. Imported (not read with fs) so the
 * standalone build bundles them. The shape is checked by releases.test.ts.
 */
export const RELEASES = releasesJson as ReleaseNote[];

/** The release the pop-up announces: the newest entry (not package.json). Null if the file is empty. */
export function getCurrentRelease(releases: readonly ReleaseNote[] = RELEASES): ReleaseNote | null {
  return releases[0] ?? null;
}

/** True when the person has not dismissed this exact version yet (null = never dismissed anything). */
export function shouldShowRelease(currentVersion: string, dismissedVersion: string | null): boolean {
  return currentVersion !== dismissedVersion;
}

/** The note in one language; anything but a supported locale falls back to English. */
export function localizeRelease(release: ReleaseNote, locale: string): LocalizedRelease {
  const lang: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return {
    version: release.version,
    date: release.date,
    title: release.title[lang],
    items: release.items.map((item) => ({ type: item.type, text: item.text[lang] })),
  };
}
