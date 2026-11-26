import type { ComponentType } from "react";
import {
  RiBarChartBoxLine,
  RiBookOpenLine,
  RiBugLine,
  RiLightbulbLine,
  RiShieldCheckLine,
  RiChat3Line,
  RiHistoryLine,
  RiInboxLine,
  RiLinkM,
  RiMegaphoneLine,
  RiChatSmile2Line,
  RiPhoneLine,
  RiSearchLine,
  RiSendPlaneLine,
  RiWebhookLine,
  RiCodeSSlashLine,
  RiDatabase2Line,
  RiGridLine,
  RiLinkedinBoxFill,
  RiMailFill,
  RiSettings3Line,
  RiTimeLine,
  RiTodoLine,
  RiUserSearchLine,
  RiWhatsappFill,
} from "@remixicon/react";
import { Funnel } from "lucide-react";
import { HUE } from "@/components/analytics/theme";
import { APP_VERSION, bugReportUrl, SUPPORT_LINKS } from "@/lib/support";
import type { Messages } from "@/i18n/catalog";
import { SETTINGS_HOME, SETTINGS_NAV, type SettingsGroupKey, type SettingsItemKey } from "@/components/settings/settingsNav";

/**
 * The app's navigation, shared by the sidebar and the ⌘K palette.
 *
 * Shape: a few labelled sections of links and collapsible groups (one group
 * per outreach channel), plus footer entries pinned to the bottom. A link's
 * `match` lists extra path prefixes that should light it up (a record page
 * belongs to Leads).
 *
 * Labels are message keys (shell.nav.*), not text: this file is data and
 * cannot call hooks. A component renders them with `useTranslations("shell.nav")`.
 */

/** A nav icon: Remix or Lucide, both take a className. */
export type NavIcon = ComponentType<{ className?: string }>;

/** A key of shell.nav: the label of a link, group or section. */
export type NavLabelKey = keyof Messages["shell"]["nav"];

/** Live counts from GET /api/nav/badges. */
export type NavBadges = {
  actionRequired: number;
  whatsappUnread: number;
  draftsAwaitingReview: number;
  /** Failing mailboxes + disconnected LinkedIn and WhatsApp accounts. */
  accountsNeedingAttention: number;
};
export type NavBadgeKey = keyof NavBadges;

export type NavLink = {
  kind: "link";
  href: string;
  labelKey: NavLabelKey;
  icon: NavIcon;
  badge?: NavBadgeKey;
  /** "count" shows the number; "dot" only flags that something needs a look. */
  badgeStyle?: "count" | "dot";
  match?: string[];
};

export type NavGroup = {
  kind: "group";
  id: string;
  labelKey: NavLabelKey;
  icon: NavIcon;
  /** Channel identity colour for the group's icon (the Analytics channel colours). */
  color?: string;
  children: NavLink[];
  /** Closed until opened, unless it holds the current page. */
  defaultOpen?: boolean;
};

export type NavEntry = NavLink | NavGroup;
export type NavSection = { labelKey?: NavLabelKey; entries: NavEntry[] };

const link = (href: string, labelKey: NavLabelKey, icon: NavIcon, extra: Partial<NavLink> = {}): NavLink => ({ kind: "link", href, labelKey, icon, ...extra });

export const NAV_SECTIONS: NavSection[] = [
  {
    entries: [
      link("/analytics", "analytics", RiBarChartBoxLine),
      link("/crm/actions", "actionRequired", RiTodoLine, { badge: "actionRequired" }),
      link("/leads", "leads", RiUserSearchLine, { match: ["/crm/records"] }),
    ],
  },
  {
    labelKey: "outreach",
    entries: [
      {
        kind: "group",
        id: "email",
        labelKey: "email",
        icon: RiMailFill,
        color: HUE.orange,
        children: [
          link("/outreach/campaigns", "campaigns", RiSendPlaneLine),
          link("/outreach/inbox", "inbox", RiInboxLine),
        ],
      },
      {
        kind: "group",
        id: "linkedin",
        labelKey: "linkedin",
        icon: RiLinkedinBoxFill,
        color: HUE.blue,
        children: [
          link("/linkedin/campaigns", "campaigns", RiMegaphoneLine),
          link("/linkedin/messages", "messages", RiChat3Line),
          link("/linkedin/search", "search", RiSearchLine),
        ],
      },
      {
        kind: "group",
        id: "whatsapp",
        labelKey: "whatsapp",
        icon: RiWhatsappFill,
        color: HUE.green,
        children: [
          link("/whatsapp/campaigns", "messageCampaigns", RiChatSmile2Line, { match: ["/whatsapp/"] }),
          link("/calling/campaigns", "callCampaigns", RiPhoneLine, { match: ["/calling/"] }),
          link("/calling/messages", "messages", RiChat3Line, { badge: "whatsappUnread" }),
        ],
      },
    ],
  },
  {
    labelKey: "crm",
    entries: [
      link("/crm/pipeline", "pipeline", Funnel),
      link("/crm/sequences", "sequences", RiTimeLine),
    ],
  },
  {
    labelKey: "data",
    entries: [
      link("/prospecting", "prospecting", RiDatabase2Line),
      link("/tables", "tables", RiGridLine),
    ],
  },
];

