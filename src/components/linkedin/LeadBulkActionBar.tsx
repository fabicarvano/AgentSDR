"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/linkedin/ui/button";
import { Loader2, Trash2, X } from "lucide-react";

export function LeadBulkActionBar({
  selectedCount,
  pageCount,
  totalCount,
  allPageSelected,
  allMatchingSelected,
  onSelectAllMatching,
  onClear,
  onDelete,
  deleting,
  selectingAll,
}: {
  selectedCount: number;
  pageCount: number;
  totalCount: number;
  allPageSelected: boolean;
  allMatchingSelected: boolean;
  onSelectAllMatching: () => void;
  onClear: () => void;
  onDelete: () => void;
  deleting: boolean;
  selectingAll?: boolean;
}) {
  const t = useTranslations("linkedinMain.bulkBar");
  const showSelectAllBanner =
    allPageSelected &&
    !allMatchingSelected &&
    totalCount > pageCount &&
    pageCount > 0;

  if (selectedCount === 0 && !showSelectAllBanner) return null;

  return (
    <div className="space-y-2 mb-3">
      {showSelectAllBanner && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-2.5 text-sm text-blue-900 dark:text-blue-400">
          {t.rich("pageSelected", { count: pageCount, b: (chunks) => <span className="font-semibold">{chunks}</span> })}{" "}
          <button
            type="button"
            onClick={onSelectAllMatching}
            disabled={selectingAll || deleting}
            className="font-semibold text-blue-700 dark:text-blue-400 underline hover:text-blue-900 dark:hover:text-blue-400 disabled:opacity-50"
          >
            {selectingAll ? t("selecting") : t("selectAll", { count: totalCount })}
          </button>
        </div>
      )}

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-2.5">
          <p className="text-sm text-blue-900 dark:text-blue-400">
            {allMatchingSelected
              ? t.rich("selectedAllMatching", { count: selectedCount, b: (chunks) => <span className="font-semibold">{chunks}</span>, note: (chunks) => <span className="text-blue-700/80 dark:text-blue-400">{chunks}</span> })
              : selectedCount > pageCount
                ? t.rich("selectedAcrossPages", { count: selectedCount, b: (chunks) => <span className="font-semibold">{chunks}</span>, note: (chunks) => <span className="text-blue-700/80 dark:text-blue-400">{chunks}</span> })
                : t.rich("selected", { count: selectedCount, b: (chunks) => <span className="font-semibold">{chunks}</span> })}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClear} disabled={deleting || selectingAll} className="h-8">
              <X className="h-4 w-4" />
              {t("clear")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={deleting || selectingAll}
              className="h-8 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("deleteSelected")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
