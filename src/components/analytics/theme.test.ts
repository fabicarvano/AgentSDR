import { describe, expect, test } from "bun:test";
import { formatChange, formatCompact, formatDay, formatDayLong, formatDuration, formatMinutes, formatNumber, formatPercent } from "./theme";

/**
 * The formatters take the interface language as a trailing argument. English
 * (the default) must read exactly as it did before they were localised, and
 * pt-BR must use its own separators, month names and units.
 */
describe("English (the default)", () => {
  test("formatCompact stays whole under 10,000 and compacts from there", () => {
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(1284)).toBe("1,284");
    expect(formatCompact(9999.4)).toBe("9,999");
    expect(formatCompact(12_900)).toBe("12.9K");
    expect(formatCompact(10_000)).toBe("10K");
    expect(formatCompact(1_200_000)).toBe("1.2M");
    expect(formatCompact(null)).toBe("—");
    expect(formatCompact(Number.NaN)).toBe("—");
  });

  test("formatPercent keeps one decimal under 10% and drops a trailing .0", () => {
    expect(formatPercent(0.18)).toBe("18%");
    expect(formatPercent(0.046)).toBe("4.6%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.4, 1)).toBe("40%");
    expect(formatPercent(0.637, 1)).toBe("63.7%");
    expect(formatPercent(0.8, 0)).toBe("80%");
    expect(formatPercent(null)).toBe("—");
  });

  test("formatChange is signed", () => {
    expect(formatChange(0.12)).toBe("+12%");
    expect(formatChange(-0.08)).toBe("−8%");
    expect(formatChange(0.054)).toBe("+5.4%");
  });

  test("formatDuration and formatMinutes use the narrow unit style", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(3 * 60_000)).toBe("3m");
    expect(formatDuration((3 * 60 + 12) * 60_000)).toBe("3h 12m");
    expect(formatDuration(3 * 3_600_000)).toBe("3h");
    expect(formatDuration((2 * 24 + 4) * 3_600_000)).toBe("2d 4h");
    expect(formatDuration(null)).toBe("—");
    expect(formatMinutes(192)).toBe("3h 12m");
    expect(formatMinutes(null)).toBe("—");
  });

  test("dates read day first", () => {
    expect(formatDay("2026-09-01")).toBe("1 Sep");
    expect(formatDayLong("2026-09-01")).toBe("1 Sep 2026");
  });

  test("a date that is not a date is returned as it came", () => {
    expect(formatDay("not-a-date")).toBe("not-a-date");
  });
});

/** CLDR separates a number from its unit with a no-break space (sometimes a narrow one); compare with a plain space. */
const plain = (text: string) => text.replace(/\s/g, " ");

describe("pt-BR", () => {
  test("numbers use the comma and the dot", () => {
    expect(formatNumber(1284, "pt-BR")).toBe("1.284");
    expect(formatCompact(1284, "pt-BR")).toBe("1.284");
    expect(formatPercent(0.046, undefined, "pt-BR")).toBe("4,6%");
    expect(formatPercent(0.18, undefined, "pt-BR")).toBe("18%");
  });

  test("compact numbers spell out thousands and millions", () => {
    expect(plain(formatCompact(12_900, "pt-BR"))).toBe("12,9 mil");
    expect(plain(formatCompact(1_200_000, "pt-BR"))).toBe("1,2 mi");
  });

  test("durations keep a space before the unit", () => {
    expect(plain(formatDuration(45_000, "pt-BR"))).toBe("45 s");
    expect(plain(formatDuration((3 * 60 + 12) * 60_000, "pt-BR"))).toBe("3 h 12 min");
  });

  test("dates are day first with a short lower-case month and no \"de\" or dot", () => {
    expect(formatDay("2026-09-01", "pt-BR")).toBe("1 set");
    expect(formatDay("2026-11-14", "pt-BR")).toBe("14 nov");
    expect(formatDayLong("2026-11-14", "pt-BR")).toBe("14 nov 2026");
  });
});