export const NAV_FOOTER: NavEntry[] = [
  {
    kind: "group",
    id: "developers",
    labelKey: "developers",
    icon: RiCodeSSlashLine,
    children: [
      link("/linkedin/connections", "connections", RiLinkM),
      link("/linkedin/jobs", "jobHistory", RiHistoryLine),
      link("/linkedin/webhooks", "linkedinWebhooks", RiWebhookLine),
    ],
  },
  link(SETTINGS_HOME, "settings", RiSettings3Line, { match: ["/settings"], badge: "accountsNeedingAttention", badgeStyle: "dot" }),
];

export function allLinks(): NavLink[] {
  const entries = [...NAV_SECTIONS.flatMap((s) => s.entries), ...NAV_FOOTER];
  return entries.flatMap((e) => (e.kind === "group" ? e.children : [e]));
}

/** The one link that owns `pathname`: the longest matching href or `match` prefix. */
export function activeHref(pathname: string): string | undefined {
  let best: { href: string; length: number } | undefined;
  for (const l of allLinks()) {
    for (const prefix of [l.href, ...(l.match ?? [])]) {
      const hit = pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
      if (hit && (!best || prefix.length > best.length)) best = { href: l.href, length: prefix.length };
    }
  }
  return best?.href;
}

/** The Help menu: external links, in the sidebar and the ⌘K palette. Labels are keys of shell.help. */
export type HelpLinkKey = keyof Messages["shell"]["help"];
export const HELP_LINKS: { labelKey: HelpLinkKey; href: string; icon: NavIcon }[] = [
  { labelKey: "documentation", href: SUPPORT_LINKS.docs, icon: RiBookOpenLine },
  { labelKey: "reportBug", href: bugReportUrl(APP_VERSION), icon: RiBugLine },
  { labelKey: "requestFeature", href: SUPPORT_LINKS.featureRequest, icon: RiLightbulbLine },
  { labelKey: "askCommunity", href: SUPPORT_LINKS.community, icon: RiChat3Line },
  { labelKey: "reportSecurity", href: SUPPORT_LINKS.security, icon: RiShieldCheckLine },
];

/** The palette's own headings and "create" shortcuts: keys of shell.commandPalette. */
type PaletteLabelKey = "groupPages" | "groupSettings" | "groupCreate" | "groupHelp" | "newEmailCampaign" | "newLinkedinCampaign";

/**
 * Every message key paletteItems() asks for, as full paths: the helper cannot call
 * hooks, so the palette hands it the root translator (`useTranslations()`).
 */
export type PaletteKey =
  | `shell.nav.${NavLabelKey}`
  | `shell.help.${HelpLinkKey}`
  | `shell.commandPalette.${PaletteLabelKey}`
  | `settings.nav.groups.${SettingsGroupKey}`
  | `settings.nav.items.${SettingsItemKey}`;
export type PaletteTranslator = (key: PaletteKey) => string;

/** Every destination for the ⌘K palette: nav pages, settings screens, and "create" shortcuts. */
export type PaletteItem = { href: string; label: string; group: string; icon: NavIcon; keywords?: string; /** Opens in a new tab instead of navigating in the app. */ external?: boolean };

export function paletteItems(t: PaletteTranslator): PaletteItem[] {
  const items: PaletteItem[] = [];
  const pages = t("shell.commandPalette.groupPages");
  for (const section of NAV_SECTIONS) {
    const group = section.labelKey ? t(`shell.nav.${section.labelKey}`) : pages;
    for (const e of section.entries) {
      if (e.kind === "link") items.push({ href: e.href, label: t(`shell.nav.${e.labelKey}`), group, icon: e.icon });
      else for (const c of e.children) items.push({ href: c.href, label: `${t(`shell.nav.${e.labelKey}`)} · ${t(`shell.nav.${c.labelKey}`)}`, group, icon: c.icon });
    }
  }
  for (const e of NAV_FOOTER) {
    if (e.kind === "group") for (const c of e.children) items.push({ href: c.href, label: t(`shell.nav.${c.labelKey}`), group: t(`shell.nav.${e.labelKey}`), icon: c.icon });
  }
  const settings = t("shell.commandPalette.groupSettings");
  for (const g of SETTINGS_NAV) {
    const keywords = t(`settings.nav.groups.${g.labelKey}`);
    for (const s of g.items) {
      if (!s.tabs) items.push({ href: s.href, label: t(`settings.nav.items.${s.labelKey}`), group: settings, icon: s.icon, keywords });
      else for (const tab of s.tabs) items.push({ href: tab.href, label: `${t(`settings.nav.items.${s.labelKey}`)} · ${t(`settings.nav.items.${tab.labelKey}`)}`, group: settings, icon: tab.icon, keywords });
    }
  }
  const create = t("shell.commandPalette.groupCreate");
  items.push(
    { href: "/outreach/campaigns/new", label: t("shell.commandPalette.newEmailCampaign"), group: create, icon: RiMailFill },
    { href: "/linkedin/campaigns/new", label: t("shell.commandPalette.newLinkedinCampaign"), group: create, icon: RiLinkedinBoxFill },
  );
  const help = t("shell.commandPalette.groupHelp");
  for (const l of HELP_LINKS) items.push({ href: l.href, label: t(`shell.help.${l.labelKey}`), group: help, icon: l.icon, external: true });
  return items;
}
