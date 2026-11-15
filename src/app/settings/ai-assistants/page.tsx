import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AiAssistantsSettings } from "@/components/settings/AiAssistantsSettings";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { requirePageOrgContext } from "@/lib/auth/context";
import { mcpResourceUrl } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsAi.assistantsPage");
  return { title: t("title") };
}

export default async function Page() {
  await requirePageOrgContext();
  const t = await getTranslations("settingsAi.assistantsPage");
  return (
    <SettingsPage
      title={t("title")}
      description={t("description")}
      width="narrow"
    >
      <AiAssistantsSettings serverUrl={mcpResourceUrl()} />
    </SettingsPage>
  );
}
