"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

type AuthError = { code?: string | null; message?: string | null } | null | undefined;

/**
 * Better Auth answers with a stable `code` and an English `message` written on the
 * server. Returns a function that shows our translation when auth.errors has the
 * code, else the server's own message, else `fallback` (a translated generic line).
 * Add a code to messages/<locale>/auth.json under `auth.errors` to translate it.
 */
export function useAuthError() {
  const t = useTranslations("auth.errors");
  // Stable across renders (as `t` is), so it can sit in a hook's dependency list.
  return useCallback(
    (error: AuthError, fallback: string): string => {
      const code = error?.code;
      // `code` is any string at runtime; `has` is what says whether it is one we translate.
      if (code && t.has(code as never)) return t(code as never);
      return error?.message || fallback;
    },
    [t],
  );
}
