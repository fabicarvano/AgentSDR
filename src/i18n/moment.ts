import moment from "moment";
import "moment/locale/pt-br";
import type { Locale } from "./config";

// Importing a moment locale file makes it moment's GLOBAL locale. A global is
// shared by every request the server is rendering, so switching it per request
// is a race, and it would flip every other moment() call in the app too. Put it
// back to English and choose the language per call instead (momentIn).
moment.locale("en");

const MOMENT_LOCALE: Record<Locale, string> = { en: "en", "pt-BR": "pt-br" };

/** `moment(input)` in the interface language, without touching moment's global locale. Get `locale` from useLocale() / getLocale(). */
export function momentIn(locale: Locale, input?: moment.MomentInput): moment.Moment {
  return moment(input).locale(MOMENT_LOCALE[locale]);
}
