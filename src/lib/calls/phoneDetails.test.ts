import { describe, expect, test } from "bun:test";
import { parsePhoneDetails } from "./phoneDetails";

describe("parsePhoneDetails", () => {
  test("a Brazilian mobile is valid and mobile", () => {
    expect(parsePhoneDetails("(21) 98654-5481", "BR")).toEqual({ e164: "+5521986545481", isMobile: true });
  });

  test("a Brazilian landline is valid and not mobile", () => {
    expect(parsePhoneDetails("(21) 3333-4444", "BR")).toEqual({ e164: "+552133334444", isMobile: false });
  });

  test("a number the country does not assign is not valid", () => {
    expect(parsePhoneDetails("(21) 1111-1111", "BR")).toBeNull();
  });

  test("a number with its country code needs no default country", () => {
    expect(parsePhoneDetails("+55 21 98654-5481", undefined)?.e164).toBe("+5521986545481");
  });

  test("without + and without a country the number is not guessed", () => {
    expect(parsePhoneDetails("(21) 98654-5481", undefined)).toBeNull();
    expect(parsePhoneDetails("(21) 98654-5481", "")).toBeNull();
  });

  test("empty and text inputs are not numbers", () => {
    expect(parsePhoneDetails("", "BR")).toBeNull();
    expect(parsePhoneDetails("   ", "BR")).toBeNull();
    expect(parsePhoneDetails("call me", "BR")).toBeNull();
  });

  test("US numbers share fixed and mobile ranges, so they count as mobile", () => {
    expect(parsePhoneDetails("(415) 555-2671", "US")?.isMobile).toBe(true);
  });
});
