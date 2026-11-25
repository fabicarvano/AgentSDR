import { describe, expect, test } from "bun:test";
import { validateInputValue } from "./catalog";

describe("validateInputValue textOrNumber", () => {
  test("accepts text and finite numbers", () => {
    expect(validateInputValue("textOrNumber", "(21) 98654-5481")).toBeNull();
    expect(validateInputValue("textOrNumber", 21986545481)).toBeNull();
  });

  test("refuses NaN, Infinity and other shapes", () => {
    expect(validateInputValue("textOrNumber", Number.NaN)).not.toBeNull();
    expect(validateInputValue("textOrNumber", Number.POSITIVE_INFINITY)).not.toBeNull();
    expect(validateInputValue("textOrNumber", { phone: "1" })).not.toBeNull();
    expect(validateInputValue("textOrNumber", true)).not.toBeNull();
  });
});
