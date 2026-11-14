import { useLocale, useTranslations } from "next-intl";
import type { AnalyticsRange } from "@/lib/analytics/contract";
import { formatChange, formatCompact, formatDay, formatDayLong, formatDuration, formatMinutes, formatNumber, formatPercent } from "./theme";

/**
 * The theme's number and date formatters, bound to the interface language.
 * Components read `const fmt = useAnalyticsFormat()` and call `fmt.compact(n)`,
 * `fmt.percent(rate)`, `fmt.day("2026-09-01")` and so on, so no chart or tile
 * has to thread the language through by hand.
 *
 * Only next-intl hooks are used (no state, no effects), so it also works in a
 * component that renders on the server.
 */
export function useAnalyticsFormat() {
  const locale = useLocale();
  const t = useTranslations("analytics.format");
  return {
    locale,
    number: (value: number) => formatNumber(value, locale),
    compact: (value: number | null | undefined) => formatCompact(value, locale),
    percent: (value: number | null | undefined, digits?: number) => formatPercent(value, digits, locale),
    change: (value: number) => formatChange(value, locale),
    duration: (ms: number | null | undefined) => formatDuration(ms, locale),
    minutes: (value: number | null | undefined) => formatMinutes(value, locale),
    day: (date: string) => formatDay(date, locale),
    dayLong: (date: string) => formatDayLong(date, locale),
    /** A bucket's first day as an axis label ("1 Sep") or, with `long`, a tooltip/table label ("Week of 1 Sep"). */
    bucket: (date: string, bucket: AnalyticsRange["bucket"], long = false) => {
      if (bucket === "week") return long ? t("weekOf", { date: formatDay(date, locale) }) : formatDay(date, locale);
      return long ? formatDayLong(date, locale) : formatDay(date, locale);
    },
  };
}
