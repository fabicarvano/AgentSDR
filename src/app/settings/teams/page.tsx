import { getTranslations } from "next-intl/server";
import { OrgTeams } from "@/components/settings/organization/OrgTeams";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("settingsOrg.teamsPage");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations("settingsOrg.teamsPage");
  return (
    <SettingsPage title={t("title")} description={t("description")} width="narrow">
      <OrgTeams />
    </SettingsPage>
  );
}
