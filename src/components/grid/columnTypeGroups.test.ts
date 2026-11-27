import { describe, expect, test } from "bun:test";
import { COLUMN_TYPE_GROUPS, columnTypeMeta } from "./columnTypeGroups";

describe("Add column menu", () => {
  test("Functions is available", () => {
    expect(columnTypeMeta("functions").available).toBe(true);
  });

  test("Message, Waterfall and Merge stay disabled", () => {
    for (const type of ["message", "waterfall", "merge"] as const) {
      expect(columnTypeMeta(type).available).toBe(false);
    }
  });

  test("every entry has a label key and appears once", () => {
    const types = COLUMN_TYPE_GROUPS.flat().map((meta) => meta.type);
    expect(new Set(types).size).toBe(types.length);
    for (const meta of COLUMN_TYPE_GROUPS.flat()) expect(meta.labelKey).not.toBeNull();
  });
});
