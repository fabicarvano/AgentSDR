import { describe, expect, test } from "bun:test";
import { getCurrentRelease, localizeRelease, RELEASES, shouldShowRelease } from "./releases";
import { RELEASE_ITEM_TYPES } from "./types";

describe("shouldShowRelease", () => {
  test("shows when nothing was ever dismissed", () => {
    expect(shouldShowRelease("0.5.1", null)).toBe(true);
  });
  test("shows again for a new version after dismissing the previous one", () => {
    expect(shouldShowRelease("0.5.2", "0.5.1")).toBe(true);
  });
  test("hides when the same version was dismissed", () => {
    expect(shouldShowRelease("0.5.1", "0.5.1")).toBe(false);
  });
});

describe("localizeRelease", () => {
  const release = RELEASES[0];
  test("picks the requested language", () => {
    expect(localizeRelease(release, "pt-BR").title).toBe(release.title["pt-BR"]);
    expect(localizeRelease(release, "en").items[0].text).toBe(release.items[0].text.en);
  });
  test("falls back to English", () => {
    expect(localizeRelease(release, "fr").title).toBe(release.title.en);
  });
});

describe("content/releases.json", () => {
  const SEMVER = /^\d+\.\d+\.\d+$/;

  test("has releases, and the current one is the first", () => {
    expect(RELEASES.length).toBeGreaterThan(0);
    expect(getCurrentRelease()?.version).toBe(RELEASES[0].version);
  });

  test("versions are unique semver", () => {
    const versions = RELEASES.map((r) => r.version);
    for (const v of versions) expect(v).toMatch(SEMVER);
    expect(new Set(versions).size).toBe(versions.length);
  });

  test("dates are valid YYYY-MM-DD, newest first", () => {
    for (const r of RELEASES) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${r.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(r.date);
    }
    const dates = RELEASES.map((r) => r.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test("every text exists in en and pt-BR, and pt-BR differs from en", () => {
    for (const r of RELEASES) {
      const texts = [r.title, ...r.items.map((i) => i.text)];
      for (const t of texts) {
        expect(t.en.trim()).not.toBe("");
        expect(t["pt-BR"].trim()).not.toBe("");
        // Only entries marked placeholder may skip the translation check; real notes must really be translated.
        if (!r.placeholder) expect(t["pt-BR"]).not.toBe(t.en);
      }
    }
  });

  test("items have a valid type and each release has at least one", () => {
    for (const r of RELEASES) {
      expect(r.items.length).toBeGreaterThan(0);
      for (const item of r.items) expect(RELEASE_ITEM_TYPES).toContain(item.type);
    }
  });
});
