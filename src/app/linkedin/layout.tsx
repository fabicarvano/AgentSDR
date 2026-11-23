import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RequiresPlatform } from "@/components/settings/RequiresPlatform";

/**
 * LinkedIn pages share their own padded, scrolling content surface. The global
 * app shell supplies the persistent navigation sidebar.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("serverMeta.linkedin");
  return {
    // "LinkedIn" is a brand name, so the title stays the same in every language.
    title: { default: "LinkedIn · AgentSDR", template: "%s · LinkedIn · AgentSDR" },
    description: t("description"),
  };
}

// Reads the database (is Unipile connected?), so the segment renders per request.
export const dynamic = "force-dynamic";

export default function LinkedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative h-full overflow-auto bg-bg-white-0 px-4 py-5 text-text-strong-950 sm:px-6 sm:py-6 lg:px-8">
      <RequiresPlatform platform="unipile">{children}</RequiresPlatform>
    </main>
  );
}
