# Translating the interface (next-intl)

English is the source of truth. Every user-visible string lives in `messages/en/<domain>.json`
with its Brazilian Portuguese twin in `messages/pt-BR/<domain>.json`. Components never contain
user-facing English: they ask for a key. Read `GLOSSARY.md` before you translate anything.

## Files and keys

- One file per domain (`src/i18n/catalog.ts` lists them). A top-level key (a *namespace*) lives in exactly one file.
- Key path = `<area>.<component or page>.<what it says>`, camelCase, e.g. `shell.sidebar.helpMenu.reportBug`.
- Add the key to **both** `messages/en/…` and `messages/pt-BR/…`, same path. `bun test src/i18n` fails on a missing key,
  a lost placeholder, an empty value, invalid ICU, or a pt-BR value identical to the English one (more than two words).
- Keep both files in the same key order. Do not reformat or reorder lines you did not touch.
- Do not edit a domain file you were not assigned: other people are editing them at the same time.

## In components

```tsx
// client component
const t = useTranslations("shell.sidebar");
<button aria-label={t("collapse")}>{t("title")}</button>

// server component / generateMetadata
const t = await getTranslations("settings.appearance");
```

- Translate everything a person can read or hear: JSX text, `placeholder`, `title`, `aria-label`, `alt`, tooltips,
  empty states, confirm dialogs, toasts, validation messages, `<title>` / metadata.
- A sentence is one message. Never build a sentence from pieces (`"You have " + n + " leads"`), and never split one across keys:
  word order differs between languages. Use placeholders: `"{count} selected"`.
- **Plurals** use ICU, never `n === 1 ? "" : "s"`:
  `"{count, plural, one {# lead} other {# leads}}"`, called as `t("leads", { count })`. Portuguese uses `one` for 0 and 1.
- **Links or bold inside a sentence**: rich text. `"Need access? <link>Ask your admin</link>"` and
  `t.rich("needAccess", { link: (chunks) => <Link href="…">{chunks}</Link> })`. Tags must match between languages.
- **Labels held in data** (arrays in `.ts` files such as nav configs) cannot call hooks. Store a typed key, not the text:
  `{ href: "/leads", labelKey: "leads" }`, with `labelKey: keyof Messages["shell"]["nav"]` (`import type { Messages } from "@/i18n/catalog"`),
  and call `t(item.labelKey)` where it renders. The same goes for enum-like values (stages, statuses): keep the code stable,
  map it to a label key, and never store translated text in the database.
- **Numbers, dates, relative time**: `useFormatter()` (`format.number`, `format.dateTime`, `format.relativeTime`), or
  `new Intl.NumberFormat(locale)` outside React. Never hardcode `"en-US"` in `toLocaleString`.
  `moment`: use `momentIn(locale, value)` from `@/i18n/moment`, never `moment.locale()` (it is global and shared between requests).
- **Better Auth errors**: `const authError = useAuthError()` then `authError(err, t("errors.generic"))`. It uses `auth.errors.<CODE>` when the
  code is translated and falls back to the server's English message. Add new codes there when a screen can show them.
- `ICU` special characters: a literal `{`, `}` or `<` needs quoting (`'{'`). An apostrophe before a letter is fine ("isn't").

## What stays in English

- Product and brand names: AgentSDR, LinkedIn, WhatsApp, Gmail, Google Workspace, Unipile, OpenRouter, Cloudflare R2, Apollo, Hunter, Lusha,
  Findymail, ZeroBounce, Resend, Langfuse, Cal.com, GoLogin, CloakBrowser, Playwright, MCP, OAuth, API.
- Code, identifiers, enum values, URLs, email addresses, file names, keyboard shortcuts (`⌘K`), CSS classes, field names sent to an API.
- Server-side text that is not rendered through these catalogs yet (API error strings, `lib/` messages). They are a later batch;
  do not translate them in a component by pattern-matching on the English text.
- The access-request mailto in `SignInForm.tsx` (it is written to the AgentSDR team, who read English).

When something is left in English on purpose, leave a one-line comment in the code saying why.

## Style (pt-BR)

- Address the person as **você**. No gender-exclusive forms when a neutral wording exists.
- Sentence case like the English. Button labels are short verbs in the infinitive ("Salvar", "Cancelar", "Entrar") with no final period.
  Full sentences keep their period.
- "e-mail" (hyphen), "senha", "espaço de trabalho". Typographic quotes “ ” where the English uses quotes.
- Portuguese runs 20–30% longer than English: prefer the shorter natural wording on buttons, tabs and table headers so the layout holds.
- Do not translate word by word. Say what a Brazilian sales or ops person would say.

## Checks before you hand a batch back

```bash
docker run --rm -v /opt/AgentSDR:/app -w /app oven/bun:1.3.14-alpine sh -c 'bunx tsc --noEmit && bun test --conditions=react-server src/i18n && bunx eslint <the files you changed>'
```

`tsc` proves every key exists in English. The lint rule `i18next/no-literal-string` (configured in `eslint.config.mjs`) flags English text
left in the files already migrated; add your files to its list when they are done.
