import { describe, expect, test } from "bun:test";
import { splitVerifyError } from "./verifyError";

describe("splitVerifyError", () => {
  test("takes a verification error out of `from`", () => {
    expect(splitVerifyError("/analytics?error=TOKEN_EXPIRED")).toEqual({ from: "/analytics", code: "TOKEN_EXPIRED" });
    expect(splitVerifyError("/crm?tab=actions&error=INVALID_TOKEN#top")).toEqual({ from: "/crm?tab=actions#top", code: "INVALID_TOKEN" });
  });

  test("leaves `from` alone when it carries no verification error", () => {
    expect(splitVerifyError("/analytics")).toEqual({ from: "/analytics", code: null });
    expect(splitVerifyError("/oauth/consent?error=access_denied")).toEqual({ from: "/oauth/consent?error=access_denied", code: null });
    expect(splitVerifyError(null)).toEqual({ from: null, code: null });
  });

  test("reads the page's own ?error= too, known codes only", () => {
    expect(splitVerifyError(null, "INVALID_USER")).toEqual({ from: null, code: "INVALID_USER" });
    expect(splitVerifyError("/analytics", "USER_NOT_FOUND")).toEqual({ from: "/analytics", code: "USER_NOT_FOUND" });
    expect(splitVerifyError(null, "<script>")).toEqual({ from: null, code: null });
  });

  test("never rewrites the path, so a same-site `from` cannot become another site's address", () => {
    expect(splitVerifyError("/.//evil.com?error=TOKEN_EXPIRED")).toEqual({ from: "/.//evil.com", code: "TOKEN_EXPIRED" });
    expect(splitVerifyError("/a/..//evil.com?error=INVALID_TOKEN")).toEqual({ from: "/a/..//evil.com", code: "INVALID_TOKEN" });
    expect(splitVerifyError("/.\\evil.com?error=TOKEN_EXPIRED").from).toBe("/.\\evil.com");
    for (const from of ["/.//evil.com?error=TOKEN_EXPIRED", "/a/..//evil.com?error=INVALID_TOKEN", "/%2e//evil.com?error=USER_NOT_FOUND"]) {
      const result = splitVerifyError(from).from;
      expect(result?.startsWith("//")).toBe(false);
      expect(result).toBe(from.slice(0, from.indexOf("?")));
    }
  });
});
