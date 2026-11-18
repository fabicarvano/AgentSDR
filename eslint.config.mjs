import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import i18next from "eslint-plugin-i18next";

/**
 * Files whose interface text now lives in messages/<locale>/*.json (see
 * messages/CONVENTIONS.md). English typed straight into these is a lint error, so
 * a translated screen cannot quietly slip back. When you finish translating a file,
 * add it here; a whole folder once every file in it is done.
 */
const TRANSLATED = [
  "src/app/sign-in/**/*.tsx",
  "src/components/outreach/**/*.tsx",
  "src/components/campaigns/**/*.tsx",
  "src/app/campaigns/**/*.tsx",
  "src/app/outreach/campaigns/**/*.tsx",
  "src/app/settings/appearance/**/*.tsx",
  "src/components/auth/AuthShell.tsx",
  "src/components/auth/fields.tsx",
  "src/components/auth/GoogleButton.tsx",
  "src/components/i18n/**/*.tsx",
  "src/components/settings/AppearanceSettings.tsx",
  "src/components/theme/ThemeSwitch.tsx",
  "src/components/Filters.tsx",
  "src/components/ExportModal.tsx",
  "src/components/DomainsTable.tsx",
  "src/components/AppFilter.tsx",
  "src/components/CategoryFilter.tsx",
  "src/components/alignui/**/*.tsx",
  "src/app/sign-up/**/*.tsx",
  "src/app/forgot-password/**/*.tsx",
  "src/app/reset-password/**/*.tsx",
  "src/app/setup/**/*.tsx",
  "src/app/onboarding/**/*.tsx",
  "src/app/accept-invitation/**/*.tsx",
  "src/app/oauth/**/*.tsx",
  "src/app/unsubscribe/**/*.tsx",
  "src/app/login/**/*.tsx",
  "src/components/auth/AuthShowcase.tsx",
  "src/components/auth/SessionGate.tsx",
  "src/components/Sidebar.tsx",
  "src/components/AppShell.tsx",
  "src/components/NavigationProvider.tsx",
  "src/components/DialogProvider.tsx",
  "src/components/TableLoadingOverlay.tsx",
  "src/components/TableSkeleton.tsx",
  "src/components/nav/**/*.tsx",
  "src/components/page/**/*.tsx",
  // ui/responsive-hero-banner.tsx is left out on purpose: an unused marketing hero (see its header comment).
  "src/components/ui/ActionsMenu.tsx",
  "src/components/ui/Badge.tsx",
  "src/components/ui/Select.tsx",
  "src/components/ui/StatCard.tsx",
  "src/components/ui/Tabs.tsx",
  "src/components/brand/**/*.tsx",
  "src/components/demo/**/*.tsx",
  "src/components/theme/ThemeProvider.tsx",
  "src/app/page.tsx",
  "src/app/loading.tsx",
  "src/app/settings/layout.tsx",
  "src/components/settings/SettingsShell.tsx",
  "src/components/leads/**/*.tsx",
  "src/app/leads/**/*.tsx",
  "src/app/domains/**/*.tsx",
  "src/app/analytics/**/*.tsx",
  "src/components/analytics/**/*.tsx",
  // Batch C: the Settings screens. HostedAuth.tsx (LinkedIn, being changed by the Unipile v2 work) and the
  // calling/CRM files not listed here belong to later batches.
  "src/app/settings/**/*.tsx",
  "src/components/settings/**/*.tsx",
  "src/components/outreach/WorkingHoursModal.tsx",
  "src/components/outreach/MailboxesPageClient.tsx",
  "src/components/outreach/AddMailboxButton.tsx",
  "src/components/linkedin/AccountsClient.tsx",
  "src/components/whatsapp/WhatsappAccountsClient.tsx",
  "src/components/ai/ByokSettingsClient.tsx",
  "src/components/crm/CrmKnowledgeClient.tsx",
  "src/components/crm/CrmAiInstructions.tsx",
  "src/components/crm/CrmSettingsClient.tsx",
  "src/components/calling/ai/StationHoursEditor.tsx",
  // Batch D: the CRM and the Inbox.
  "src/components/crm/**/*.tsx",
  "src/components/inbox/**/*.tsx",
  "src/app/crm/**/*.tsx",
  "src/app/@modal/(.)crm/**/*.tsx",
  "src/app/outreach/inbox/**/*.tsx",
  "src/app/outreach/tasks/**/*.tsx",
  "src/app/outreach/notes/**/*.tsx",
];

/**
 * Options of i18next/no-literal-string: JSX text and the attributes a person reads or
 * hears. Shared by the rule applied to TRANSLATED files below and by the census
 * (scripts/check-i18n-literals.ts), so both agree on what counts as "text typed straight
 * into a component".
 *
 * The plugin's options replace its defaults rather than extending them, so the defaults
 * that still matter are repeated: numbers/punctuation, ALL_CAPS constants, and the
 * translator functions (t, but also tc/tl/te… when a component opens more than one namespace).
 */
export const literalStringOptions = {
  mode: "jsx-only",
  "jsx-attributes": { include: ["placeholder", "title", "aria-label", "alt", "label", "description", "hint", "subtitle", "tooltip"] },
  // Also not words: typographic symbols used as separators and icons-in-text, and brand names.
  words: { exclude: ["[0-9!-/:-@[-`{-~]+", "[A-Z_-]+", "[—–›‹…×·•→←↑↓✓✕⌘⌥⇧⏎↳]+", "AgentSDR", "Google", "WhatsApp", "⌘K", "⌘⏎ / Ctrl\\+Enter", "https?://\\S*", "_blank", "noopener noreferrer"] },
  callees: {
    // `t.rich(...)` and `t.has(...)` are the same translator, as a member call.
    exclude: ["i18n(ext)?", "t[a-z]?", "t[a-z]?\\.(rich|has|raw|markup)", "t[A-Z][A-Za-z]*", "t[A-Z][A-Za-z]*\\.(rich|has|raw|markup)", "ruleText", "channelIcon", "require", "addEventListener", "removeEventListener", "postMessage", "getElementById", "dispatch", "commit", "includes", "indexOf", "endsWith", "startsWith"],
  },
};

/**
 * The same rule on EVERY component file, for `bun run i18n:literals`. Plain `eslint` does not
 * use it (it would flag the screens that are still waiting for their translation batch).
 */
export const literalCensusConfig = [
  {
    files: ["src/**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    plugins: { i18next },
    rules: { "i18next/no-literal-string": ["error", literalStringOptions] },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // scripts/*.js are the historical CommonJS migrations, run with plain
    // `node`. They are the record of how the schema was built and are not
    // rewritten; new scripts are TypeScript (see CLAUDE.md).
    files: ["scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // No user-facing English left in the files listed in TRANSLATED: JSX text and
    // the attributes a person reads or hears. Brand names are allowed.
    files: TRANSLATED,
    plugins: { i18next },
    rules: { "i18next/no-literal-string": ["error", literalStringOptions] },
  },
]);

export default eslintConfig;
