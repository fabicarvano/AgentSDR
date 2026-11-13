import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DOMAINS } from "./catalog";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, matchLocale, type Locale } from "./config";

/** Cookie first (an explicit choice), then the browser's language, then English. */
async function resolveLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return matchLocale((await headers()).get("accept-language")) ?? DEFAULT_LOCALE;
}

/** messages/<locale>/<domain>.json for every domain, merged: each file owns its own top-level namespaces. */
async function loadMessages(locale: Locale) {
  const parts = await Promise.all(DOMAINS.map(async (domain) => (await import(`../../messages/${locale}/${domain}.json`)).default));
  return Object.assign({}, ...parts);
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale, messages: await loadMessages(locale) };
});
