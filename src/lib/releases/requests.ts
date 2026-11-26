/** Validation of the dismiss request body, kept pure so it can be tested without a server. */

const MAX_VERSION_LENGTH = 64;

export type DismissBody = { ok: true; version: string } | { ok: false };

/** Accepts only `{ version: <non-empty string, at most 64 characters> }`. */
export function parseDismissBody(raw: unknown): DismissBody {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false };
  const version = (raw as Record<string, unknown>).version;
  if (typeof version !== "string" || version.length === 0 || version.length > MAX_VERSION_LENGTH) return { ok: false };
  return { ok: true, version };
}
