import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsShell } from "@/components/settings/SettingsShell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.shell");
  return {
    title: {
      default: t("titleDefault"),
      // Each section's own title fills the %s: "Members · Settings · AgentSDR".
      template: t("titleTemplate"),
    },
  };
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}
