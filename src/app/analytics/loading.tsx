import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/page/PageHeader";
import { KpiStripSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/page/Skeletons";

// Widths of the four tab placeholders: layout, not text.
const TAB_WIDTHS = ["w-24", "w-16", "w-20", "w-24"];

export default function Loading() {
  const t = useTranslations("analytics.loading");
  return (
    <PageContainer>
      <div aria-busy="true" aria-label={t("label")} className="space-y-6">
        <PageHeaderSkeleton />
        <div className="flex gap-5 border-b border-stroke-soft-200 pb-3">
          {TAB_WIDTHS.map((w, i) => <Skeleton key={i} className={`h-4 ${w}`} />)}
        </div>
        <KpiStripSkeleton cells={5} />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Skeleton className="h-80 rounded-2xl lg:col-span-8" />
          <Skeleton className="h-80 rounded-2xl lg:col-span-4" />
        </div>
      </div>
    </PageContainer>
  );
}
