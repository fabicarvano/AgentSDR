import { getTranslations } from "next-intl/server";
import AppearanceSettings from "@/components/settings/AppearanceSettings";
import { SettingsPage } from "@/components/settings/SettingsPage";

export async function generateMetadata() {
  const t = await getTranslations("settings.appearance");
  return { title: t("pageTitle") };
}

export default async function AppearancePage() {
  const t = await getTranslations("settings.appearance");
  return (
    <SettingsPage title={t("pageTitle")} description={t("pageDescription")} width="narrow">
      <AppearanceSettings />
    </SettingsPage>
  );
}
