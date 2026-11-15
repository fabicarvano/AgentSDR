import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlatformConnectPrompt, RequiresPlatform } from "@/components/settings/RequiresPlatform";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { WhatsappAccountsClient } from "@/components/whatsapp/WhatsappAccountsClient";
import { requirePageOrgContext } from "@/lib/auth/context";
import { channelRules } from "@/lib/channels/rules.server";
import { docsPageUrl } from "@/lib/support";
import { runInOrganization } from "@/lib/tenancy/scope";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsAccounts.whatsappPage");
  return { title: t("title") };
}

async function Numbers() {
  const ctx = await requirePageOrgContext();
  const rules = await runInOrganization(ctx.organizationId, () => channelRules("whatsapp"));
  return <WhatsappAccountsClient rules={{ warmupHours: rules.warmupHours, newChatsPerDay: rules.newChatsPerDay, secondsBetweenSends: rules.secondsBetweenSends }} />;
}

export default async function WhatsappAccountsPage() {
  const t = await getTranslations("settingsAccounts.whatsappPage");
  return (
    <RequiresPlatform
      platform="unipile"
      fallback={
        <SettingsPage title={t("title")} description={t("description")}>
          {/* The gate's prompt, under the page header the client component would have supplied. */}
          <PlatformConnectPrompt platform="unipile" settingsHref="/settings/whatsapp-connection" guideHref={docsPageUrl("whatsapp/accounts")} />
        </SettingsPage>
      }
    >
      <Numbers />
    </RequiresPlatform>
  );
}
