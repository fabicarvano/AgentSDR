import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsPage } from "@/components/settings/SettingsPage";
import CrmSettingsClient from "@/components/crm/CrmSettingsClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsKnowledge.leadCategories");
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

export default async function LeadCategoriesPage() {
  const t = await getTranslations("settingsKnowledge.leadCategories");
  return (
    <SettingsPage title={t("title")} description={t("description")}>
      <CrmSettingsClient />
    </SettingsPage>
  );
}
