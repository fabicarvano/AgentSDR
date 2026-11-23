"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  RiArchiveLine,
  RiBarChart2Line,
  RiCalendarCheckLine,
  RiErrorWarningLine,
  RiListOrdered2,
  RiLoader4Line,
  RiMoreLine,
  RiPauseCircleLine,
  RiPhoneLine,
  RiPlayCircleLine,
  RiRocketLine,
  RiSettings3Line,
  RiSmartphoneLine,
  RiTeamLine,
} from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import { useDialogs } from "@/components/DialogProvider";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { PageTabs } from "@/components/page/PageTabs";
import { Skeleton } from "@/components/page/Skeletons";
import { StatRow } from "@/components/page/StatRow";
import type { AiCampaignDetail, AiCampaignStats } from "@/lib/calls/aiCampaigns/api";
import { archiveAiCampaign, getAiCampaign, getAiCampaignStats, launchAiCampaign, updateAiCampaign } from "@/lib/calls/aiCampaigns/client";
import { cn } from "@/utils/cn";
import { AiAgentBadge, AiCampaignStateBadge, useErrorText } from "./aiShared";
import { useAiProblemText } from "./useAiServerText";
import { AiCampaignOverview } from "./AiCampaignOverview";
import { AiLeadsTab } from "./AiLeadsTab";
import { AiSequenceTab } from "./AiSequenceTab";
import { AiSettingsTab } from "./AiSettingsTab";
import type { AiCampaignTab } from "./tabs";

const REFRESH_MS = 30_000;
const LIST_HREF = "/calling/campaigns";

