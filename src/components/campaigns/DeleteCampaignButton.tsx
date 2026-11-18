"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useDialogs } from "@/components/DialogProvider";

export default function DeleteCampaignButton({ campaignId }: { campaignId: string }) {
  const t = useTranslations("emailCampaigns.legacyDelete");
  const dialogs = useDialogs();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    const confirmed = await dialogs.confirm({
      title: t("confirmTitle"),
      description: t("confirmDescription"),
      confirmLabel: t("confirmLabel"),
      variant: "error",
    });
    if (!confirmed) return;

    setDeleting(true);
    const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
    if (!res.ok) {
      setDeleting(false);
      await dialogs.alert({
        title: t("errorTitle"),
        description: t("errorDescription"),
        variant: "error",
      });
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="h-8 px-3 text-xs font-semibold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/15 disabled:opacity-60"
    >
      {deleting ? t("deleting") : t("delete")}
    </button>
  );
}
