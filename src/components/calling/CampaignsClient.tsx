"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/page/PageHeader";
import { AiCampaignsSection } from "@/components/calling/ai/AiCampaignsSection";

/**
 * The Call campaigns page: AI agent campaigns only. Rep campaigns (a list a
 * rep worked through by hand) were taken out of the product on 2 Nov 2026 —
 * a rep now talks to a lead with "Call now" in an AI campaign's lead drawer.
 * Existing rep campaigns keep their data, and their pages still open from old
 * links (/calling/campaigns/:id); nothing lists or creates them any more.
 */
export default function CampaignsClient() {
  const t = useTranslations("callingMain.campaigns");
  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <AiCampaignsSection />
    </div>
  );
}
