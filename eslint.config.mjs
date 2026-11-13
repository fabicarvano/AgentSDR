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
  "src/app/settings/appearance/**/*.tsx",
  "src/components/auth/AuthShell.tsx",
  "src/components/auth/fields.tsx",
  "src/components/auth/GoogleButton.tsx",
  "src/components/i18n/**/*.tsx",
  "src/components/settings/AppearanceSettings.tsx",
  "src/components/theme/ThemeSwitch.tsx",
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
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": { include: ["placeholder", "title", "aria-label", "alt", "label", "description", "hint", "subtitle", "tooltip"] },
          // Options replace the plugin's defaults rather than extending them, so the
          // defaults that still matter are repeated: numbers/punctuation, ALL_CAPS
          // constants, and the translator functions (t, but also tc/tl/te… when a
          // component opens more than one namespace).
          words: { exclude: ["[0-9!-/:-@[-`{-~]+", "[A-Z_-]+", "AgentSDR", "Google", "⌘K"] },
          callees: {
            exclude: ["i18n(ext)?", "t[a-z]?", "require", "addEventListener", "removeEventListener", "postMessage", "getElementById", "dispatch", "commit", "includes", "indexOf", "endsWith", "startsWith"],
          },
        },
      ],
    },
  },
]);

export default eslintConfig;
