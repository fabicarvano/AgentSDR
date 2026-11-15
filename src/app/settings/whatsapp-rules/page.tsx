import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RulesSettingsPage } from "@/components/settings/ChannelSettingsPages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsChannels.whatsappRules");
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("settingsChannels.whatsappRules");
  return <RulesSettingsPage channel="whatsapp" title={t("title")} description={t("description")} />;
}
