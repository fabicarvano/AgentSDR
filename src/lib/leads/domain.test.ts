import { describe, expect, test } from "bun:test";
import { normalizeDomainForTargeting } from "./domain";
import { normalizeDomainForTargeting as viaLegacyPath } from "@/lib/qualification/domain";

// Values were produced by the original implementation before it moved.
const CASES: Array<[string, string]> = [
  ["https://www.Acme.com/path?x=1#h", "acme.com"],
  ["HTTP://Shop.Acme.com:8080/", "shop.acme.com"],
  ["//www.acme.com", "acme.com"],
  ["  acme.com.  ", "acme.com"],
  ["acme.com/a/b", "acme.com"],
  ["www.acme.com?utm=1", "acme.com"],
  ["acme.com#top", "acme.com"],
  ["", ""],
  ["   ", ""],
  ["sub.www.acme.co.uk", "sub.www.acme.co.uk"],
  ["jane@acme.com", "jane@acme.com"],
];

describe("normalizeDomainForTargeting", () => {
  test.each(CASES)("%p -> %p", (input, expected) => {
    expect(normalizeDomainForTargeting(input)).toBe(expected);
  });
  test("the legacy import path returns the same function", () => {
    expect(viaLegacyPath).toBe(normalizeDomainForTargeting);
  });
});
