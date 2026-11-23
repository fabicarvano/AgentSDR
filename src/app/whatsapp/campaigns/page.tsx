import { getTranslations } from "next-intl/server";
import { requirePageOrgContext } from "@/lib/auth/context";
import { WhatsappCampaignsClient } from "@/components/whatsapp/campaigns/WhatsappCampaignsClient";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("whatsappCampaigns.page");
  return { title: t("listTitle") };
}

export default async function WhatsappCampaignsPage() {
  await requirePageOrgContext();
  return <WhatsappCampaignsClient />;
}
