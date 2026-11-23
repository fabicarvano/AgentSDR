import { getTranslations } from "next-intl/server";
import { requirePageOrgContext } from "@/lib/auth/context";
import { WhatsappCampaignWizard } from "@/components/whatsapp/campaigns/WhatsappCampaignWizard";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("whatsappCampaigns.page");
  return { title: t("newTitle") };
}

export default async function NewWhatsappCampaignPage() {
  await requirePageOrgContext();
  return <WhatsappCampaignWizard />;
}
