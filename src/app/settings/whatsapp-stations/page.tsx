import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CallingStationsSettings } from "@/components/settings/CallingStationsSettings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settingsStations.page");
  return { title: t("title") };
}

export default function WhatsappStationsPage() {
  return <CallingStationsSettings />;
}
