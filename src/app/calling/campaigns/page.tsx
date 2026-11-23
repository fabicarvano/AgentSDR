import { getTranslations } from "next-intl/server";
import CampaignsClient from "@/components/calling/CampaignsClient";

export async function generateMetadata() {
  const t = await getTranslations("callingMain.page");
  return { title: t("campaignsTitle") };
}

export default function CallCampaignsPage() {
  return <CampaignsClient />;
}
