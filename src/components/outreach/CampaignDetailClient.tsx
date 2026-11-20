"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  RiBarChart2Line,
  RiListOrdered2,
  RiMailSendLine,
  RiPauseCircleLine,
  RiPlayCircleLine,
  RiStackLine,
  RiTeamLine,
  RiUserAddLine,
  RiTimeLine,
} from "@remixicon/react";

import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import { PageContainer, PageHeader } from "@/components/page/PageHeader";
import { PageTabs } from "@/components/page/PageTabs";
import { StatRow } from "@/components/page/StatRow";
import AnalyticsTab from "./AnalyticsTab";
import LeadsTab from "./LeadsTab";
import SequenceTab from "./SequenceTab";
import type { outreachCampaigns, mailboxes } from "@/lib/outreach/schema";
import type { LeadPage, DailySends, CampaignPulse } from "@/lib/outreach/campaigns";
import type { Messages } from "@/i18n/catalog";

type Campaign = typeof outreachCampaigns.$inferSelect;
type Mailbox = typeof mailboxes.$inferSelect;
type Stats = {
  totalLeads: number;
  pending: number;
  inSequence: number;
  replied: number;
  completed: number;
  bounced: number;
  suppressed: number;
  emailsSent: number;
  emailsScheduled: number;
  emailsFailed: number;
  emailsTotal: number;
  contacted: number;
};
type StepBreakdown = { stepNumber: number; sent: number }[];

type StatusKey = keyof Messages["emailCampaigns"]["status"];

// Record<StatusKey, …> fails to compile when a status gets a label but no colour.
const STATUS_COLOR: Record<StatusKey, React.ComponentProps<typeof Badge.Root>["color"]> = {
  active: "green",
  paused: "orange",
  draft: "gray",
  completed: "purple",
};

const isStatusKey = (status: string): status is StatusKey => status in STATUS_COLOR;

type TabId = "analytics" | "leads" | "sequence";

type Translator = ReturnType<typeof useTranslations<"emailCampaigns.detail">>;
type Formatter = ReturnType<typeof useFormatter>;

function createdAt(date: string | Date | null, format: Formatter): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format.dateTime(d, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "in 13 minutes" / "Due now" — the countdown to the next queued send. */
function untilNext(date: Date | string | null, t: Translator, format: Formatter): string {
  if (!date) return t("nothingQueued");
  const d = typeof date === "string" ? new Date(date) : date;
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins <= 0) return t("dueNow");
  return format.relativeTime(d, Date.now());
}

export default function CampaignDetailClient({
  campaign,
  stats,
  mailboxes,
  leadPage,
  stepBreakdown,
  dailySends,
  pulse,
}: {
  campaign: Campaign;
  stats: Stats;
  mailboxes: Mailbox[];
  leadPage: LeadPage;
  stepBreakdown: StepBreakdown;
  dailySends: DailySends;
  pulse: CampaignPulse;
}) {
  const t = useTranslations("emailCampaigns.detail");
  const tStatus = useTranslations("emailCampaigns.status");
  const format = useFormatter();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("analytics");
  // The sequence editor stays mounted once opened: unmounting it on a tab
  // switch dropped unsaved edits, and remounting it showed the copy from page
  // load rather than what was last saved.
  const [sequenceOpened, setSequenceOpened] = useState(false);
  if (tab === "sequence" && !sequenceOpened) setSequenceOpened(true);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const connectedMailboxes = mailboxes.filter((m) => m.status === "connected");
  const canLaunch =
    campaign.status === "draft" &&
    connectedMailboxes.length > 0 &&
    campaign.sequence.length > 0 &&
    campaign.sequence.every((s, i) => (i === 0 ? s.subject.trim() : true) && s.body.trim()) &&
    leadPage.total > 0;

  async function handleLaunch() {
    setLaunching(true);
    setLaunchError(null);
    try {
      const res = await fetch(`/api/outreach/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLaunchError(data.error ?? t("launchFailed"));
        return;
      }
      router.refresh();
    } finally {
      setLaunching(false);
    }
  }

  async function handlePause() {
    await fetch(`/api/outreach/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    router.refresh();
  }

  const actions =
    campaign.status === "active" ? (
      <Button.Root variant="neutral" mode="stroke" size="small" onClick={handlePause}>
        <Button.Icon as={RiPauseCircleLine} />
        {t("pause")}
      </Button.Root>
    ) : campaign.status !== "completed" ? (
      <Button.Root
        variant="primary"
        mode="filled"
        size="small"
        onClick={handleLaunch}
        disabled={!canLaunch || launching}
        title={!canLaunch ? t("launchHint") : undefined}
      >
        <Button.Icon as={RiPlayCircleLine} />
        {launching ? t("launching") : campaign.status === "paused" ? t("resume") : t("launch")}
      </Button.Root>
    ) : null;

  return (
    <PageContainer>
      <PageHeader
        back={{ href: "/outreach/campaigns", label: t("back") }}
        title={campaign.name}
        badge={
          <Badge.Root size="medium" variant="lighter" color={isStatusKey(campaign.status) ? STATUS_COLOR[campaign.status] : "gray"}>
            <Badge.Dot />
            {isStatusKey(campaign.status) ? tStatus(campaign.status) : campaign.status}
          </Badge.Root>
        }
        description={t("subtitle", { date: createdAt(campaign.createdAt, format), steps: campaign.sequence.length })}
        actions={actions}
      />
      {launchError && <p role="alert" className="mt-2 text-paragraph-sm text-error-base">{launchError}</p>}

      {/* Today, regardless of tab. */}
      <StatRow
        className="mt-5"
        items={[
          { label: t("followUpsToday"), value: format.number(pulse.followUpsToday), icon: RiMailSendLine, hint: t("followUpsTodayHint") },
          { label: t("newLeadsToday"), value: format.number(pulse.newLeadsReachedToday), icon: RiUserAddLine, hint: t("newLeadsTodayHint") },
          { label: t("sequenceSteps"), value: String(pulse.activeSequences), icon: RiStackLine },
          { label: t("nextEmail"), value: untilNext(pulse.nextSendAt, t, format), icon: RiTimeLine, hint: campaign.status === "active" ? t("nextEmailHintActive") : t("nextEmailHintInactive") },
        ]}
      />

      <PageTabs
        className="mt-6"
        label={t("tabsLabel")}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "analytics", label: t("tabAnalytics"), icon: RiBarChart2Line },
          { value: "leads", label: t("tabLeads"), icon: RiTeamLine, count: leadPage.total },
          { value: "sequence", label: t("tabSequence"), icon: RiListOrdered2, count: campaign.sequence.length },
        ]}
      />

      <div role="tabpanel" className="mt-6">
        {tab === "analytics" && (
          <AnalyticsTab stats={stats} stepBreakdown={stepBreakdown} dailySends={dailySends} />
        )}
        {tab === "leads" && (
          <LeadsTab campaignId={campaign.id} initialPage={leadPage} onImported={() => router.refresh()} />
        )}
        {sequenceOpened && (
          <div hidden={tab !== "sequence"}>
            <SequenceTab
              campaignId={campaign.id}
              initialSequence={campaign.sequence}
              onSaved={() => router.refresh()}
            />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
