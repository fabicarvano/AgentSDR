import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CrmKnowledgeClient from "@/components/crm/CrmKnowledgeClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsKnowledge.knowledge");
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

/** CrmKnowledgeClient renders the section header, since its "Add document" action opens state it holds. */
export default function KnowledgePage() {
  return <CrmKnowledgeClient />;
}
