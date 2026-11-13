import {
  RiBookOpenLine,
  RiBuilding2Line,
  RiCpuLine,
  RiEqualizerLine,
  RiGroupLine,
  RiKey2Line,
  RiRobot2Line,
  RiTeamLine,
  RiLayoutColumnLine,
  RiLinkedinBoxLine,
  RiMailLine,
  RiPhoneLine,
  RiPlugLine,
  RiPaletteLine,
  RiPriceTag3Line,
  RiQuillPenLine,
  RiWhatsappLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import type { Messages } from "@/i18n/catalog";

/** Labels are message keys, not text: this file is data and cannot call hooks. Render with t(labelKey). */
export type SettingsItemKey = keyof Messages["settings"]["nav"]["items"];
export type SettingsGroupKey = keyof Messages["settings"]["nav"]["groups"];

export type SettingsTab = { href: string; labelKey: SettingsItemKey; icon: RemixiconComponentType };

/** A row in the settings rail. With `tabs`, it opens the first and stays active on any of them. */
export type SettingsNavItem = SettingsTab & { tabs?: SettingsTab[] };

/** Every page a row covers: itself, or its tabs. */
export function itemPages(item: SettingsNavItem): SettingsTab[] {
  return item.tabs ?? [item];
}

/**
 * Every settings screen in the app. Each is its own route under /settings;
 * the pages they replaced redirect here (next.config.ts).
 */
export const SETTINGS_NAV: { labelKey: SettingsGroupKey; items: SettingsNavItem[] }[] = [
  {
    labelKey: "organization",
    items: [
      { href: "/settings/organization", labelKey: "general", icon: RiBuilding2Line },
      { href: "/settings/members", labelKey: "members", icon: RiGroupLine },
      { href: "/settings/teams", labelKey: "teams", icon: RiTeamLine },
      { href: "/settings/api-keys", labelKey: "apiKeys", icon: RiKey2Line },
      { href: "/settings/ai-assistants", labelKey: "aiAssistants", icon: RiRobot2Line },
    ],
  },
  // Each channel is one row here; its pages — the connected accounts, the
  // integration it runs on, its sending rules (src/lib/channels/rules.ts) —
  // are tabs across the top of the section (SettingsShell).
  {
    labelKey: "channels",
    items: [
      {
        href: "/settings/email-accounts",
        labelKey: "email",
        icon: RiMailLine,
        tabs: [
          { href: "/settings/email-accounts", labelKey: "mailboxes", icon: RiMailLine },
          { href: "/settings/email-connection", labelKey: "connection", icon: RiPlugLine },
          { href: "/settings/email-rules", labelKey: "sendingRules", icon: RiEqualizerLine },
        ],
      },
      {
        href: "/settings/linkedin-accounts",
        labelKey: "linkedin",
        icon: RiLinkedinBoxLine,
        tabs: [
          { href: "/settings/linkedin-accounts", labelKey: "accounts", icon: RiLinkedinBoxLine },
          { href: "/settings/linkedin-connection", labelKey: "connection", icon: RiPlugLine },
          { href: "/settings/linkedin-rules", labelKey: "sendingRules", icon: RiEqualizerLine },
        ],
      },
      {
        href: "/settings/whatsapp-accounts",
        labelKey: "whatsapp",
        icon: RiWhatsappLine,
        tabs: [
          { href: "/settings/whatsapp-accounts", labelKey: "numbers", icon: RiWhatsappLine },
          { href: "/settings/whatsapp-stations", labelKey: "callingNumbers", icon: RiPhoneLine },
          { href: "/settings/whatsapp-connection", labelKey: "integrations", icon: RiPlugLine },
          { href: "/settings/whatsapp-rules", labelKey: "sendingRules", icon: RiEqualizerLine },
        ],
      },
    ],
  },
  {
    labelKey: "ai",
    items: [
      { href: "/settings/instructions", labelKey: "instructions", icon: RiQuillPenLine },
      { href: "/settings/knowledge", labelKey: "knowledge", icon: RiBookOpenLine },
      { href: "/settings/ai", labelKey: "aiProvider", icon: RiCpuLine },
    ],
  },
  {
    labelKey: "crm",
    items: [
      { href: "/settings/lead-categories", labelKey: "leadCategories", icon: RiPriceTag3Line },
      { href: "/settings/columns", labelKey: "leadColumns", icon: RiLayoutColumnLine },
    ],
  },
  {
    labelKey: "preferences",
    items: [{ href: "/settings/appearance", labelKey: "appearance", icon: RiPaletteLine }],
  },
];

/** Where "Settings" opens. */
export const SETTINGS_HOME = SETTINGS_NAV[0].items[0].href;

