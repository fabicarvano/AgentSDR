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

export type JobLevel = "c_level" | "vp" | "director" | "manager" | "coordinator" | "analyst" | "assistant" | "unknown";
export type JobTitleCellResult = { level: JobLevel | null };

const ASSISTANT_WORDS = new Set(["assistente", "assistant", "estagiario", "estagiaria", "intern", "trainee", "auxiliar"]);
const ASSISTANT_CONNECTORS = new Set(["de", "da", "do", "das", "dos", "to", "of", "for", "para", "a", "ao"]);
const VP_WORDS = new Set(["vp", "svp", "evp"]);

// Highest first. "owner", "partner" and "lead" are left out on purpose: "Product Owner",
// "Channel Partner Manager" and "Lead Developer" are not what those words suggest.
const LEVEL_WORDS: Array<[JobLevel, Set<string>]> = [
  [
    "c_level",
    new Set([
      "ceo", "cfo", "cto", "coo", "cmo", "cio", "cro", "cpo", "cso", "cco", "chro", "ciso", "cdo", "chief", "chairman", "presidente", "president", "socio", "socia",
      "fundador", "fundadora", "founder", "cofounder", "cofundador", "cofundadora", "dono", "dona", "proprietario", "proprietaria",
    ]),
  ],
  ["director", new Set(["diretor", "diretora", "director", "superintendente", "superintendent", "head"])],
  ["manager", new Set(["gerente", "gestor", "gestora", "manager"])],
  ["coordinator", new Set(["coordenador", "coordenadora", "coordinator", "supervisor", "supervisora", "lider", "leader"])],
  ["analyst", new Set(["analista", "analyst", "especialista", "specialist"])],
];

/** Reads a job title in Portuguese or English; accents, case and punctuation are ignored. */
export function normalizeJobTitleCell(raw: string): JobTitleCellResult {
  const words = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return { level: null };
  // "Assistente de Diretoria" and "Assistant to the CEO" work for someone: assistant. With no
  // connector after it ("Diretor Assistente", "Assistant Manager"), another level in the title wins.
  const assistantAt = words.findIndex((word) => ASSISTANT_WORDS.has(word));
  if (assistantAt >= 0 && ASSISTANT_CONNECTORS.has(words[assistantAt + 1] ?? "")) return { level: "assistant" };

  // "Vice-presidente" is a VP, so take it out before "presidente" can read as C-level.
  const rest: string[] = [];
  let vp = false;
  for (let i = 0; i < words.length; i++) {
    if (VP_WORDS.has(words[i])) vp = true;
    else if (words[i] === "vice" && (words[i + 1] === "presidente" || words[i + 1] === "president")) {
      vp = true;
      i++;
    } else rest.push(words[i]);
  }

  // The highest level found wins ("Sócio-diretor" is C-level), but a VP outranks all but C-level.
  const found = LEVEL_WORDS.find(([, set]) => rest.some((word) => set.has(word)))?.[0];
  if (found === "c_level") return { level: "c_level" };
  if (vp) return { level: "vp" };
  if (found) return { level: found };
  return { level: assistantAt >= 0 ? "assistant" : "unknown" };
}

/**
 * What the sheet shows for each level. The cell is plain text and the grid cannot
 * translate a value on screen, so the label is stored in Portuguese (the language
 * of the base this serves); `levelCode` keeps the stable English code for filters.
 */
const JOB_LEVEL_LABELS: Record<JobLevel, string> = {
  c_level: "C-level",
  vp: "VP",
  director: "Diretor",
  manager: "Gerente",
  coordinator: "Coordenador/Supervisor",
  analyst: "Analista/Especialista",
  assistant: "Assistente/Estagiário",
  unknown: "Não identificado",
};

export type JobTitleOutputs = { level: string | null; levelCode: JobLevel | null };

export function jobTitleOutputs(raw: string): JobTitleOutputs {
  const { level } = normalizeJobTitleCell(raw);
  return { level: level ? JOB_LEVEL_LABELS[level] : null, levelCode: level };
}
