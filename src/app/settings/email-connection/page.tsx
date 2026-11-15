import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConnectionSettingsPage } from "@/components/settings/ChannelSettingsPages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsChannels.emailConnection");
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("settingsChannels.emailConnection");
  return (
    <ConnectionSettingsPage
      platforms={[{ platform: "google" }]}
      comingSoon={[
        {
          // Product name: stays in English.
          name: "Microsoft Outlook",
          description: t("outlook.description"),
          iconUrl: "/Integrations - Icon/microsoft.svg",
          enables: [t("outlook.enablesMailboxes"), t("outlook.enablesCampaigns"), t("outlook.enablesInbox")],
        },
      ]}
      title={t("title")}
      description={t("description")}
    />
  );
}