export function AiCampaignDetailClient({ campaignId, initialTab }: { campaignId: string; initialTab: AiCampaignTab }) {
  const t = useTranslations("callingAiSetup.detail");
  const problemText = useAiProblemText();
  const format = useFormatter();
  const errorText = useErrorText();
  const LIST = { href: LIST_HREF, label: t("back") };
  const router = useRouter();
  const pathname = usePathname();
  const dialogs = useDialogs();
  const [tab, setTabState] = useState<AiCampaignTab>(initialTab);
  const [campaign, setCampaign] = useState<AiCampaignDetail | null>(null);
  const [stats, setStats] = useState<AiCampaignStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setTab = (next: AiCampaignTab) => {
    setTabState(next);
    router.replace(next === "overview" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  };

  const load = useCallback(async () => {
    try {
      const [detail, nextStats] = await Promise.all([getAiCampaign(campaignId), getAiCampaignStats(campaignId).catch(() => null)]);
      setCampaign(detail);
      if (nextStats) setStats(nextStats);
      setLoadError(null);
    } catch (cause) {
      setLoadError(errorText(cause, t("loadFailed")));
    }
  }, [campaignId, errorText, t]);

  useEffect(() => {
    // Fetch on mount; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // A running campaign moves on its own; keep the figures fresh while the tab is visible.
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function launch() {
    if (!campaign) return;
    setBusy(true);
    try {
      setCampaign(await launchAiCampaign(campaign.id));
      void load();
    } catch (cause) {
      await dialogs.alert({ title: t("launchFailed"), description: errorText(cause), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (!campaign) return;
    setBusy(true);
    try {
      setCampaign(await updateAiCampaign(campaign.id, { status: campaign.state === "active" ? "paused" : "active" }));
      void load();
    } catch (cause) {
      await dialogs.alert({ title: campaign.state === "active" ? t("pauseFailed") : t("resumeFailed"), description: errorText(cause), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!campaign) return;
    const ok = await dialogs.confirm({
      title: t("archiveTitle"),
      description: t("archiveDescription"),
      confirmLabel: t("archiveConfirm"),
      variant: "error",
    });
    if (!ok) return;
    try {
      await archiveAiCampaign(campaign.id);
      router.push(LIST_HREF);
    } catch (cause) {
      await dialogs.alert({ title: t("archiveFailed"), description: errorText(cause), variant: "error" });
    }
  }

  if (!campaign) {
    if (loadError) {
      return (
        <div className="mx-auto w-full max-w-[1440px]">
          <PageHeader back={LIST} title={t("pageTitle")} />
          <EmptyState icon={RiErrorWarningLine} title={t("loadFailed")} description={loadError} action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={() => void load()}>{t("tryAgain")}</Button.Root>} />
        </div>
      );
    }
    return (
      <div aria-busy="true" aria-label={t("loadingAria")} className="mx-auto w-full max-w-[1440px] space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const draft = campaign.state === "draft";
  const canLaunch = draft && !campaign.blocker;
  // The server sends the blocker as a code too; an older response without it keeps its English text.
  const blockerText = campaign.blockerProblem ? problemText.launch(campaign.blockerProblem) : (campaign.blocker ?? "");
  const created = format.dateTime(new Date(campaign.createdAt), { month: "short", day: "numeric", year: "numeric" });
  const numberNames = campaign.numbers.map((number) => number.name).join(", ");

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        back={LIST}
        title={campaign.name}
        badge={
          <>
            <AiCampaignStateBadge state={campaign.state} />
            <AiAgentBadge />
          </>
        }
        description={
          <span suppressHydrationWarning>
            {campaign.description
              ? t("createdWithDescription", { date: created, count: campaign.stepCount, description: campaign.description })
              : t("created", { date: created, count: campaign.stepCount })}
          </span>
        }
        actions={
          <>
            {draft ? (
              <Button.Root variant="primary" mode="filled" size="small" onClick={() => void launch()} disabled={busy || !canLaunch} title={blockerText || undefined}>
                <Button.Icon as={busy ? RiLoader4Line : RiRocketLine} className={cn(busy && "animate-spin")} />
                {t("launch")}
              </Button.Root>
            ) : (
              <Button.Root variant={campaign.state === "paused" ? "primary" : "neutral"} mode={campaign.state === "paused" ? "filled" : "stroke"} size="small" onClick={() => void toggle()} disabled={busy}>
                <Button.Icon as={busy ? RiLoader4Line : campaign.state === "active" ? RiPauseCircleLine : RiPlayCircleLine} className={cn(busy && "animate-spin")} />
                {campaign.state === "active" ? t("pause") : t("resume")}
              </Button.Root>
            )}
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <Button.Root variant="neutral" mode="stroke" size="small" aria-label={t("moreActions")}><Button.Icon as={RiMoreLine} /></Button.Root>
              </Dropdown.Trigger>
              <Dropdown.Content align="end">
                <Dropdown.Item destructive onSelect={() => void archive()}>
                  <Dropdown.ItemIcon as={RiArchiveLine} />
                  {t("archiveItem")}
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Root>
          </>
        }
      />
      {draft && campaign.blocker && <p className="mt-3 text-paragraph-xs text-text-sub-600">{t("cannotLaunch", { blocker: blockerText.charAt(0).toLowerCase() + blockerText.slice(1) })}</p>}
      {draft && !campaign.blocker && <p className="mt-3 text-paragraph-xs text-text-sub-600">{t("draftNote")}</p>}

      <StatRow
        className="mt-5"
        items={[
          { label: t("stats.leads"), value: format.number(campaign.leads), icon: RiTeamLine, hint: t("stats.leadsHint") },
          { label: t("stats.callsToday"), value: `${format.number(campaign.callsToday)}${campaign.callsPerDayLimit ? ` / ${format.number(campaign.callsPerDayLimit)}` : ""}`, icon: RiPhoneLine, hint: t("stats.callsTodayHint") },
          { label: t("stats.booked"), value: format.number(campaign.booked), icon: RiCalendarCheckLine, hint: t("stats.bookedHint") },
          { label: t("stats.numbers"), value: format.number(campaign.numbers.length), icon: RiSmartphoneLine, hint: numberNames || t("stats.numbersNone") },
        ]}
      />

      <PageTabs
        className="mt-6"
        label={t("tabs.label")}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: t("tabs.overview"), icon: RiBarChart2Line },
          { value: "leads", label: t("tabs.leads"), icon: RiTeamLine, count: campaign.leads },
          { value: "sequence", label: t("tabs.sequence"), icon: RiListOrdered2, count: campaign.stepCount },
          { value: "settings", label: t("tabs.settings"), icon: RiSettings3Line },
        ]}
      />

      {/* Leads, Sequence and Settings stay mounted when hidden, so filters and unsaved edits survive a trip to another tab. */}
      <div role="tabpanel" className="mt-6">
        {tab === "overview" && <AiCampaignOverview campaign={campaign} stats={stats} />}
        <div hidden={tab !== "leads"}>
          <AiLeadsTab campaignId={campaign.id} counts={stats?.byStatus ?? null} total={campaign.leads} onChanged={() => void load()} />
        </div>
        <div hidden={tab !== "sequence"}>
          <AiSequenceTab campaign={campaign} stats={stats?.perStep} onSaved={() => void load()} />
        </div>
        <div hidden={tab !== "settings"}>
          <AiSettingsTab campaign={campaign} onSaved={() => void load()} onToggle={() => void toggle()} onArchive={() => void archive()} toggling={busy} />
        </div>
      </div>
    </div>
  );
}
