import { RiBarChartBoxLine } from "@remixicon/react";
import { useTranslations } from "next-intl";

/**
 * The "nothing to plot" state for a chart card body. Keeps the chart's height
 * so the layout doesn't jump. Props: `title`, `description` (both default to a translated "no data for this period"), `height` (px).
 */
export function EmptyChart({
  title,
  description,
  height = 260,
}: {
  title?: string;
  description?: string;
  height?: number;
}) {
  const t = useTranslations("analytics.kit.empty");
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-bg-weak-50 px-6 text-center" style={{ height }}>
      <RiBarChartBoxLine className="size-6 text-text-soft-400" aria-hidden="true" />
      <p className="mt-2 text-label-sm text-text-strong-950">{title ?? t("title")}</p>
      <p className="mt-0.5 max-w-xs text-paragraph-xs text-text-sub-600">{description ?? t("description")}</p>
    </div>
  );
}
