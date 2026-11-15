import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsPage } from "@/components/settings/SettingsPage";
import InstructionsSettings from "@/components/settings/InstructionsSettings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsKnowledge.instructions");
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

export default async function InstructionsPage() {
  const t = await getTranslations("settingsKnowledge.instructions");
  return (
    <SettingsPage title={t("title")} description={t("description")}>
      <InstructionsSettings />
    </SettingsPage>
  );
}
