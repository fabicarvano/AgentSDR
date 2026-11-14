import { getTranslations } from "next-intl/server";
import AnalyticsClient from "@/components/analytics/AnalyticsClient";
import { DEFAULT_RANGE, parseView, serializeRange } from "@/components/analytics/range";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("analytics.page");
  return { title: t("title") };
}

type Search = Promise<{ view?: string | string[]; range?: string | string[] }>;

export default async function AnalyticsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const view = parseView(first(params.view));
  const range = first(params.range);
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <AnalyticsClient initialView={view} initialRange={range ?? serializeRange(DEFAULT_RANGE)} />
    </div>
  );
}
