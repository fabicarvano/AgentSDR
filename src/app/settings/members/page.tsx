import { getTranslations } from "next-intl/server";
import { OrgMembers } from "@/components/settings/organization/OrgMembers";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("settingsOrg.membersPage");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations("settingsOrg.membersPage");
  return (
    <SettingsPage title={t("title")} description={t("description")} width="narrow">
      <OrgMembers />
    </SettingsPage>
  );
}
