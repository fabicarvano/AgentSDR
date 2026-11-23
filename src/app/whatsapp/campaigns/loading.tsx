import { getTranslations } from "next-intl/server";
import { KpiStripSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/page/Skeletons";

export default async function WhatsappCampaignsLoading() {
  const t = await getTranslations("whatsappCampaigns.loading");
  return (
    <div aria-busy="true" aria-label={t("label")} className="mx-auto w-full max-w-[1440px] space-y-6">
      <PageHeaderSkeleton />
      <KpiStripSkeleton cells={4} />
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}
