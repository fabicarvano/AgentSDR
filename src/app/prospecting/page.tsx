import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requirePageOrgContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("leads.prospecting");
  return { title: t("title") };
}

export default async function ProspectingPage() {
  await requirePageOrgContext();
  const t = await getTranslations("leads.prospecting");

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-bg-weak-50 p-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-bold text-text-strong-950">{t("title")}</h1>
        <p className="mt-2 text-sm text-text-strong-950/60">{t("description")}</p>
      </div>
    </div>
  );
}
