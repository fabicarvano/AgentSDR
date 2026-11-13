"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useDialogs } from "@/components/DialogProvider";

type Props = {
  total: number;
  onClose: () => void;
};

const PRESETS = [100, 500, 1000, 5000, 10000, 25000, 50000];

// The header names /api/export writes into the CSV. The file is English on the server, and this
// line only tells the person which columns to expect, so it stays English to match the file.
const CSV_COLUMNS =
  "Domain, Merchant Name, Platform, Rank, Country, Annual Sales, Categories, L1, L2, L3, Installed Apps, Emails, Phones";

export default function ExportModal({ total, onClose }: Props) {
  const t = useTranslations("shared.export");
  const tu = useTranslations("shared.ui");
  const dialogs = useDialogs();
  const format = useFormatter();
  const matchCount = t.rich("matchCount", {
    count: total,
    b: (chunks) => <span className="font-semibold text-text-strong-950">{chunks}</span>,
  });
  const searchParams = useSearchParams();
  const [limit, setLimit] = useState(() => Math.min(1000, total));
  const [loading, setLoading] = useState(false);

  const availablePresets = PRESETS.filter((p) => p <= total);
  // Always add the exact total if not already in presets
  const options = availablePresets.includes(total) ? availablePresets : [...availablePresets, total];

  async function handleExport() {
    setLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set("limit", String(limit));
    // Remove pagination params
    params.delete("page");
    params.delete("pageSize");

    const url = `/api/export?${params.toString()}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "export.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      onClose();
    } catch {
      void dialogs.alert({ title: t("errorTitle"), description: t("errorDescription"), variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-bg-white-0 rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-text-strong-950">{t("title")}</h2>
            <p className="text-sm text-text-strong-950/60 mt-0.5">
              {matchCount}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={tu("close")}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-strong-950/50 hover:bg-bg-weak-50 hover:text-text-strong-950/70 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Row count selector */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-text-strong-950 uppercase tracking-widest mb-3">
            {t("howMany")}
          </label>

          {/* Preset chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {options.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setLimit(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  limit === p
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-bg-white-0 text-text-strong-950/70 border-stroke-soft-200 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
              >
                {p === total ? t("all", { count: p }) : format.number(p)}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-strong-950 font-medium shrink-0">{t("custom")}</label>
            <input
              type="number"
              min={1}
              max={Math.min(total, 50000)}
              value={limit}
              onChange={(e) => {
                const v = Math.min(Math.min(total, 50000), Math.max(1, parseInt(e.target.value) || 1));
                setLimit(v);
              }}
              className="w-full border border-stroke-soft-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>
          {total > 50000 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{t("maxRows", { max: 50000 })}</p>
          )}
        </div>

        {/* Columns preview */}
        <div className="mb-6 p-3 bg-bg-weak-50 rounded-lg">
          <p className="text-xs font-bold text-text-strong-950 uppercase tracking-widest mb-2">{t("columnsIncluded")}</p>
          <p className="text-xs text-text-strong-950/70 leading-relaxed">
            {CSV_COLUMNS}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-text-strong-950/70 border border-stroke-soft-200 rounded-lg hover:bg-bg-weak-50 transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleExport}
            disabled={loading || limit < 1}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t("exporting")}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t("exportRows", { count: limit })}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
