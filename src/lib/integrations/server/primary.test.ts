import { describe, expect, test } from "bun:test";

import { toPrimaryText, toPrimaryOutputs } from "./helpers";
import { APOLLO_PRIMARY_KEYS, SNOV_PRIMARY_KEYS, cellValueForOutput } from "./primaryKeys";

describe("toPrimaryText", () => {
  test("returns null for empty values", () => {
    expect(toPrimaryText(null)).toBeNull();
    expect(toPrimaryText(undefined)).toBeNull();
    expect(toPrimaryText("   ")).toBeNull();
    expect(toPrimaryText([])).toBeNull();
    expect(toPrimaryText({})).toBeNull();
  });

  test("keeps scalars as text", () => {
    expect(toPrimaryText("Engineer")).toBe("Engineer");
    expect(toPrimaryText(42)).toBe("42");
    expect(toPrimaryText(true)).toBe("true");
  });

  test("joins a list of scalars", () => {
    expect(toPrimaryText(["react", " node ", "", "sql"])).toBe("react; node; sql");
  });

  test("takes the primary key of the first item of a list of objects", () => {
    const jobs = [{ companyName: "Acme", position: "CTO" }, { companyName: "Beta", position: "CEO" }];
    expect(toPrimaryText(jobs, ["position"])).toBe("CTO");
  });

  test("skips items that lack the primary key", () => {
    const jobs = [{ companyName: "Acme" }, { position: "Head of Sales" }];
    expect(toPrimaryText(jobs, ["position"])).toBe("Head of Sales");
  });

  test("uses the first key that has a value", () => {
    expect(toPrimaryText({ title: "", position: "Analyst" }, ["title", "position"])).toBe("Analyst");
  });

  test("falls back to common keys when none are given", () => {
    expect(toPrimaryText({ id: "1", name: "Ada" })).toBe("Ada");
    expect(toPrimaryText([{ email: "ada@example.com" }])).toBe("ada@example.com");
  });

  test("never returns JSON for unknown shapes", () => {
    expect(toPrimaryText({ nested: { a: 1 } })).toBeNull();
    expect(toPrimaryText([{ nested: [1, 2] }], ["position"])).toBeNull();
    expect(toPrimaryText([[1, 2], [3]])).toBeNull();
  });

  test("ignores object values for the primary key", () => {
    expect(toPrimaryText({ position: { en: "CTO" } }, ["position"])).toBeNull();
  });
});

describe("toPrimaryOutputs", () => {
  test("replaces only the listed outputs and keeps the rest", () => {
    const logical = {
      companyName: "Acme",
      currentJobs: [{ position: "CTO" }],
      social: [{ link: "https://linkedin.com/in/ada", type: "linkedin" }],
    };
    const result = toPrimaryOutputs(logical, { currentJobs: ["position"], social: ["link"] });
    expect(result).toEqual({
      companyName: "Acme",
      currentJobs: "CTO",
      social: "https://linkedin.com/in/ada",
    });
  });

  test("does not touch the original object", () => {
    const logical = { currentJobs: [{ position: "CTO" }] };
    toPrimaryOutputs(logical, { currentJobs: ["position"] });
    expect(Array.isArray(logical.currentJobs)).toBe(true);
  });

  test("sets null when the list has no usable value", () => {
    expect(toPrimaryOutputs({ currentJobs: [] }, { currentJobs: ["position"] })).toEqual({ currentJobs: null });
  });
});

describe("cellValueForOutput (adding an output to an existing enrichment)", () => {
  const jobs = [{ companyName: "Acme", position: "CTO" }, { position: "CEO" }];

  test("gives a text column the primary value, not the list", () => {
    expect(cellValueForOutput("snov", "currentJobs", "text", jobs)).toBe("CTO");
    expect(cellValueForOutput("snov", "social", "text", [{ link: "https://x.test/in/ada", type: "linkedin" }])).toBe("https://x.test/in/ada");
    expect(cellValueForOutput("apollo", "people", "text", [{ first_name: "Ada" }])).toBe("Ada");
  });

  test("keeps the object in a json column", () => {
    expect(cellValueForOutput("snov", "currentJobs", "json", jobs)).toBe(jobs);
  });

  test("leaves scalars alone", () => {
    expect(cellValueForOutput("snov", "industry", "text", "Software")).toBe("Software");
    expect(cellValueForOutput("snov", "founded", "number", 1999)).toBe(1999);
  });

  test("falls back to common keys for an integration it does not know", () => {
    expect(cellValueForOutput("hunter", "emails", "text", [{ email: "a@example.com" }])).toBe("a@example.com");
  });
});

describe("primary keys of structured outputs", () => {
  test("a list of skills or domains as objects still gives text", () => {
    expect(toPrimaryText([{ name: "React" }, { name: "SQL" }], SNOV_PRIMARY_KEYS.skills)).toBe("React");
    expect(toPrimaryText([{ domain: "acme.com" }], SNOV_PRIMARY_KEYS.relatedDomains)).toBe("acme.com");
  });

  test("an Apollo person without a full name still gives text", () => {
    expect(toPrimaryText([{ first_name: "Ada", last_name_obfuscated: "Lo***" }], APOLLO_PRIMARY_KEYS.people)).toBe("Ada");
  });
});
