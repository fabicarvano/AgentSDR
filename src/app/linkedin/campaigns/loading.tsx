import { useTranslations } from "next-intl";
import { KpiStripSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/page/Skeletons";

// The LinkedIn layout already pads the page, so this is ListPageSkeleton's
// content without its PageContainer.
export default function CampaignsLoading() {
  const t = useTranslations("linkedinCampaigns.loading");
  return (
    <div aria-busy="true" aria-label={t("label")} className="mx-auto w-full max-w-[1440px] space-y-6">
      <PageHeaderSkeleton />
      <KpiStripSkeleton cells={5} />
      <TableSkeleton rows={8} columns={7} />
    </div>
  );
}
