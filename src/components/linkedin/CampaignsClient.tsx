"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiChat1Line,
  RiCheckDoubleLine,
  RiDeleteBinLine,
  RiLinkedinBoxLine,
  RiLoader4Line,
  RiMoreLine,
  RiPauseCircleLine,
  RiPencilLine,
  RiPlayCircleLine,
  RiSearchLine,
  RiSendPlaneLine,
  RiTeamLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as SegmentedControl from "@/components/alignui/segmented-control";
import * as Table from "@/components/alignui/table";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { CHANNEL_META } from "@/components/analytics/theme";
import { useAnalyticsFormat } from "@/components/analytics/useAnalyticsFormat";
import { useDialogs } from "@/components/DialogProvider";
import { LinkedInAccountAvatars } from "@/components/linkedin/LinkedInAccountTag";
import { EditCampaignModal } from "@/components/linkedin/campaigns/EditCampaignModal";
import { CAMPAIGN_STATUS, campaignFunnel } from "@/components/linkedin/campaigns/metrics";
import CampaignProgressRing from "@/components/outreach/CampaignProgressRing";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { cn } from "@/utils/cn";
import { useApiErrorText } from "@/i18n/useApiErrorText";

type LinkedInAccount = { id: string; username: string; name: string | null; profilePictureUrl: string | null };

export type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED";
  type: "REGULAR" | "PERSONAL";
  accounts: LinkedInAccount[];
  totalLeads: number;
  statusCounts: Record<string, number>;
  createdAt: string;
};

const LINKEDIN = CHANNEL_META.linkedin.color;

