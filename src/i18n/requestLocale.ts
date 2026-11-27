import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, matchLocale, type Locale } from "./config";

/** One cookie's value out of a raw Cookie header, or null. */
function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/**
 * The interface language of whoever made a request, for code that holds a plain
 * `Request` instead of running inside next/headers (Better Auth's email hooks).
 * Same order as the request config in ./request.ts: the NEXT_LOCALE cookie, then
 * Accept-Language, then English. No request at all (a server-side `auth.api.*`
 * call) is English too.
 */
export function localeFromRequest(request?: Request | null): Locale {
  if (!request) return DEFAULT_LOCALE;
  const fromCookie = cookieValue(request.headers.get("cookie"), LOCALE_COOKIE);
  if (isLocale(fromCookie)) return fromCookie;
  return matchLocale(request.headers.get("accept-language")) ?? DEFAULT_LOCALE;
}
