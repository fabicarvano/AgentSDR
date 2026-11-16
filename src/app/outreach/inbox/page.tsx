import { getTranslations } from "next-intl/server";
import InboxClient from "@/components/inbox/InboxClient";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("inboxMain.page");
  return { title: t("title") };
}

export default function InboxPage() {
  return (
    <div className="h-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <InboxClient />
    </div>
  );
}
