"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { API_ERROR_CODES } from "@/lib/http/apiErrors";

// An Error carries the English sentence in `message`; a parsed response body, in `error`.
type Coded = { code?: unknown; params?: unknown; message?: unknown; error?: unknown };

/**
 * The words for a failed request, in the interface language. A route's error carries a stable `code` (and the values
 * its sentence mentions, `params`); `apiErrors.<code>` in the catalog has the message. Without a code the catalog
 * does not know, it shows the server's English message, then `fallback` (a translated generic line).
 * Add a code to `ApiErrorCode` (src/lib/http/apiErrors.ts) and to messages/<locale>/apiErrors.json to translate it.
 */
export function useApiErrorText(): (cause: unknown, fallback: string) => string {
  const t = useTranslations("apiErrors");
  // Stable between renders, so it can sit in a hook's dependency list.
  return useCallback(
    (cause, fallback) => {
      const error = (cause && typeof cause === "object" ? cause : {}) as Coded;
      // `code` is any string at runtime: only the ones in API_ERROR_CODES are translated (not "constructor" or "a.b").
      if (typeof error.code === "string" && (API_ERROR_CODES as readonly string[]).includes(error.code) && t.has(error.code as never)) {
        const params = error.params && typeof error.params === "object" ? (error.params as Record<string, string | number>) : undefined;
        try {
          return t(error.code as never, params as never);
        } catch {
          // A route that left out a value the sentence needs: the server's own message is still right.
        }
      }
      const english = typeof error.message === "string" && error.message ? error.message : error.error;
      return typeof english === "string" && english ? english : fallback;
    },
    [t],
  );
}
