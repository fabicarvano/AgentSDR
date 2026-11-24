"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  RiArchiveLine,
  RiBarChart2Line,
  RiErrorWarningLine,
  RiHourglassLine,
  RiListOrdered2,
  RiLoader4Line,
  RiMoreLine,
  RiPauseCircleLine,
  RiPencilLine,
  RiPlayCircleLine,
  RiSmartphoneLine,
  RiTeamLine,
  RiTimeLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import { useDialogs } from "@/components/DialogProvider";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { PageTabs } from "@/components/page/PageTabs";
import { Skeleton } from "@/components/page/Skeletons";
import { StatRow } from "@/components/page/StatRow";
import type { UpdateWhatsappCampaignRequest, WhatsappCampaignDetail } from "@/lib/whatsapp/campaigns/contract";
import { cn } from "@/utils/cn";
import { apiJson } from "./api";
import { EditWhatsappCampaignModal } from "./EditWhatsappCampaignModal";
import { campaignFunnel, launchBlocker } from "./metrics";
import { useCampaignFormat } from "./useCampaignFormat";
import { WhatsappCampaignLeadsTab } from "./WhatsappCampaignLeadsTab";
import { WhatsappCampaignOverview } from "./WhatsappCampaignOverview";
import { WhatsappSequenceEditor } from "./WhatsappSequenceEditor";
import { useApiErrorText } from "@/i18n/useApiErrorText";

export type CampaignTab = "overview" | "leads" | "sequence";

const REFRESH_MS = 30_000;

