"use client";

import { useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, isLocale } from "@/i18n/config";
import { cn } from "@/utils/cn";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const STYLES = {
  /** Inside the app, on the theme's tokens. */
  app: "h-9 w-full rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3 text-paragraph-sm text-text-strong-950 outline-none transition hover:border-stroke-sub-300 focus-visible:ring-2 focus-visible:ring-primary-base disabled:opacity-60",
  /** On the auth pages' fixed dark background, which does not follow the theme. */
  auth: "h-8 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 text-xs text-zinc-200 outline-none transition hover:border-white/20 focus-visible:ring-2 focus-visible:ring-[#335cff]/50 disabled:opacity-60",
} as const;

/**
 * Picks the interface language. The choice is a cookie on this browser (read
 * by src/i18n/request.ts on the next render), so it needs no server action,
 * no sign-in and no database: the sign-in page can offer it too.
 */
export function LanguageSwitcher({ variant = "app", className }: { variant?: keyof typeof STYLES; className?: string }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (!isLocale(next) || next === locale) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
    startTransition(() => router.refresh());
  }

  return (
    <select aria-label={t("switcherLabel")} value={locale} onChange={change} disabled={pending} className={cn(STYLES[variant], className)}>
      {LOCALES.map((code) => (
        <option key={code} value={code} lang={code}>
          {LOCALE_NAMES[code]}
        </option>
      ))}
    </select>
  );
}
