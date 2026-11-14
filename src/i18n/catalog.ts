/**
 * The message catalog is split by domain: messages/<locale>/<domain>.json, so
 * several people (or agents) can translate different areas without touching the
 * same file. English is the source of truth: these types come from it, so a
 * component that asks for a key English does not have fails `tsc`.
 *
 * To add a domain, create messages/en/<domain>.json and messages/pt-BR/<domain>.json
 * (each file's top-level keys are the namespaces it owns, and a namespace lives in
 * exactly one file), then add it in the three places below. messages.test.ts fails
 * if a locale is missing the file, an orphan file exists, or a namespace is owned twice.
 */
import type analytics from "../../messages/en/analytics.json";
import type auth from "../../messages/en/auth.json";
import type common from "../../messages/en/common.json";
import type leads from "../../messages/en/leads.json";
import type settings from "../../messages/en/settings.json";
import type shared from "../../messages/en/shared.json";
import type shell from "../../messages/en/shell.json";

type Catalog = {
  analytics: typeof analytics;
  auth: typeof auth;
  common: typeof common;
  leads: typeof leads;
  settings: typeof settings;
  shared: typeof shared;
  shell: typeof shell;
};

/** Same list as Catalog's keys: the loader and the tests walk it. */
export const DOMAINS = ["analytics", "auth", "common", "leads", "settings", "shared", "shell"] as const satisfies readonly (keyof Catalog)[];

export type Domain = (typeof DOMAINS)[number];

// Compile-time check that DOMAINS lists every Catalog key (a forgotten one is an error here).
const _allDomainsListed: Exclude<keyof Catalog, Domain> extends never ? true : false = true;
void _allDomainsListed;

type Intersect<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;

/** Every message, all domains merged: what next-intl sees as `Messages`. */
export type Messages = Intersect<Catalog[keyof Catalog]>;