export function WhatsappCampaignDetailClient({ campaignId, initialTab }: { campaignId: string; initialTab: CampaignTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const dialogs = useDialogs();
  const t = useTranslations("whatsappCampaigns.detail");
  const apiErrorText = useApiErrorText();
  const te = useTranslations("whatsappCampaigns.errors");
  const cf = useCampaignFormat();
  const [tab, setTabState] = useState<CampaignTab>(initialTab);
  const [campaign, setCampaign] = useState<WhatsappCampaignDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [editing, setEditing] = useState(false);

  // The tab lives in the URL (?tab=leads), so a link or a reload lands on it.
  const setTab = (next: CampaignTab) => {
    setTabState(next);
    router.replace(next === "overview" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  };

  const load = useCallback(async () => {
    try {
      setCampaign(await apiJson<WhatsappCampaignDetail>(`/api/whatsapp/campaigns/${campaignId}`));
      setLoadError(null);
    } catch (cause) {
      setLoadError(apiErrorText(cause, t("loadFailed")));
    }
  }, [campaignId, t, apiErrorText]);

  useEffect(() => {
    // Fetch on mount and whenever the query changes; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // A running campaign moves on its own; keep the figures fresh while the tab is visible.
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const funnel = useMemo(() => (campaign ? campaignFunnel(campaign.stats) : null), [campaign]);

  async function toggleStatus() {
    if (!campaign) return;
    const next = campaign.status === "active" ? "paused" : "active";
    setToggling(true);
    try {
      const request: UpdateWhatsappCampaignRequest = { status: next };
      await apiJson(`/api/whatsapp/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify(request) });
      setCampaign((prev) => (prev ? { ...prev, status: next } : prev));
      void load();
    } catch (cause) {
      await dialogs.alert({ title: next === "paused" ? t("pauseFailed") : t("launchFailed"), description: apiErrorText(cause, te("generic")), variant: "error" });
    } finally {
      setToggling(false);
    }
  }

  async function archive() {
    if (!campaign) return;
    const ok = await dialogs.confirm({
      title: t("archiveConfirmTitle"),
      description: t("archiveConfirmDescription"),
      confirmLabel: t("archive"),
      variant: "error",
    });
    if (!ok) return;
    try {
      await apiJson(`/api/whatsapp/campaigns/${campaign.id}`, { method: "DELETE" });
      router.push("/whatsapp/campaigns");
    } catch (cause) {
      await dialogs.alert({ title: t("archiveFailed"), description: apiErrorText(cause, te("generic")), variant: "error" });
    }
  }

  if (!campaign || !funnel) {
    if (loadError) {
      return (
        <div className="mx-auto w-full max-w-[1440px]">
          <PageHeader back={{ href: "/whatsapp/campaigns", label: t("backLabel") }} title={t("title")} />
          <EmptyState
            icon={RiErrorWarningLine}
            title={t("loadFailed")}
            description={loadError}
            action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={() => void load()}>{t("tryAgain")}</Button.Root>}
          />
        </div>
      );
    }
    return (
      <div aria-busy="true" aria-label={t("loading")} className="mx-auto w-full max-w-[1440px] space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const status = cf.campaignStatus(campaign.status);
  const connected = campaign.senders.filter((s) => s.status === "connected").length;
  const blocker = campaign.status === "paused" ? launchBlocker({ connectedSenders: connected, leads: campaign.stats.total, firstMessage: campaign.steps[0]?.body }) : null;
  const senderNames = campaign.senders.map((s) => s.name || s.phone || t("numberFallback")).join(", ");

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        back={{ href: "/whatsapp/campaigns", label: t("backLabel") }}
        title={campaign.name}
        badge={
          <Badge.Root size="medium" variant="lighter" color={status.color}>
            <Badge.Dot />
            {status.label}
          </Badge.Root>
        }
        description={<span suppressHydrationWarning>{`${t("meta", { date: cf.longDate(campaign.createdAt), count: campaign.stepCount })}${campaign.description ? ` · ${campaign.description}` : ""}`}</span>}
        actions={
          <>
            <Button.Root
              variant={campaign.status === "paused" ? "primary" : "neutral"}
              mode={campaign.status === "paused" ? "filled" : "stroke"}
              size="small"
              onClick={() => void toggleStatus()}
              disabled={toggling || Boolean(blocker)}
              title={blocker ? t("blockerTitle", { reason: blocker }) : undefined}
            >
              <Button.Icon as={toggling ? RiLoader4Line : campaign.status === "active" ? RiPauseCircleLine : RiPlayCircleLine} className={cn(toggling && "animate-spin")} />
              {campaign.status === "active" ? t("pause") : campaign.stats.messagesSent > 0 ? t("resume") : t("launch")}
            </Button.Root>
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <Button.Root variant="neutral" mode="stroke" size="small" aria-label={t("moreActions")}>
                  <Button.Icon as={RiMoreLine} />
                </Button.Root>
              </Dropdown.Trigger>
              <Dropdown.Content>
                <Dropdown.Item onSelect={() => setEditing(true)}>
                  <Dropdown.ItemIcon as={RiPencilLine} />
                  {t("edit")}
                </Dropdown.Item>
                <Dropdown.Separator />
                <Dropdown.Item destructive onSelect={() => void archive()}>
                  <Dropdown.ItemIcon as={RiArchiveLine} />
                  {t("archive")}
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Root>
          </>
        }
      />
      {blocker && <p className="mt-3 text-paragraph-xs text-text-sub-600">{t("cannotLaunch", { reason: blocker })}</p>}

      <StatRow
        className="mt-5"
        items={[
          { label: t("statQueued"), value: cf.number(funnel.queued), icon: RiTimeLine, hint: t("statQueuedHint") },
          { label: t("statInSequence"), value: cf.number(funnel.inSequence), icon: RiHourglassLine, hint: t("statInSequenceHint") },
          { label: t("statNumbers"), value: cf.number(campaign.senders.length), icon: RiSmartphoneLine, hint: senderNames || t("statNumbersNone") },
        ]}
      />

      <PageTabs
        className="mt-6"
        label={t("tabsLabel")}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: t("tabOverview"), icon: RiBarChart2Line },
          { value: "leads", label: t("tabLeads"), icon: RiTeamLine, count: campaign.stats.total },
          { value: "sequence", label: t("tabSequence"), icon: RiListOrdered2, count: campaign.stepCount },
        ]}
      />

      {/* Leads and Sequence stay mounted when hidden, so filters and unsaved
          sequence edits survive a trip to another tab. */}
      <div role="tabpanel" className="mt-6">
        {tab === "overview" && <WhatsappCampaignOverview funnel={funnel} campaign={campaign} />}
        <div hidden={tab !== "leads"}>
          <WhatsappCampaignLeadsTab campaignId={campaign.id} stats={campaign.stats} stepCount={campaign.stepCount} onChanged={() => void load()} />
        </div>
        <div hidden={tab !== "sequence"}>
          <WhatsappSequenceEditor
            campaignId={campaign.id}
            initialSteps={campaign.steps}
            sentByStep={campaign.sentByStep}
            leadsVersion={campaign.stats.total}
            onSaved={() => void load()}
          />
        </div>
      </div>

      <EditWhatsappCampaignModal campaign={campaign} open={editing} onOpenChange={setEditing} onSaved={() => { setEditing(false); void load(); }} />
    </div>
  );
}
