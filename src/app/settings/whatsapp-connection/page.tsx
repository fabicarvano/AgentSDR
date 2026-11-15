import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConnectionSettingsPage } from "@/components/settings/ChannelSettingsPages";
import { RecorderExtensionCard } from "@/components/settings/RecorderExtensionCard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsChannels.whatsappConnection");
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("settingsChannels.whatsappConnection");
  return (
    <ConnectionSettingsPage
      platforms={[
        { platform: "unipile", note: t("unipileNote") },
        { platform: "r2" },
        { platform: "gologin", note: t("gologinNote") },
        { platform: "calcom", note: t("calcomNote"), webhookUrl: true },
      ]}
      title={t("title")}
      description={t("description")}
    >
      <RecorderExtensionCard />
    </ConnectionSettingsPage>
  );
}
