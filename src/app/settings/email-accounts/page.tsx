import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AddMailboxButton from "@/components/outreach/AddMailboxButton";
import MailboxesPageClient from "@/components/outreach/MailboxesPageClient";
import { RequiresPlatform } from "@/components/settings/RequiresPlatform";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { requirePageOrgContext } from "@/lib/auth/context";
import { runInOrganization } from "@/lib/tenancy/scope";
import { listMailboxes } from "@/lib/outreach/mailboxes";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsAccounts.emailPage");
  return { title: t("title") };
}

async function Mailboxes() {
  const ctx = await requirePageOrgContext();
  const mailboxes = await runInOrganization(ctx.organizationId, () => listMailboxes());
  return <MailboxesPageClient mailboxes={mailboxes} />;
}

export default async function EmailAccountsPage() {
  const t = await getTranslations("settingsAccounts.emailPage");
  return (
    <SettingsPage
      title={t("title")}
      description={t("description")}
      actions={
        <RequiresPlatform platform="google" fallback={null}>
          <AddMailboxButton />
        </RequiresPlatform>
      }
    >
      <RequiresPlatform platform="google">
        <Mailboxes />
      </RequiresPlatform>
    </SettingsPage>
  );
}
