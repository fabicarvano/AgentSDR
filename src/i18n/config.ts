/**
 * Interface languages. Client-safe: no server imports, so components, the
 * request config and tests can all read it.
 *
 * There is no `/pt-BR/...` URL prefix on purpose. The app has hundreds of
 * routes and public webhook/API paths that must not move, so the language is
 * a per-browser choice (cookie), like the colour theme: the cookie wins, then
 * the browser's Accept-Language, then English.
 */
export const LOCALES = ["en", "pt-BR"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** next-intl's own default cookie name, so its docs and tooling keep working. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Each language in its own language: a visitor must be able to find theirs. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  "pt-BR": "Português (Brasil)",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * The best supported language for an Accept-Language header, or null.
 * "pt", "pt-PT" and "pt-br" all land on pt-BR (the only Portuguese we ship);
 * "en-GB" lands on en. Quality values order the list; ties keep header order.
 */
export function matchLocale(acceptLanguage: string | null | undefined): Locale | null {
  if (!acceptLanguage) return null;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((entry) => entry.tag && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);

  for (const { tag } of ranked) {
    const language = tag.split("-")[0];
    if (language === "pt") return "pt-BR";
    if (language === "en") return "en";
  }
  return null;
}
