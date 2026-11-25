import { parsePhoneDetails, type PhoneDetails } from "@/lib/calls/phoneDetails";
import {
  inferCompanyDomainFromEmail,
  normalizeEmail,
  publicSlugFromSourceIdentifier,
} from "@/lib/leads/identity";
import { normalizeDomainForTargeting } from "@/lib/qualification/domain";

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

export type NameCellResult = { firstName: string | null; lastName: string | null };

/** The first word is the first name; everything after it is the last name ("Maria da Silva" -> "da Silva"). */
export function normalizeNameCell(raw: string): NameCellResult {
  const [first, ...rest] = raw.trim().split(/\s+/);
  return { firstName: first || null, lastName: rest.join(" ") || null };
}

export type CnpjCellResult = { cnpj: string | null; isValid: boolean; isHeadquarters: boolean | null };

function cnpjCheckDigit(digits: string): number {
  // Weights run 2..9 from the right, wrapping; the 13th digit uses 12 digits, the 14th uses 13.
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/**
 * Digits only, check digits verified, and headquarters (order block `0001`) told from a branch.
 * A number cell lost its leading zeros on import, so it is padded back to 14; a text cell is not.
 */
export function normalizeCnpjCell(raw: string | number): CnpjCellResult {
  const invalid: CnpjCellResult = { cnpj: null, isValid: false, isHeadquarters: null };
  const digits = typeof raw === "number" ? String(raw).padStart(14, "0") : raw.replace(/\D/g, "");
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return invalid;
  const first = cnpjCheckDigit(digits.slice(0, 12));
  const second = cnpjCheckDigit(digits.slice(0, 12) + first);
  if (digits.slice(12) !== `${first}${second}`) return invalid;
  return { cnpj: digits, isValid: true, isHeadquarters: digits.slice(8, 12) === "0001" };
}
