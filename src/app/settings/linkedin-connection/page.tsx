import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConnectionSettingsPage } from "@/components/settings/ChannelSettingsPages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsChannels.linkedinConnection");
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("settingsChannels.linkedinConnection");
  return <ConnectionSettingsPage platforms={[{ platform: "unipile", note: t("unipileNote") }]} title={t("title")} description={t("description")} />;
}
