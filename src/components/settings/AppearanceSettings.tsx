"use client";

import { RiMoonLine, RiSunLine } from "@remixicon/react";
import { useTranslations } from "next-intl";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useTheme } from "@/components/theme/ThemeProvider";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { FieldRow } from "./SettingsKit";

const SHOWING_ICON = { light: RiSunLine, dark: RiMoonLine } as const;

/** The Appearance section: the Light / Dark / System switch and what it is doing right now, then the interface language. */
export default function AppearanceSettings() {
  const t = useTranslations("settings.appearance");
  const tl = useTranslations("language");
  const { preference, resolved } = useTheme();
  const Showing = SHOWING_ICON[resolved];

  return (
    <div className="flex flex-col gap-6">
      <Frame>
        <FrameHeader title={t("themeTitle")} description={t("themeDescription")} />
        <FramePanel>
          <FieldRow label={t("colourTheme")} description={t("colourThemeDescription")}>
            <ThemeSwitch className="w-full" />
            {preference === "system" && (
              <p className="mt-2 flex items-center gap-1.5 text-paragraph-xs text-text-sub-600">
                <Showing className="size-3.5 shrink-0 text-text-soft-400" aria-hidden="true" />
                {t("showing", { theme: resolved })}
              </p>
            )}
          </FieldRow>
        </FramePanel>
        <FrameFooter>{t("footer")}</FrameFooter>
      </Frame>

      <Frame>
        <FrameHeader title={tl("title")} description={tl("description")} />
        <FramePanel>
          <FieldRow label={tl("fieldLabel")} description={tl("fieldDescription")}>
            <LanguageSwitcher />
          </FieldRow>
        </FramePanel>
        <FrameFooter>{tl("footer")}</FrameFooter>
      </Frame>
    </div>
  );
}
