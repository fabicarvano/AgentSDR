import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LeadsClient from "@/components/leads/LeadsClient";
import { PAGE_SIZE, type LeadsTab } from "@/components/leads/leadTypes";
import { requirePageOrgContext } from "@/lib/auth/context";
import { runInOrganization } from "@/lib/tenancy/scope";
import { listCompanies, listPeoplePage } from "@/lib/leads/records";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("leads.page");
  return { title: t("title") };
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const ctx = await requirePageOrgContext();
  const { tab } = await searchParams;
  const initialTab: LeadsTab = tab === "companies" ? "companies" : "people";
  const result = await runInOrganization(ctx.organizationId, () =>
    initialTab === "companies" ? listCompanies({ limit: PAGE_SIZE }) : listPeoplePage({ limit: PAGE_SIZE }),
  );
  return <LeadsClient initialTab={initialTab} initialRows={result.rows} initialTotal={result.total} />;
}
