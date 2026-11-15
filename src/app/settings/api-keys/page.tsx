import { getTranslations } from "next-intl/server";
import { ApiKeysSettings } from "@/components/settings/ApiKeysSettings";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { Callout } from "@/components/settings/SettingsKit";
import { can, requirePageOrgContext } from "@/lib/auth/context";
import { listApiKeys } from "@/lib/publicApi/keys";
import { runInOrganization } from "@/lib/tenancy/scope";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("settingsOrg.apiKeysPage");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations("settingsOrg.apiKeysPage");
  const ctx = await requirePageOrgContext();
  const canManage = can(ctx, { integrations: ["manage"] });
  const keys = canManage ? await runInOrganization(ctx.organizationId, listApiKeys) : [];
  return (
    <SettingsPage
      title={t("title")}
      description={t("description")}
      width="narrow"
    >
      {canManage ? (
        <ApiKeysSettings initialKeys={keys} />
      ) : (
        <Callout tone="info">{t("adminOnly")}</Callout>
      )}
    </SettingsPage>
  );
}
