import { safeFrom } from "./safeFrom";

/**
 * Better Auth's email-verification link answers a bad token by redirecting to the
 * sign-up's callbackURL with `?error=<CODE>`. That page is behind sign-in, so the
 * visitor lands on /sign-in with the code buried in `from`
 * ("/analytics?error=TOKEN_EXPIRED"). This takes it out: the code to explain on
 * the sign-in screen, and `from` without it, so the code does not follow the
 * person around after they sign in.
 */
const VERIFY_ERROR_CODES = ["TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND", "INVALID_USER"] as const;

export type VerifyErrorCode = (typeof VERIFY_ERROR_CODES)[number];

export function asVerifyError(value: string | null | undefined): VerifyErrorCode | null {
  return VERIFY_ERROR_CODES.find((code) => code === value) ?? null;
}

/**
 * `from` must already be a same-site path (safeFrom). `error` is the sign-in page's own `?error=`, if any.
 * The path is never parsed as a URL: normalising it ("/.//host" becomes "//host") could turn a
 * same-site path into another site's address. Only the query string is touched, and the result
 * goes through safeFrom again.
 */
export function splitVerifyError(from: string | null, error?: string | null): { from: string | null; code: VerifyErrorCode | null } {
  const direct = asVerifyError(error);
  if (!from) return { from, code: direct };
  const hashAt = from.indexOf("#");
  const hash = hashAt === -1 ? "" : from.slice(hashAt);
  const beforeHash = hashAt === -1 ? from : from.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");
  if (queryAt === -1) return { from, code: direct };
  const query = new URLSearchParams(beforeHash.slice(queryAt + 1));
  const code = asVerifyError(query.get("error"));
  if (!code) return { from, code: direct };
  query.delete("error");
  const rest = query.toString();
  return { from: safeFrom(`${beforeHash.slice(0, queryAt)}${rest ? `?${rest}` : ""}${hash}`), code };
}
