import type { Messages } from "./catalog";
import type { Locale } from "./config";

// English is the source of truth: every key a component asks for must exist in
// messages/en/*.json, or `tsc --noEmit` fails. messages.test.ts then holds the
// other languages to the same keys and placeholders.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
