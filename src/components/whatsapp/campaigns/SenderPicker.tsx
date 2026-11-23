"use client";

import { useTranslations } from "next-intl";
import * as Checkbox from "@/components/alignui/checkbox";
import type { WhatsappAccountSummary } from "@/lib/whatsapp/contract";
import { cn } from "@/utils/cn";

/** The numbers a campaign may send from. Disconnected numbers are listed but cannot be chosen. */
export function SenderPicker({
  accounts,
  selectedIds,
  onChange,
  loading,
  error,
}: {
  accounts: WhatsappAccountSummary[] | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  error?: string | null;
}) {
  const t = useTranslations("whatsappCampaigns.sender");
  if (loading || accounts === null) {
    return <p className="rounded-xl bg-bg-weak-50 p-3 text-paragraph-sm text-text-sub-600">{error ?? t("loading")}</p>;
  }
  if (accounts.length === 0) {
    return (
      <p className="rounded-xl bg-warning-lighter p-3 text-paragraph-sm text-warning-dark">
        {t("empty")}
      </p>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {accounts.map((account) => {
        const checked = selectedIds.includes(account.id);
        const connected = account.status === "connected";
        return (
          <label
            key={account.id}
            className={cn(
              "flex items-center gap-3 rounded-xl p-3 ring-1 ring-inset transition",
              connected ? "cursor-pointer" : "cursor-not-allowed opacity-60",
              checked ? "bg-bg-weak-50 ring-primary-base" : "ring-stroke-soft-200",
              connected && !checked && "hover:bg-bg-weak-50",
            )}
          >
            <Checkbox.Root
              checked={checked}
              disabled={!connected && !checked}
              onCheckedChange={() => onChange(checked ? selectedIds.filter((id) => id !== account.id) : [...selectedIds, account.id])}
            />
            <span className="min-w-0">
              <span className="block truncate text-label-sm text-text-strong-950">{account.name || account.phone || t("unnamed")}</span>
              <span className="block truncate text-paragraph-xs text-text-sub-600">
                {/* account.status is a stable enum value from the API, shown as is. */}
                {account.phone ?? t("noNumber")}
                {!connected ? ` · ${account.status}` : account.warmUpEndsAt ? ` · ${t("warmingUp")}` : ""}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
