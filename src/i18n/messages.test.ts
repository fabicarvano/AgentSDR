import { describe, expect, test } from "bun:test";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { DEFAULT_LOCALE, LOCALES, isLocale, matchLocale, type Locale } from "./config";
import en from "../../messages/en.json";
import ptBR from "../../messages/pt-BR.json";

/**
 * English is the source of truth (src/i18n/global.d.ts types every key from
 * it). These tests hold each other language to the same keys and the same
 * placeholders, so a translation can never ship half-done or lose a {name}.
 */
const CATALOGS: Record<Locale, unknown> = { en, "pt-BR": ptBR };

/** { a: { b: "x" } } → { "a.b": "x" } */
function flatten(node: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else if (value && typeof value === "object") flatten(value, path, out);
    else throw new Error(`messages: ${path} must be a string or an object`);
  }
  return out;
}

/** Every argument and rich-text tag a message uses, branches of select/plural included. */
function placeholders(message: string): string[] {
  const found = new Set<string>();
  const walk = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      switch (element.type) {
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          found.add(`arg:${element.value}`);
          break;
        case TYPE.select:
        case TYPE.plural:
          found.add(`arg:${element.value}`);
          for (const option of Object.values(element.options)) walk(option.value);
          break;
        case TYPE.tag:
          found.add(`tag:${element.value}`);
          walk(element.children);
          break;
      }
    }
  };
  walk(parse(message));
  return [...found].sort();
}

const source = flatten(en);

describe("message catalogs", () => {
  test("every supported locale has a catalog", () => {
    expect(Object.keys(CATALOGS).sort()).toEqual([...LOCALES].sort());
  });

  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const catalog = flatten(CATALOGS[locale]);

    describe(locale, () => {
      test("has exactly the keys English has", () => {
        const missing = Object.keys(source).filter((key) => !(key in catalog));
        const extra = Object.keys(catalog).filter((key) => !(key in source));
        expect({ missing, extra }).toEqual({ missing: [], extra: [] });
      });

      test("keeps every placeholder and tag of the English message", () => {
        const mismatched = Object.keys(source)
          .filter((key) => key in catalog)
          .filter((key) => placeholders(source[key]).join() !== placeholders(catalog[key]).join())
          .map((key) => `${key}: en uses [${placeholders(source[key])}], ${locale} uses [${placeholders(catalog[key])}]`);
        expect(mismatched).toEqual([]);
      });

      test("has no empty messages", () => {
        expect(Object.keys(catalog).filter((key) => catalog[key].trim() === "")).toEqual([]);
      });
    });
  }

  test("every English message is valid ICU", () => {
    for (const message of Object.values(source)) expect(() => parse(message)).not.toThrow();
  });
});

describe("matchLocale", () => {
  test("maps every Portuguese variant to pt-BR", () => {
    expect(matchLocale("pt-BR,pt;q=0.9,en;q=0.8")).toBe("pt-BR");
    expect(matchLocale("pt-PT")).toBe("pt-BR");
    expect(matchLocale("pt")).toBe("pt-BR");
  });

  test("maps English variants to en", () => {
    expect(matchLocale("en-GB,en;q=0.9")).toBe("en");
  });

  test("follows quality values, then header order", () => {
    expect(matchLocale("en;q=0.5,pt-BR;q=0.9")).toBe("pt-BR");
    expect(matchLocale("en,pt-BR")).toBe("en");
  });

  test("skips unsupported languages and refused ones", () => {
    expect(matchLocale("fr,de;q=0.8,pt;q=0.1")).toBe("pt-BR");
    expect(matchLocale("pt;q=0,en;q=0.1")).toBe("en");
    expect(matchLocale("fr-FR,de")).toBeNull();
  });

  test("is null without a header", () => {
    expect(matchLocale(null)).toBeNull();
    expect(matchLocale(undefined)).toBeNull();
    expect(matchLocale("")).toBeNull();
  });
});

describe("isLocale", () => {
  test("accepts exactly the supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("pt-BR")).toBe(true);
    expect(isLocale("pt-br")).toBe(false);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
