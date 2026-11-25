import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

// Own module on purpose: the max metadata is the only one that knows line types
// (getType() is undefined with the default min metadata), and it is about 145 KB,
// so the rest of the server code that only normalizes a number does not carry it.

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export type PhoneDetails = {
  /** E.164, the only shape people.phone and call_sessions.phone store. */
  e164: string;
  /** A mobile line, or a range the country shares between fixed and mobile lines (all of US and Canada). */
  isMobile: boolean;
};

/**
 * Validates a number against the full metadata and tells its line type. Returns
 * null for anything that is not a valid number, so a caller can tell "valid
 * landline" from "not a number". The default country is explicit on purpose: no
 * environment fallback, so a number without "+" and without a country is not guessed.
 */
export function parsePhoneDetails(input: string, defaultCountry: string | undefined): PhoneDetails | null {
  const trimmed = input?.trim();
  if (!trimmed) return null;
  const country = defaultCountry && COUNTRY_CODE_PATTERN.test(defaultCountry) ? (defaultCountry as CountryCode) : undefined;
  try {
    const parsed = parsePhoneNumberFromString(trimmed, country);
    if (!parsed?.isValid()) return null;
    const type = parsed.getType();
    return { e164: parsed.number, isMobile: type === "MOBILE" || type === "FIXED_LINE_OR_MOBILE" };
  } catch {
    return null;
  }
}
