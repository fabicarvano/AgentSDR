import { getTranslations } from "next-intl/server";
import { requirePageOrgContext } from "@/lib/auth/context";
import { AiCampaignWizard } from "@/components/calling/ai/AiCampaignWizard";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("callingAiSetup.page");
  return { title: t("newTitle") };
}

export default async function NewAiCallCampaignPage() {
  await requirePageOrgContext();
  return <AiCampaignWizard />;
}
