import { getTranslations } from "next-intl/server";
import { requirePageOrgContext } from "@/lib/auth/context";
import { WhatsappCampaignDetailClient, type CampaignTab } from "@/components/whatsapp/campaigns/WhatsappCampaignDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("whatsappCampaigns.page");
  return { title: t("detailTitle") };
}

export default async function WhatsappCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePageOrgContext();
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const initialTab: CampaignTab = tab === "leads" || tab === "sequence" ? tab : "overview";
  return <WhatsappCampaignDetailClient campaignId={id} initialTab={initialTab} />;
}
