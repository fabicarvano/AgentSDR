import { describe, expect, test } from "bun:test";
import { localeFromRequest } from "./requestLocale";

function request(headers: Record<string, string>) {
  return new Request("https://app.example/api/auth/sign-up/email", { method: "POST", headers });
}

describe("localeFromRequest", () => {
  test("the NEXT_LOCALE cookie wins over Accept-Language", () => {
    expect(localeFromRequest(request({ cookie: "theme=dark; NEXT_LOCALE=pt-BR; other=1", "accept-language": "en-US,en;q=0.9" }))).toBe("pt-BR");
    expect(localeFromRequest(request({ cookie: "NEXT_LOCALE=en", "accept-language": "pt-BR" }))).toBe("en");
  });

  test("an unsupported cookie value falls through to Accept-Language", () => {
    expect(localeFromRequest(request({ cookie: "NEXT_LOCALE=fr", "accept-language": "pt-PT,pt;q=0.9" }))).toBe("pt-BR");
    expect(localeFromRequest(request({ cookie: "NEXT_LOCALE=%E0%A4%A", "accept-language": "pt" }))).toBe("pt-BR");
  });

  test("a cookie whose name only ends in NEXT_LOCALE is not it", () => {
    expect(localeFromRequest(request({ cookie: "X_NEXT_LOCALE=pt-BR" }))).toBe("en");
  });

  test("without a cookie, Accept-Language decides", () => {
    expect(localeFromRequest(request({ "accept-language": "pt-BR,pt;q=0.9,en;q=0.8" }))).toBe("pt-BR");
    expect(localeFromRequest(request({ "accept-language": "en-GB,en;q=0.9" }))).toBe("en");
  });

  test("falls back to English: no supported language, no headers, no request", () => {
    expect(localeFromRequest(request({ "accept-language": "fr-FR,de" }))).toBe("en");
    expect(localeFromRequest(request({}))).toBe("en");
    expect(localeFromRequest(undefined)).toBe("en");
    expect(localeFromRequest(null)).toBe("en");
  });
});
