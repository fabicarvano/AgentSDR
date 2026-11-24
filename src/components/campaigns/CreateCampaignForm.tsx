"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Messages } from "@/i18n/catalog";
import Select from "../ui/Select";
import CategoryFilter from "../CategoryFilter";
import AppFilter from "../AppFilter";
import { useApiErrorText } from "@/i18n/useApiErrorText";

type CreateKey = keyof Messages["emailCampaigns"]["legacyCreate"];

// Option labels are keys, rendered with t() inside the component. The values are what the API receives.
const MODE_OPTIONS: { value: string; labelKey: CreateKey }[] = [
  { value: "filters", labelKey: "sourceFilters" },
  { value: "manual", labelKey: "sourceManual" },
];

const TARGET_MODE_OPTIONS: { value: string; labelKey: CreateKey }[] = [
  { value: "leads", labelKey: "targetLeads" },
  { value: "domains", labelKey: "targetDomains" },
];

const COUNTRY_OPTIONS: { value: string; labelKey: CreateKey }[] = [
  { value: "US", labelKey: "countryUS" },
  { value: "GB", labelKey: "countryGB" },
  { value: "CA", labelKey: "countryCA" },
  { value: "AU", labelKey: "countryAU" },
  { value: "IN", labelKey: "countryIN" },
  { value: "DE", labelKey: "countryDE" },
];

// Platform names are products, so they stay in English; only the "all" entry is translated.
const PLATFORM_OPTIONS: { value: string; labelKey?: CreateKey; label?: string }[] = [
  { value: "", labelKey: "platformAll" },
  { value: "Shopify", label: "Shopify" },
  { value: "WooCommerce", label: "WooCommerce" },
  { value: "BigCommerce", label: "BigCommerce" },
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-bold text-text-strong-950/70 uppercase tracking-widest">
      {children}
    </label>
  );
}

const inputCls =
  "w-full h-10 border border-stroke-soft-200 rounded-lg px-3 text-sm text-text-strong-950 placeholder-text-soft-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent";

export default function CreateCampaignForm() {
  const t = useTranslations("emailCampaigns.legacyCreate");
  const apiErrorText = useApiErrorText();
  const modeOptions = MODE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  const targetModeOptions = TARGET_MODE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  const countryOptions = COUNTRY_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  const platformOptions = PLATFORM_OPTIONS.map((o) => ({ value: o.value, label: o.labelKey ? t(o.labelKey) : (o.label ?? o.value) }));
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inputMode, setInputMode] = useState("filters");
  const [jobTitles, setJobTitles] = useState("");
  const [targetMode, setTargetMode] = useState("leads");
  const [targetLeadCount, setTargetLeadCount] = useState("3000");
  const [targetDomainCount, setTargetDomainCount] = useState("150");

  // filters mode
  const [countryCode, setCountryCode] = useState("US");
  const [platform, setPlatform] = useState("");
  const [minRevenue, setMinRevenue] = useState("");
  const [maxRevenue, setMaxRevenue] = useState("");
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const [app, setApp] = useState("");

  // manual mode
  const [domainsText, setDomainsText] = useState("");

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const body: Record<string, unknown> = {
      inputMode,
      jobTitles: jobTitles
        .split(",")
        .map((title) => title.trim())
        .filter(Boolean),
      targetMode,
      ...(targetMode === "domains"
        ? { targetDomainCount: Number(targetDomainCount) || 150 }
        : { targetLeadCount: Number(targetLeadCount) || 3000 }),
    };

    if (inputMode === "filters") {
      body.filters = {
        countryCode,
        platform: platform || undefined,
        minRevenue: minRevenue || undefined,
        maxRevenue: maxRevenue || undefined,
        c1: c1 || undefined,
        c2: c2 || undefined,
        c3: c3 || undefined,
        app: app || undefined,
      };
    } else {
      body.domains = domainsText
        .split(/[\n,]+/)
        .map((d) => d.trim())
        .filter(Boolean);
    }

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(apiErrorText(data, t("createFailed")));
      router.push(`/campaigns/${data.campaign.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("createFailed"));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="flex flex-col gap-1.5">
        <Label>{t("labelSource")}</Label>
        <Select value={inputMode} onChange={setInputMode} options={modeOptions} variant="primary" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("labelTargetBy")}</Label>
        <Select value={targetMode} onChange={setTargetMode} options={targetModeOptions} />
      </div>

      {targetMode === "domains" ? (
        <div className="flex flex-col gap-1.5">
          <Label>{t("labelTopDomains")}</Label>
          <input
            type="number"
            value={targetDomainCount}
            onChange={(e) => setTargetDomainCount(e.target.value)}
            placeholder="150"
            className={inputCls}
          />
          <p className="text-[11px] text-text-strong-950/45">
            {t("hintTopDomains")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label>{t("labelLeadTarget")}</Label>
          <input
            type="number"
            value={targetLeadCount}
            onChange={(e) => setTargetLeadCount(e.target.value)}
            placeholder="3000"
            className={inputCls}
          />
          <p className="text-[11px] text-text-strong-950/45">{t("hintLeadTarget")}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>{t("labelJobTitles")}</Label>
        <input
          value={jobTitles}
          onChange={(e) => setJobTitles(e.target.value)}
          // Example titles stay in English: Apollo job-title filters are English.
          // eslint-disable-next-line i18next/no-literal-string
          placeholder="CEO, Founder, Head of Marketing"
          className={inputCls}
        />
      </div>

      <div className="h-px bg-bg-weak-50" />

      {inputMode === "filters" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>{t("labelCountry")}</Label>
            <Select value={countryCode} onChange={setCountryCode} options={countryOptions} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("labelPlatform")}</Label>
            <Select value={platform} onChange={setPlatform} options={platformOptions} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("labelRevenue")}</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder={t("placeholderMin")}
                value={minRevenue}
                onChange={(e) => setMinRevenue(e.target.value)}
                className={inputCls}
              />
              <span className="text-text-strong-950/30 text-sm shrink-0">–</span>
              <input
                type="number"
                placeholder={t("placeholderMax")}
                value={maxRevenue}
                onChange={(e) => setMaxRevenue(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("labelCategory")}</Label>
            <CategoryFilter
              countryCode={countryCode}
              c1={c1}
              c2={c2}
              c3={c3}
              onChange={(updates) => {
                if ("c1" in updates) { setC1(updates.c1); setC2(updates.c2 ?? ""); setC3(updates.c3 ?? ""); }
                else if ("c2" in updates) { setC2(updates.c2); setC3(updates.c3 ?? ""); }
                else if ("c3" in updates) setC3(updates.c3);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("labelApp")}</Label>
            <AppFilter value={app} onChange={setApp} />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label>{t("labelDomains")}</Label>
          <textarea
            value={domainsText}
            onChange={(e) => setDomainsText(e.target.value)}
            // Example domains, not interface text.
            // eslint-disable-next-line i18next/no-literal-string
            placeholder={"brand-one.com\nbrand-two.com"}
            rows={6}
            className="w-full border border-stroke-soft-200 rounded-lg px-3 py-2 text-sm text-text-strong-950 placeholder-text-soft-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-y"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="h-10 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {submitting && (
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        )}
        {submitting ? t("creating") : t("create")}
      </button>
    </div>
  );
}
