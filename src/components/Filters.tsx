"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef } from "react";
import Select from "./ui/Select";
import CategoryFilter from "./CategoryFilter";
import AppFilter from "./AppFilter";
import { useNavigation } from "./NavigationProvider";

// Country names come from Intl.DisplayNames in the interface language; only the flag lives here.
const COUNTRIES = [
  { value: "US", flag: "🇺🇸" },
  { value: "GB", flag: "🇬🇧" },
  { value: "CA", flag: "🇨🇦" },
  { value: "AU", flag: "🇦🇺" },
  { value: "IN", flag: "🇮🇳" },
  { value: "DE", flag: "🇩🇪" },
  { value: "FR", flag: "🇫🇷" },
  { value: "NL", flag: "🇳🇱" },
  { value: "BR", flag: "🇧🇷" },
  { value: "MX", flag: "🇲🇽" },
  { value: "SG", flag: "🇸🇬" },
  { value: "NZ", flag: "🇳🇿" },
  { value: "SE", flag: "🇸🇪" },
  { value: "NO", flag: "🇳🇴" },
  { value: "DK", flag: "🇩🇰" },
];

// Shopify, WooCommerce, ... are product names: they stay as they are. The empty value is "All Platforms".
const PLATFORM_VALUES = ["Shopify", "WooCommerce", "BigCommerce", "Magento", "Wix", "Squarespace"];

// The values go into the URL and the query; only the label is translated.
const SORT_VALUES = ["annualSales", "rank", "domain"] as const;

const DIR_VALUES = ["desc", "asc"] as const;

const PAGE_SIZES = [10, 20, 50];

// The dash between the Min and Max inputs: a symbol, not language.
const RANGE_DASH = "–";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-bold text-text-strong-950/70 uppercase tracking-widest">
      {children}
    </label>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {children}
    </div>
  );
}

export default function Filters() {
  const t = useTranslations("shared.filters");
  const locale = useLocale();
  const { navigate, isPending } = useNavigation();
  const searchParams = useSearchParams();
  const minRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);

  const get = (key: string, fallback = "") => searchParams.get(key) ?? fallback;

  const update = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(updates)) {
        if (val) params.set(key, val);
        else params.delete(key);
      }
      params.set("page", "1");
      navigate(`?${params.toString()}`);
    },
    [navigate, searchParams]
  );

  const countryOptions = useMemo(() => {
    const names = new Intl.DisplayNames(locale, { type: "region" });
    return COUNTRIES.map(({ value, flag }) => ({ value, label: `${flag} ${names.of(value) ?? value}` }));
  }, [locale]);
  const platformOptions = [
    { value: "", label: t("allPlatforms") },
    ...PLATFORM_VALUES.map((value) => ({ value, label: value })),
  ];
  const sortOptions = SORT_VALUES.map((value) => ({ value, label: t(`sortBy.${value}`) }));
  const dirOptions = DIR_VALUES.map((value) => ({ value, label: t(`direction.${value}`) }));
  const pageSizeOptions = PAGE_SIZES.map((n) => ({ value: String(n), label: t("rows", { count: n }) }));

  const handleTextInput = (key: string, ref: React.RefObject<HTMLInputElement | null>) =>
    (e: React.KeyboardEvent | React.FocusEvent) => {
      if ("key" in e && e.key !== "Enter") return;
      update({ [key]: ref.current?.value ?? "" });
    };

  return (
    <div className="flex flex-col gap-5 px-4 py-4">

      <Section>
        <Label>{t("country")}</Label>
        <Select
          value={get("countryCode", "US")}
          onChange={(v) => update({ countryCode: v })}
          options={countryOptions}
          variant="primary"
        />
      </Section>

      <div className="h-px bg-bg-weak-50" />

      <Section>
        <Label>{t("category")}</Label>
        <CategoryFilter
          countryCode={get("countryCode", "US")}
          c1={get("c1")}
          c2={get("c2")}
          c3={get("c3")}
          onChange={update}
        />
      </Section>

      <div className="h-px bg-bg-weak-50" />

      <Section>
        <Label>{t("app")}</Label>
        <AppFilter
          value={get("app")}
          onChange={(v) => update({ app: v })}
        />
      </Section>

      <div className="h-px bg-bg-weak-50" />

      <Section>
        <Label>{t("platform")}</Label>
        <Select
          value={get("platform")}
          onChange={(v) => update({ platform: v })}
          options={platformOptions}
        />
      </Section>

      <Section>
        <Label>{t("revenueRange")}</Label>
        <div className="flex items-center gap-1.5">
          <input
            ref={minRef}
            type="number"
            placeholder={t("min")}
            defaultValue={get("minRevenue")}
            // eslint-disable-next-line react-hooks/refs -- intentional: ref read/written during render to expose the latest value to event handlers
            onKeyDown={handleTextInput("minRevenue", minRef)}
            // eslint-disable-next-line react-hooks/refs -- intentional: ref read/written during render to expose the latest value to event handlers
            onBlur={handleTextInput("minRevenue", minRef)}
            className="w-full h-10 border border-stroke-soft-200 rounded-lg px-3 text-sm text-text-strong-950 placeholder-text-soft-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          <span className="text-text-strong-950/30 text-sm shrink-0">{RANGE_DASH}</span>
          <input
            ref={maxRef}
            type="number"
            placeholder={t("max")}
            defaultValue={get("maxRevenue")}
            // eslint-disable-next-line react-hooks/refs -- intentional: ref read/written during render to expose the latest value to event handlers
            onKeyDown={handleTextInput("maxRevenue", maxRef)}
            // eslint-disable-next-line react-hooks/refs -- intentional: ref read/written during render to expose the latest value to event handlers
            onBlur={handleTextInput("maxRevenue", maxRef)}
            className="w-full h-10 border border-stroke-soft-200 rounded-lg px-3 text-sm text-text-strong-950 placeholder-text-soft-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
        </div>
      </Section>

      <div className="h-px bg-bg-weak-50" />

      <Section>
        <Label>{t("sort")}</Label>
        <Select
          value={get("sortBy", "annualSales")}
          onChange={(v) => update({ sortBy: v })}
          options={sortOptions}
        />
        <Select
          value={get("sortDir", "desc")}
          onChange={(v) => update({ sortDir: v })}
          options={dirOptions}
        />
      </Section>

      <Section>
        <Label>{t("perPage")}</Label>
        <Select
          value={get("pageSize", "20")}
          onChange={(v) => update({ pageSize: v })}
          options={pageSizeOptions}
        />
      </Section>

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("?countryCode=US&sortBy=annualSales&sortDir=desc&pageSize=20")}
          className="flex-1 h-9 text-sm text-text-strong-950/70 border border-stroke-soft-200 rounded-lg hover:bg-bg-weak-50 hover:text-text-strong-950 transition-colors"
        >
          {t("reset")}
        </button>
        {isPending && (
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
        )}
      </div>

    </div>
  );
}
