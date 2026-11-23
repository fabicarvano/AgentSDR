/**
 * Errors a route sends to the interface: `{ error, code?, params? }`.
 *
 * `error` is the English sentence and stays exactly what API clients, MCP and the logs have always received.
 * `code` (and the values the sentence mentions, `params`) lets the interface show its own wording: the catalog
 * domain `apiErrors` has one message per code, read by `useApiErrorText` (src/i18n). A route with no code, or a
 * code the catalog does not know, still shows `error`. Client-safe: no server imports.
 *
 * Do not add a code to /api/v1, /api/mcp, webhooks or the call worker: those clients read the English.
 */

/**
 * Codes the catalog (`apiErrors`) has text for. A new one needs its message in both languages. The codes that already
 * existed are UPPER_SNAKE and keep that spelling; new ones are camelCase. Codes the catalog does not list (NOT_FOUND,
 * VALIDATION_ERROR, INVALID_TRANSITION, PLATFORM_NOT_CONNECTED) show the server's English message.
 */
export const API_ERROR_CODES = [
  // Who is calling (AuthContextError, CrmRequestError, crm/api.ts): these were already sent as `code`.
  "UNAUTHENTICATED",
  "NO_ACTIVE_ORGANIZATION",
  "NOT_A_MEMBER",
  "FORBIDDEN",
  "INVALID_ORIGIN",
  "INVALID_IDEMPOTENCY_KEY",
  "STALE_CONTEXT",
  // Request shape and lookups shared by many routes.
  "invalidJson",
  "invalidBody",
  "notFound",
  "campaignNotFound",
  "leadNotFound",
  "missingIds",
  "unsupportedColumnType",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorParams = Record<string, string | number>;

export type ApiErrorBody = { error: string; code?: string; params?: ApiErrorParams };

export function apiErrorBody(code: ApiErrorCode, message: string, params?: ApiErrorParams): ApiErrorBody {
  return params ? { error: message, code, params } : { error: message, code };
}

/** The JSON response of a coded error. */
export function apiError(status: number, code: ApiErrorCode, message: string, params?: ApiErrorParams): Response {
  return Response.json(apiErrorBody(code, message, params), { status });
}

/** What a client throws for a failed request: the English `message` as ever, plus the code and values. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly params: ApiErrorParams | undefined;
  constructor(message: string, status: number, code?: string, params?: ApiErrorParams) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

/** `{ code, params }` of a parsed error body, when it has them. */
export function readApiErrorBody(body: unknown): { code?: string; params?: ApiErrorParams } {
  if (!body || typeof body !== "object") return {};
  const { code, params } = body as { code?: unknown; params?: unknown };
  return {
    code: typeof code === "string" ? code : undefined,
    params: params && typeof params === "object" ? (params as ApiErrorParams) : undefined,
  };
}
