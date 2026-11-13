import type { Locale } from "./config";
import type messages from "../../messages/en.json";

// English is the source of truth: every key a component asks for must exist in
// messages/en.json, or `tsc --noEmit` fails. messages.test.ts then holds the
// other languages to the same keys.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
