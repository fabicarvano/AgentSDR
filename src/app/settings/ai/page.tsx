import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ByokSettingsClient from "@/components/ai/ByokSettingsClient";
import { PlatformConnection } from "@/components/settings/PlatformConnection";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { requirePageOrgContext } from "@/lib/auth/context";
import { listPlatformStatus } from "@/lib/platform/credentials";
import { runInOrganization } from "@/lib/tenancy/scope";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsAi.page");
  return { title: t("title") };
}

export default async function AiSettingsPage() {
  const ctx = await requirePageOrgContext();
  const t = await getTranslations("settingsAi.page");
  const statuses = await runInOrganization(ctx.organizationId, () => listPlatformStatus());
  return (
    <SettingsPage title={t("title")} description={t("description")}>
      <ByokSettingsClient>
        <section className="flex flex-col gap-3 pt-4">
          <div>
            <h3 className="text-label-md text-text-strong-950">{t("tracingTitle")}</h3>
            <p className="mt-1 max-w-2xl text-paragraph-sm text-text-sub-600">
              {t("tracingDescription")}
            </p>
          </div>
          <PlatformConnection platformKey="langfuse" status={statuses.find((status) => status.key === "langfuse") ?? null} />
        </section>
      </ByokSettingsClient>
    </SettingsPage>
  );
}
