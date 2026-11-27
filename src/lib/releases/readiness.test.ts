import { describe, expect, test } from "bun:test";
import { compareVersions, releaseNotesProblems } from "./readiness";

describe("compareVersions", () => {
  test("orders by number, not by text", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("0.5.1", "0.5.2")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });
});

describe("releaseNotesProblems", () => {
  test("a missing entry is a problem in both modes", () => {
    expect(releaseNotesProblems(null, "0.5.1", "development")).toHaveLength(1);
    expect(releaseNotesProblems(null, "0.5.1", "release")).toHaveLength(1);
  });

  test("notes for the package.json version pass in both modes", () => {
    const top = { version: "0.5.1" };
    expect(releaseNotesProblems(top, "0.5.1", "development")).toEqual([]);
    expect(releaseNotesProblems(top, "0.5.1", "release")).toEqual([]);
  });

  test("an open entry for the next version passes during development", () => {
    expect(releaseNotesProblems({ version: "0.5.2", placeholder: true }, "0.5.1", "development")).toEqual([]);
  });

  test("an open entry can never be released, even when the versions match", () => {
    const problems = releaseNotesProblems({ version: "0.5.2", placeholder: true }, "0.5.2", "release");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("placeholder");
  });

  test("an open entry must be newer than package.json", () => {
    expect(releaseNotesProblems({ version: "0.5.1", placeholder: true }, "0.5.1", "development")).toHaveLength(1);
    expect(releaseNotesProblems({ version: "0.5.0", placeholder: true }, "0.5.1", "development")).toHaveLength(1);
  });

  test("finished notes for another version fail in both modes", () => {
    expect(releaseNotesProblems({ version: "0.5.2" }, "0.5.1", "development")).toHaveLength(1);
    expect(releaseNotesProblems({ version: "0.5.0" }, "0.5.1", "release")).toHaveLength(1);
  });
});
