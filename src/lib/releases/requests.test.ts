import { describe, expect, test } from "bun:test";
import { parseDismissBody } from "./requests";

describe("parseDismissBody", () => {
  test("accepts a version string", () => {
    expect(parseDismissBody({ version: "0.5.1" })).toEqual({ ok: true, version: "0.5.1" });
  });
  test("accepts exactly 64 characters", () => {
    expect(parseDismissBody({ version: "1".repeat(64) }).ok).toBe(true);
  });
  test("rejects a body that is not an object", () => {
    for (const raw of [null, undefined, "0.5.1", 5, true, ["0.5.1"]]) expect(parseDismissBody(raw)).toEqual({ ok: false });
  });
  test("rejects a missing or non-string version", () => {
    expect(parseDismissBody({})).toEqual({ ok: false });
    expect(parseDismissBody({ version: 5 })).toEqual({ ok: false });
    expect(parseDismissBody({ version: null })).toEqual({ ok: false });
  });
  test("rejects an empty or too long version", () => {
    expect(parseDismissBody({ version: "" })).toEqual({ ok: false });
    expect(parseDismissBody({ version: "1".repeat(65) })).toEqual({ ok: false });
  });
});
