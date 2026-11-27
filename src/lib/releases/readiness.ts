import type { ReleaseNote } from "./types";

type TopEntry = Pick<ReleaseNote, "version" | "placeholder">;

/** Compares two plain `X.Y.Z` versions (no pre-release suffix; releases.test.ts allows no other form): negative when `a` is older, positive when newer, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * What is wrong with the first entry of content/releases.json, as messages for
 * a maintainer (empty when nothing is).
 *
 * - `development` (every commit): the entry is either the open one for the next
 *   version (`placeholder: true`, newer than package.json) or the notes of the
 *   version in package.json.
 * - `release` (a version tag): only the second is accepted, so an open entry or
 *   notes for another version can never be published.
 */
export function releaseNotesProblems(
  top: TopEntry | null,
  packageVersion: string,
  mode: "development" | "release",
): string[] {
  if (!top) return ["content/releases.json has no entry."];
  if (top.placeholder) {
    if (mode === "release") {
      return [
        `The first entry of content/releases.json (${top.version}) is still marked "placeholder": true. Review its notes and remove the mark before releasing.`,
      ];
    }
    if (compareVersions(top.version, packageVersion) <= 0) {
      return [
        `The open entry of content/releases.json is ${top.version}, but package.json is already ${packageVersion}. An open entry must be for a later version.`,
      ];
    }
    return [];
  }
  if (top.version !== packageVersion) {
    return [
      `The first entry of content/releases.json is ${top.version}, but package.json is ${packageVersion}. They must match; an entry for a later version must be marked "placeholder": true until it is released.`,
    ];
  }
  return [];
}
