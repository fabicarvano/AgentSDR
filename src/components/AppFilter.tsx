"use client";

import { useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import appsData from "@/data/apps.json";

type Props = {
  value: string;
  onChange: (app: string) => void;
};

/** Counts next to each option: 1.2M / 12K in English, 1,2 mi / 12 mil in Portuguese. */
function fmt(format: ReturnType<typeof useFormatter>, n: number) {
  if (n >= 1_000_000) return format.number(n, { notation: "compact", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (n >= 1_000) return format.number(n, { notation: "compact", maximumFractionDigits: 0 });
  return format.number(n);
}

const ALL_APPS = appsData as { name: string; count: number }[];

// A multiplication sign on the clear button: a symbol, not language.
const CLEAR_SIGN = "×";

export default function AppFilter({ value, onChange }: Props) {
  const t = useTranslations("shared.appFilter");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? ALL_APPS.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : ALL_APPS;

  function handleOpen() {
    setOpen((o) => {
      if (!o) setTimeout(() => searchRef.current?.focus(), 50);
      return !o;
    });
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40" onMouseDown={handleBackdrop} />}
      <div ref={ref} className="relative w-full">
        <button
          type="button"
          onClick={handleOpen}
          className={`
            w-full flex items-center justify-between gap-2 rounded-lg border text-left
            px-3 py-2.5 text-sm transition-all duration-150 focus:outline-none
            ${value ? "border-violet-400 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 font-medium" : "border-stroke-soft-200 bg-bg-white-0 text-text-strong-950/50 hover:border-stroke-sub-300"}
            ${open ? "ring-2 ring-violet-300 dark:ring-violet-500/30 border-violet-400" : ""}
          `}
        >
          <span className="truncate">{value || t("allApps")}</span>
          <div className="flex items-center gap-1 shrink-0">
            {value && (
              <span
                role="button"
                aria-label={t("clear")}
                onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
                className="w-4 h-4 flex items-center justify-center rounded-full text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-500/25 hover:text-violet-700 dark:hover:text-violet-400 transition-colors text-xs"
              >
                {CLEAR_SIGN}
              </span>
            )}
            <svg className={`w-4 h-4 text-text-strong-950/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-stroke-soft-200 bg-bg-white-0 shadow-xl shadow-slate-200/60 dark:shadow-black/40 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-stroke-soft-200">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-strong-950/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="w-full pl-7 pr-3 py-1.5 text-sm border border-stroke-soft-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-500/30 focus:border-transparent placeholder-text-disabled-300"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {/* All / clear */}
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-stroke-soft-200 transition-colors ${
                  !value ? "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 font-medium" : "text-text-strong-950/50 hover:bg-bg-weak-50"
                }`}
              >
                {t("allApps")}
              </button>

              {filtered.length === 0 && (
                <p className="text-center py-6 text-sm text-text-strong-950/50">{t("noResults")}</p>
              )}

              {filtered.map(({ name, count }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onChange(name); setOpen(false); setSearch(""); }}
                  className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors ${
                    name === value ? "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 font-medium" : "text-text-strong-950 hover:bg-bg-weak-50"
                  }`}
                >
                  <span className="truncate min-w-0 flex-1">{name}</span>
                  <span className={`text-xs tabular-nums shrink-0 ${name === value ? "text-violet-400" : "text-text-strong-950/50"}`}>
                    {fmt(format, count)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