const FILTERS = ["ALL", "ACTIVE", "PAUSED"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL_KEY = { ALL: "filterAll", ACTIVE: "filterActive", PAUSED: "filterPaused" } as const satisfies Record<Filter, string>;

const num = "text-paragraph-sm tabular-nums text-text-strong-950";

/** A count, its rate, and a slim bar scaled to the column's best rate so rows compare. */
function CountRate({ count, rate, max, kind }: { count: number; rate: number | null; max: number; kind: "accepted" | "replied" }) {
  const t = useTranslations("linkedinCampaigns.list");
  const fmt = useAnalyticsFormat();
  return (
    <div className="flex items-center gap-3" title={t(kind === "accepted" ? "countRateAccepted" : "countRateReplied", { count, rate: fmt.percent(rate) })}>
      <span className={cn("w-10 text-right", num)}>{fmt.number(count)}</span>
      <span className="w-11 text-paragraph-xs tabular-nums text-text-sub-600">{fmt.percent(rate)}</span>
      <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-bg-weak-50">
        <span className="block h-full rounded-full" style={{ width: `${max > 0 ? ((rate ?? 0) / max) * 100 : 0}%`, backgroundColor: LINKEDIN }} />
      </span>
    </div>
  );
}

function RowMenu({
  campaign,
  busy,
  onToggle,
  onDelete,
  onEdit,
}: {
  campaign: CampaignRow;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("linkedinCampaigns.list");
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy} aria-label={t("moreActions", { name: campaign.name })}>
          <Button.Icon as={busy ? RiLoader4Line : RiMoreLine} className={cn(busy && "animate-spin")} />
        </Button.Root>
      </Dropdown.Trigger>
      <Dropdown.Content>
        <Dropdown.Item onSelect={onEdit}>
          <Dropdown.ItemIcon as={RiPencilLine} />
          {t("editCampaign")}
        </Dropdown.Item>
        <Dropdown.Item onSelect={onToggle}>
          <Dropdown.ItemIcon as={campaign.status === "ACTIVE" ? RiPauseCircleLine : RiPlayCircleLine} />
          {campaign.status === "ACTIVE" ? t("pauseCampaign") : t("resumeCampaign")}
        </Dropdown.Item>
        <Dropdown.Separator />
        <Dropdown.Item destructive onSelect={onDelete}>
          <Dropdown.ItemIcon as={RiDeleteBinLine} />
          {t("deleteCampaign")}
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}

export function CampaignsClient({
  campaigns: initial,
  accounts,
}: {
  campaigns: CampaignRow[];
  accounts: LinkedInAccount[];
}) {
  const t = useTranslations("linkedinCampaigns.list");
  const apiErrorText = useApiErrorText();
  const format = useFormatter();
  const fmt = useAnalyticsFormat();
  const dialogs = useDialogs();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const rows = useMemo(() => campaigns.map((c) => ({ ...c, funnel: campaignFunnel(c.statusCounts, c.totalLeads) })), [campaigns]);

  const counts = useMemo(
    () => ({
      ALL: campaigns.length,
      ACTIVE: campaigns.filter((c) => c.status === "ACTIVE").length,
      PAUSED: campaigns.filter((c) => c.status === "PAUSED").length,
    }),
    [campaigns],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          leads: t.leads + r.funnel.total,
          queued: t.queued + r.funnel.queued,
          invited: t.invited + r.funnel.invited,
          accepted: t.accepted + r.funnel.accepted,
          replied: t.replied + r.funnel.replied,
        }),
        { leads: 0, queued: 0, invited: 0, accepted: 0, replied: 0 },
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((c) => filter === "ALL" || c.status === filter)
      .filter((c) => !term || c.name.toLowerCase().includes(term) || (c.description ?? "").toLowerCase().includes(term));
  }, [rows, filter, search]);

  const maxAccept = Math.max(...filtered.map((c) => c.funnel.acceptanceRate ?? 0), 0.0001);
  const maxReply = Math.max(...filtered.map((c) => c.funnel.replyRate ?? 0), 0.0001);

  const open = (id: string) => {
    if (deletingId !== id) router.push(`/linkedin/campaigns/${id}`);
  };

  const handleToggleStatus = async (c: CampaignRow) => {
    setTogglingId(c.id);
    const newStatus = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/linkedin/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: newStatus } : x)));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    const ok = await dialogs.confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      confirmLabel: t("deleteCampaign"),
      variant: "error",
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/linkedin/campaigns/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(apiErrorText(data, t("deleteFailed")));
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } catch (cause) {
      await dialogs.alert({
        title: t("deleteFailed"),
        description: cause instanceof Error ? cause.message : t("genericError"),
        variant: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button.Root variant="primary" mode="filled" size="small" asChild>
            <Link href="/linkedin/campaigns/new">
              <Button.Icon as={RiAddLine} />
              {t("startNew")}
            </Link>
          </Button.Root>
        }
      />

      <KpiStrip className="mt-6" columns={5}>
        <KpiCell icon={RiLinkedinBoxLine} label={t("kpiActive")} value={fmt.compact(counts.ACTIVE)} context={t("kpiActiveContext", { count: counts.PAUSED })} />
        <KpiCell icon={RiTeamLine} label={t("kpiLeads")} value={fmt.compact(totals.leads)} context={t("kpiLeadsContext", { count: fmt.compact(totals.queued) })} />
        <KpiCell icon={RiSendPlaneLine} label={t("kpiInvited")} value={fmt.compact(totals.invited)} context={totals.leads > 0 ? t("kpiInvitedContext", { rate: fmt.percent(totals.invited / totals.leads) }) : undefined} hint={t("kpiInvitedHint")} />
        <KpiCell
          icon={RiCheckDoubleLine}
          label={t("kpiAcceptance")}
          value={fmt.percent(totals.invited > 0 ? totals.accepted / totals.invited : null)}
          context={t("kpiAcceptanceContext", { accepted: fmt.compact(totals.accepted), invited: fmt.compact(totals.invited) })}
          hint={t("kpiAcceptanceHint")}
        />
        <KpiCell
          icon={RiChat1Line}
          label={t("kpiReplies")}
          value={fmt.compact(totals.replied)}
          context={totals.accepted > 0 ? t("kpiRepliesContext", { rate: fmt.percent(totals.replied / totals.accepted) }) : undefined}
          hint={t("kpiRepliesHint")}
        />
      </KpiStrip>

      <Frame className="mt-5">
        <FrameHeader
          title={t("frameTitle")}
          description={t("frameDescription")}
          actions={
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <SegmentedControl.Root value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <SegmentedControl.List className="w-auto">
                  {FILTERS.map((f) => (
                    <SegmentedControl.Trigger key={f} value={f} className="gap-1.5 px-3">
                      {t(FILTER_LABEL_KEY[f])}
                      <span className="tabular-nums text-text-soft-400">{counts[f]}</span>
                    </SegmentedControl.Trigger>
                  ))}
                </SegmentedControl.List>
              </SegmentedControl.Root>
              <Input.Root size="small" className="w-56">
                <Input.Wrapper>
                  <Input.Icon as={RiSearchLine} />
                  <Input.Input type="search" aria-label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
                </Input.Wrapper>
              </Input.Root>
            </div>
          }
        />
        <FramePanel className="overflow-x-auto p-2 sm:p-2">
          {filtered.length === 0 ? (
            campaigns.length === 0 ? (
              <EmptyState
                icon={RiLinkedinBoxLine}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
                action={
                  <Button.Root variant="primary" mode="filled" size="small" asChild>
                    <Link href="/linkedin/campaigns/new">
                      <Button.Icon as={RiAddLine} />
                      {t("startNew")}
                    </Link>
                  </Button.Root>
                }
              />
            ) : (
              <EmptyState
                icon={RiSearchLine}
                title={t("noMatchTitle")}
                description={t("noMatchDescription")}
                action={
                  <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => { setSearch(""); setFilter("ALL"); }}>
                    {t("clearFilters")}
                  </Button.Root>
                }
              />
            )
          ) : (
            <Table.Root className="min-w-[1080px] [&>table]:table-fixed">
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col" className="px-4">{t("colCampaign")}</Table.Head>
                  <Table.Head scope="col" className="w-24 px-4">{t("colSenders")}</Table.Head>
                  <Table.Head scope="col" className="w-20 px-4 text-right">{t("colLeads")}</Table.Head>
                  <Table.Head scope="col" className="w-24 whitespace-nowrap px-4 text-right" title={t("colNotInvitedTitle")}>{t("colNotInvited")}</Table.Head>
                  <Table.Head scope="col" className="w-20 px-4 text-right" title={t("colInvitedTitle")}>{t("colInvited")}</Table.Head>
                  <Table.Head scope="col" className="w-48 px-4" title={t("colAcceptedTitle")}>{t("colAccepted")}</Table.Head>
                  <Table.Head scope="col" className="w-48 px-4" title={t("colRepliedTitle")}>{t("colReplied")}</Table.Head>
                  <Table.Head scope="col" className="w-14 px-4"><span className="sr-only">{t("colActions")}</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {filtered.map((c) => {
                  const f = c.funnel;
                  const deleting = deletingId === c.id;
                  const status = CAMPAIGN_STATUS[c.status];
                  return (
                    <Table.Row
                      key={c.id}
                      tabIndex={0}
                      aria-busy={deleting || undefined}
                      onClick={() => open(c.id)}
                      onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === "Enter") open(c.id); }}
                      className={cn("cursor-pointer outline-none focus-visible:[&>td]:bg-bg-weak-50", deleting && "pointer-events-none opacity-60")}
                    >
                      <Table.Cell className="h-16 px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="shrink-0" title={f.progress === null ? t("progressNoLeads") : f.queued === 0 ? t("progressAll") : t("progressPartial", { percent: Math.round(f.progress * 100) })}>
                            <CampaignProgressRing progress={f.progress} complete={f.total > 0 && f.queued === 0} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-label-sm text-text-strong-950" title={c.name}>{c.name}</span>
                              <Badge.Root size="small" variant="lighter" color={status.color} className="shrink-0">
                                <Badge.Dot />
                                {c.status === "ACTIVE" ? t("statusActive") : t("statusPaused")}
                              </Badge.Root>
                              {deleting && <span className="shrink-0 text-paragraph-xs text-error-base">{t("deleting")}</span>}
                            </div>
                            <p className="mt-0.5 max-w-md truncate text-paragraph-xs text-text-sub-600" title={c.description ?? undefined} suppressHydrationWarning>
                              {t(c.type === "PERSONAL" ? "createdOnPersonal" : "createdOn", { date: format.dateTime(new Date(c.createdAt), { month: "short", day: "numeric" }) })}
                              {c.description ? ` · ${c.description}` : ""}
                            </p>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="px-4">
                        <LinkedInAccountAvatars accounts={c.accounts} maxVisible={2} />
                      </Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{fmt.number(f.total)}</Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", f.queued > 0 ? num : "text-paragraph-sm tabular-nums text-text-soft-400")}>{fmt.number(f.queued)}</Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{fmt.number(f.invited)}</Table.Cell>
                      <Table.Cell className="px-4">
                        <CountRate count={f.accepted} rate={f.acceptanceRate} max={maxAccept} kind="accepted" />
                      </Table.Cell>
                      <Table.Cell className="px-4">
                        <CountRate count={f.replied} rate={f.replyRate} max={maxReply} kind="replied" />
                      </Table.Cell>
                      <Table.Cell className="px-4" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <RowMenu
                            campaign={c}
                            busy={togglingId === c.id || deleting}
                            onToggle={() => void handleToggleStatus(c)}
                            onDelete={() => void handleDelete(c.id)}
                            onEdit={() => setEditing(c)}
                          />
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </FramePanel>
      </Frame>

      <EditCampaignModal
        campaign={editing}
        accounts={accounts}
        open={editing !== null}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        onSaved={(updated) => {
          const id = editing?.id;
          setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
          setEditing(null);
        }}
      />
    </div>
  );
}
