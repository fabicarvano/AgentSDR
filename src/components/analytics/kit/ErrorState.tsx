import { RiErrorWarningLine, RiRefreshLine } from "@remixicon/react";
import { useTranslations } from "next-intl";
import * as Button from "@/components/alignui/button";

/**
 * A failed load. Uses the critical status colour with an icon and a message
 * (never colour alone). Props: `message` (default: a translated "could not load"), `onRetry` (renders a Retry button).
 */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useTranslations("analytics.kit.errorState");
  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-2xl bg-bg-white-0 px-6 py-14 text-center ring-1 ring-inset ring-stroke-soft-200">
      <span className="flex size-10 items-center justify-center rounded-full bg-error-lighter text-error-base">
        <RiErrorWarningLine className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-label-md text-text-strong-950">{t("title")}</p>
      <p className="mt-1 max-w-sm text-paragraph-sm text-text-sub-600">{message ?? t("message")}</p>
      {onRetry && (
        <Button.Root variant="neutral" mode="stroke" size="xsmall" className="mt-4" onClick={onRetry}>
          <Button.Icon as={RiRefreshLine} /> {t("retry")}
        </Button.Root>
      )}
    </div>
  );
}
