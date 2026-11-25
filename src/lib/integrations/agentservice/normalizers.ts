import { parsePhoneDetails, type PhoneDetails } from "@/lib/calls/phoneDetails";
import {
  inferCompanyDomainFromEmail,
  normalizeEmail,
  publicSlugFromSourceIdentifier,
} from "@/lib/leads/identity";
import { normalizeDomainForTargeting } from "@/lib/leads/domain";

/**
 * The pure rules behind the AgentService actions. No I/O: the handlers in
 * actions.ts read the organization's phone country and pass it in, so these
 * stay testable and are the one place the grid cleans a value the same way the
 * rest of the app does (people.phone, people.email, company domains).
 */

// A cell often holds several numbers: "(21) 98654-5481 / (21) 3333-4444", "a; b", "a ou b".
const PHONE_SEPARATOR = /[/;|,\n]+|\s+(?:ou|e|or)\s+/i;

export type PhoneCellResult = {
  phone: string | null;
  isValid: boolean;
  isMobile: boolean | null;
  secondPhone: string | null;
};

/** Accepts the text a cell holds or the number a spreadsheet import read it as. */
export function normalizePhoneCell(raw: string | number, defaultCountry: string | undefined): PhoneCellResult {
  const text = typeof raw === "number" ? String(raw) : raw;
  const found: PhoneDetails[] = [];
  for (const candidate of text.split(PHONE_SEPARATOR)) {
    const details = parsePhoneDetails(candidate, defaultCountry);
    if (details && !found.some((existing) => existing.e164 === details.e164)) found.push(details);
  }
  const [first, second] = found;
  return {
    phone: first?.e164 ?? null,
    isValid: Boolean(first),
    isMobile: first ? first.isMobile : null,
    secondPhone: second?.e164 ?? null,
  };
}

// An address inside other text: "Ada <ada@acme.com>", "mailto:ada@acme.com", "ada@acme.com."
const EMAIL_IN_TEXT = /[^\s<>()[\]",;:]+@[^\s<>()[\]",;:]+\.[^\s<>()[\]",;:]+/;

function extractEmail(raw: string): string | null {
  const match = raw.match(EMAIL_IN_TEXT)?.[0].replace(/\.+$/, "");
  return match ? normalizeEmail(match) : null;
}

// Personal mailbox providers, Brazilian ones included. Kept here, not in the lead
// identity code, so widening it never changes how leads are matched and deduplicated.
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com",
  "outlook.com.br", "hotmail.com.br", "live.com.br", "yahoo.com.br",
  "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br", "globo.com", "globomail.com",
  "r7.com", "oi.com.br", "zipmail.com.br",
]);

function isPersonalEmailAddress(email: string): boolean {
  const domain = email.split("@")[1];
  return domain !== undefined && PERSONAL_EMAIL_DOMAINS.has(domain);
}

export type EmailCellResult = {
  email: string | null;
  isValid: boolean;
  isPersonal: boolean | null;
};

export function normalizeEmailCell(raw: string): EmailCellResult {
  const email = extractEmail(raw);
  return {
    email,
    isValid: Boolean(email),
    isPersonal: email ? isPersonalEmailAddress(email) : null,
  };
}

const HOSTNAME = /^[\p{L}\p{N}-]+(\.[\p{L}\p{N}-]+)+$/u;

/** The site's host without scheme, path, port or "www." — the same key the lead identity uses. */
export function siteDomain(raw: string): string | null {
  const domain = normalizeDomainForTargeting(raw);
  return HOSTNAME.test(domain) ? domain : null;
}

/** The company domain behind a work address; empty for Gmail, Outlook and the like. */
export function companyDomainFromEmail(raw: string): string | null {
  const email = extractEmail(raw);
  return email && !isPersonalEmailAddress(email) ? inferCompanyDomainFromEmail(email) : null;
}

export type LinkedinCellResult = {
  slug: string | null;
  profileUrl: string | null;
};

/** The public profile slug. Opaque member ids and Sales Navigator links have none and come back empty. */
export function normalizeLinkedinCell(raw: string): LinkedinCellResult {
  const slug = publicSlugFromSourceIdentifier(raw);
  return {
    slug,
    profileUrl: slug ? `https://www.linkedin.com/in/${encodeURIComponent(slug)}` : null,
  };
}
