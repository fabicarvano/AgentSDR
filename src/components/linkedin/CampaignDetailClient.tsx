"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  RiBarChart2Line,
  RiHourglassLine,
  RiListOrdered2,
  RiLoader4Line,
  RiPauseCircleLine,
  RiPencilLine,
  RiPlayCircleLine,
  RiLoopRightLine,
  RiTeamLine,
  RiTimeLine,
  RiUserVoiceLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import { useDialogs } from "@/components/DialogProvider";
import { LinkedInAccountAvatars } from "@/components/linkedin/LinkedInAccountTag";
import { LinkedInSequenceEditor } from "@/components/linkedin/LinkedInSequenceEditor";
import { CampaignLeadsTab, type InitialLeadsPage } from "@/components/linkedin/campaigns/CampaignLeadsTab";
import { CampaignOverview, type ChartDay } from "@/components/linkedin/campaigns/CampaignOverview";
import { EditCampaignModal } from "@/components/linkedin/campaigns/EditCampaignModal";
import { CAMPAIGN_STATUS, campaignFunnel } from "@/components/linkedin/campaigns/metrics";
import { PageHeader } from "@/components/page/PageHeader";
import { PageTabs } from "@/components/page/PageTabs";
import { StatRow } from "@/components/page/StatRow";
import { cn } from "@/utils/cn";

export type { CampaignLead } from "@/components/linkedin/campaigns/CampaignLeadsTab";

type LinkedInAccount = { id: string; username: string; name: string | null; profilePictureUrl: string | null };

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED";
  type: "REGULAR" | "PERSONAL";
  invitationMessage: string | null;
  acceptanceMessage: string | null;
  followUp1Message: string | null;
  followUp2Message: string | null;
  followUp3Message: string | null;
  accounts: LinkedInAccount[];
  totalLeads: number;
  statusCounts: Record<string, number>;
  createdAt: string;
};

type TabId = "overview" | "leads" | "sequence";

function sequenceStepsBuilt(campaign: Pick<Campaign, "invitationMessage" | "acceptanceMessage" | "followUp1Message" | "followUp2Message" | "followUp3Message">) {
  return [
    campaign.invitationMessage,
    campaign.acceptanceMessage,
    campaign.followUp1Message,
    campaign.followUp2Message,
    campaign.followUp3Message,
  ].filter(Boolean).length;
}

