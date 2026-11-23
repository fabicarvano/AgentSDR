import { getTranslations } from "next-intl/server";
import { WhatsappMessagesClient } from "@/components/whatsapp/WhatsappMessagesClient";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("callingMain.page");
  return { title: t("messagesTitle") };
}

export default async function CallingMessagesPage({ searchParams }: { searchParams: Promise<{ chat?: string }> }) {
  const { chat } = await searchParams;
  return <WhatsappMessagesClient initialChatId={chat ?? null} />;
}