export function CampaignDetailClient({
  campaign: initial,
  initialLeadsPage,
  accounts,
}: {
  campaign: Campaign;
  initialLeadsPage: InitialLeadsPage;
  accounts: LinkedInAccount[];
}) {
  const t = useTranslations("linkedinCampaigns.detail");
  const format = useFormatter();
  const router = useRouter();
  const dialogs = useDialogs();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  // The tab lives in the URL (?tab=leads), so a link or a reload lands on it.
  const [tab, setTabState] = useState<TabId>(tabParam === "leads" || tabParam === "sequence" ? tabParam : "overview");
  const setTab = (next: TabId) => {
    setTabState(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const [campaign, setCampaign] = useState(initial);
  const [showEditCampaign, setShowEditCampaign] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [chartData, setChartData] = useState<ChartDay[] | null>(null);

  useEffect(() => {
    // The server can refresh this prop after an edit; keep the local editable copy in sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCampaign(initial);
  }, [initial]);

  useEffect(() => {
    fetch(`/api/linkedin/campaigns/${campaign.id}/chart-data`)
      .then((r) => r.json())
      .then((d) => setChartData(d.ok ? d.data : []))
      .catch(() => setChartData([]));
  }, [campaign.id]);

  const funnel = useMemo(() => campaignFunnel(campaign.statusCounts, campaign.totalLeads), [campaign.statusCounts, campaign.totalLeads]);
  const senderOptions = campaign.accounts.length > 0 ? campaign.accounts : accounts;
  const status = CAMPAIGN_STATUS[campaign.status];
  const steps = sequenceStepsBuilt(campaign);
  const createdDate = format.dateTime(new Date(campaign.createdAt), { month: "short", day: "numeric", year: "numeric" });

  async function toggleStatus() {
    const next = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setToggling(true);
    try {
      const res = await fetch(`/api/linkedin/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error ?? t("genericError"));
      setCampaign((prev) => ({ ...prev, status: next }));
      router.refresh();
    } catch (cause) {
      await dialogs.alert({
        title: next === "PAUSED" ? t("pauseFailedTitle") : t("resumeFailedTitle"),
        description: cause instanceof Error ? cause.message : t("genericError"),
        variant: "error",
      });
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        back={{ href: "/linkedin/campaigns", label: t("backLabel") }}
        title={campaign.name}
        badge={
          <>
            <Badge.Root size="medium" variant="lighter" color={status.color}>
              <Badge.Dot />
              {campaign.status === "ACTIVE" ? t("statusActive") : t("statusPaused")}
            </Badge.Root>
            {campaign.type === "PERSONAL" && (
              <Badge.Root size="medium" variant="lighter" color="yellow">{t("personal")}</Badge.Root>
            )}
          </>
        }
        description={<span suppressHydrationWarning>{campaign.description ? t("subtitleWithDescription", { date: createdDate, steps, description: campaign.description }) : t("subtitle", { date: createdDate, steps })}</span>}
        actions={
          <>
            <span className="mr-1 hidden sm:inline-flex">
              <LinkedInAccountAvatars accounts={campaign.accounts} maxVisible={4} />
            </span>
            <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => setShowEditCampaign(true)}>
              <Button.Icon as={RiPencilLine} />
              {t("edit")}
            </Button.Root>
            <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => void toggleStatus()} disabled={toggling}>
              <Button.Icon
                as={toggling ? RiLoader4Line : campaign.status === "ACTIVE" ? RiPauseCircleLine : RiPlayCircleLine}
                className={cn(toggling && "animate-spin")}
              />
              {campaign.status === "ACTIVE" ? t("pause") : t("resume")}
            </Button.Root>
          </>
        }
      />

      <StatRow
        className="mt-5"
        items={[
          { label: t("statNotInvited"), value: format.number(funnel.queued), icon: RiTimeLine, hint: t("statNotInvitedHint") },
          { label: t("statAwaiting"), value: format.number(funnel.awaiting), icon: RiHourglassLine, hint: t("statAwaitingHint") },
          { label: t("statInSequence"), value: format.number(funnel.inSequence), icon: RiLoopRightLine, hint: t("statInSequenceHint") },
          { label: t("statSenders"), value: format.number(campaign.accounts.length), icon: RiUserVoiceLine, hint: campaign.accounts.map((a) => a.name ?? a.username).join(", ") || t("noSenders") },
        ]}
      />

      <PageTabs
        className="mt-6"
        label={t("tabsLabel")}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: t("tabOverview"), icon: RiBarChart2Line },
          { value: "leads", label: t("tabLeads"), icon: RiTeamLine, count: campaign.totalLeads },
          { value: "sequence", label: t("tabSequence"), icon: RiListOrdered2, count: steps },
        ]}
      />

      {/* Leads and Sequence stay mounted when hidden, so filters, selection and
          unsaved sequence edits survive a trip to another tab. */}
      <div role="tabpanel" className="mt-6">
        {tab === "overview" && <CampaignOverview funnel={funnel} statusCounts={campaign.statusCounts} chartData={chartData} />}
        <div hidden={tab !== "leads"}>
          <CampaignLeadsTab
            campaignId={campaign.id}
            campaignName={campaign.name}
            totalLeads={campaign.totalLeads}
            statusCounts={campaign.statusCounts}
            senderOptions={senderOptions}
            initialLeadsPage={initialLeadsPage}
            onLeadRemoved={(removedStatus) =>
              setCampaign((prev) => ({
                ...prev,
                totalLeads: prev.totalLeads - 1,
                statusCounts: { ...prev.statusCounts, [removedStatus]: Math.max(0, (prev.statusCounts[removedStatus] ?? 1) - 1) },
              }))
            }
            onChanged={() => router.refresh()}
          />
        </div>
        <div hidden={tab !== "sequence"}>
          <LinkedInSequenceEditor
            campaignId={campaign.id}
            initialSequence={campaign}
            onSaved={(sequence) => setCampaign((current) => ({ ...current, ...sequence }))}
          />
        </div>
      </div>

      <EditCampaignModal
        campaign={campaign}
        accounts={accounts}
        open={showEditCampaign}
        onOpenChange={setShowEditCampaign}
        onSaved={(updated) => {
          setCampaign((prev) => ({ ...prev, ...updated }));
          setShowEditCampaign(false);
        }}
      />
    </div>
  );
}
