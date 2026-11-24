"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiChat1Line,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiFileExcel2Line,
  RiLoader4Line,
  RiMoreLine,
  RiPlayCircleLine,
  RiSearchLine,
  RiStopCircleLine,
  RiTeamLine,
  RiUserAddLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as SegmentedControl from "@/components/alignui/segmented-control";
import * as Table from "@/components/alignui/table";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import AddPeopleToCampaignModal from "@/components/leads/AddPeopleToCampaignModal";
import CampaignCsvMappingDialog from "@/components/leads/CampaignCsvMappingDialog";
import { EmptyState } from "@/components/page/EmptyState";
import { Skeleton } from "@/components/page/Skeletons";
import {
  WHATSAPP_CAMPAIGN_LEAD_STATUSES,
  type ListWhatsappCampaignLeadsResponse,
  type UpdateWhatsappCampaignLeadRequest,
  type WhatsappCampaignImportResponse,
  type WhatsappCampaignLead,
  type WhatsappCampaignLeadStatus,
  type WhatsappCampaignStats,
} from "@/lib/whatsapp/campaigns/contract";
import { cn } from "@/utils/cn";
import { apiJson } from "./api";
import { useCampaignFormat, useImportSummary } from "./useCampaignFormat";
import { useApiErrorText } from "@/i18n/useApiErrorText";

const PAGE_SIZE = 25;

type StatusFilter = WhatsappCampaignLeadStatus | "all";

/**
 * The Leads tab of a message campaign: import (spreadsheet or People),
 * filter by status and search, and stop, resume or remove a lead. Owns its
 * page of leads and tells the parent when counts may have changed.
 */
export function WhatsappCampaignLeadsTab({
  campaignId,
  stats,
  stepCount,
  onChanged,
}: {
  campaignId: string;
  stats: WhatsappCampaignStats;
  stepCount: number;
  /** Leads were added, removed or changed; the parent reloads the campaign's figures. */
  onChanged: () => void;
}) {
  const dialogs = useDialogs();
  const router = useRouter();
  const t = useTranslations("whatsappCampaigns.leads");
  const apiErrorText = useApiErrorText();
  const te = useTranslations("whatsappCampaigns.errors");
  const cf = useCampaignFormat();
  const importSummary = useImportSummary();
  /** "Message 2 of 3": how far the sequence has got for this lead. */
  const progressLabel = (lead: WhatsappCampaignLead): string => {
    if (lead.status === "queued") return t("progressQueued", { total: stepCount });
    if (lead.status === "in_sequence") return t("progressInSequence", { current: Math.min(lead.currentStep + 1, stepCount), total: stepCount });
    return t("progressSent", { sent: lead.currentStep, total: stepCount });
  };
  const nextOrLast = (lead: WhatsappCampaignLead): string => {
    if (lead.status === "queued" || lead.status === "in_sequence") {
      return lead.nextSendAt ? t("next", { when: cf.relative(lead.nextSendAt) }) : t("waitingForNumber");
    }
    if (lead.status === "replied") return lead.repliedAt ? t("repliedWhen", { when: cf.relative(lead.repliedAt) }) : t("replied");
    return lead.lastSentAt ? t("lastSent", { when: cf.relative(lead.lastSentAt) }) : t("nothingSent");
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListWhatsappCampaignLeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status !== "all") params.set("status", status);
    if (debounced) params.set("q", debounced);
    try {
      const result = await apiJson<ListWhatsappCampaignLeadsResponse>(`/api/whatsapp/campaigns/${campaignId}/leads?${params}`);
      setData(result);
      setLoadError(null);
    } catch (cause) {
      setLoadError(apiErrorText(cause, t("loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [campaignId, page, status, debounced, t, apiErrorText]);

  useEffect(() => {
    // Fetch on mount and whenever the query changes; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Counts or the sequence moved on elsewhere (a poll of the detail page): refresh this page too.
  const totalSeen = useRef(stats.total);
  useEffect(() => {
    if (totalSeen.current !== stats.total) {
      totalSeen.current = stats.total;
      void load();
    }
  }, [stats.total, load]);

  const refreshAll = useCallback(() => {
    void load();
    onChanged();
  }, [load, onChanged]);

  async function act(lead: WhatsappCampaignLead, action: UpdateWhatsappCampaignLeadRequest["action"]) {
    setBusyId(lead.id);
    try {
      await apiJson(`/api/whatsapp/campaigns/${campaignId}/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ action } satisfies UpdateWhatsappCampaignLeadRequest) });
      refreshAll();
    } catch (cause) {
      await dialogs.alert({ title: action === "stop" ? t("stopFailed") : t("resumeFailed"), description: apiErrorText(cause, te("generic")), variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(lead: WhatsappCampaignLead) {
    const ok = await dialogs.confirm({
      title: t("removeConfirmTitle"),
      description: t("removeConfirmDescription", { name: lead.name || lead.phone }),
      confirmLabel: t("removeConfirm"),
      variant: "error",
    });
    if (!ok) return;
    setBusyId(lead.id);
    try {
      await apiJson(`/api/whatsapp/campaigns/${campaignId}/leads/${lead.id}`, { method: "DELETE" });
      refreshAll();
    } catch (cause) {
      await dialogs.alert({ title: t("removeFailed"), description: apiErrorText(cause, te("generic")), variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtering = status !== "all" || debounced.length > 0;
  const openStatuses = new Set<WhatsappCampaignLeadStatus>(["queued", "in_sequence"]);

  const importActions = (
    <>
      <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => fileRef.current?.click()}>
        <Button.Icon as={RiFileExcel2Line} />
        {t("importSpreadsheet")}
      </Button.Root>
      <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => setShowPeople(true)}>
        <Button.Icon as={RiUserAddLine} />
        {t("addFromPeople")}
      </Button.Root>
    </>
  );

  return (
    <Frame>
      <FrameHeader
        title={t("title")}
        description={t("description")}
        actions={<div className="flex flex-wrap items-center gap-2">{importActions}</div>}
      />
      <FramePanel className="p-2 sm:p-2">
        <div className="flex flex-col gap-2 p-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto">
            <SegmentedControl.Root value={status} onValueChange={(v) => { setStatus(v as StatusFilter); setPage(1); }}>
              <SegmentedControl.List className="w-auto">
                <SegmentedControl.Trigger value="all" className="gap-1.5 px-3">
                  {t("filterAll")} <span className="tabular-nums text-text-soft-400">{stats.total}</span>
                </SegmentedControl.Trigger>
                {WHATSAPP_CAMPAIGN_LEAD_STATUSES.map((s) => (
                  <SegmentedControl.Trigger key={s} value={s} className="gap-1.5 px-3">
                    {cf.leadStatus(s).label} <span className="tabular-nums text-text-soft-400">{stats[s]}</span>
                  </SegmentedControl.Trigger>
                ))}
              </SegmentedControl.List>
            </SegmentedControl.Root>
          </div>
          <Input.Root size="small" className="w-full lg:w-64">
            <Input.Wrapper>
              <Input.Icon as={RiSearchLine} />
              <Input.Input type="search" aria-label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </Input.Wrapper>
          </Input.Root>
        </div>

        {notice && (
          <p role="status" className="mx-2 mb-2 rounded-xl bg-bg-weak-50 px-3 py-2 text-paragraph-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">{notice}</p>
        )}

        <div className="overflow-x-auto">
          {loading ? (
            <div aria-busy="true" aria-label={t("loading")} className="space-y-2 p-2">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div>
          ) : loadError ? (
            <EmptyState icon={RiErrorWarningLine} title={t("loadFailed")} description={loadError} action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={() => { setLoading(true); void load(); }}>{t("tryAgain")}</Button.Root>} />
          ) : !data || data.leads.length === 0 ? (
            filtering ? (
              <EmptyState icon={RiSearchLine} title={t("noMatchTitle")} description={t("noMatchDescription")} action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={() => { setSearch(""); setStatus("all"); }}>{t("clearFilters")}</Button.Root>} />
            ) : (
              <EmptyState
                icon={RiTeamLine}
                title={t("emptyTitle")}
                description={t("emptyDescription")}
                action={<div className="flex flex-wrap justify-center gap-2">{importActions}</div>}
              />
            )
          ) : (
            <Table.Root className="min-w-[860px] [&>table]:table-fixed">
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col" className="px-4">{t("colLead")}</Table.Head>
                  <Table.Head scope="col" className="w-40 px-4">{t("colPhone")}</Table.Head>
                  <Table.Head scope="col" className="w-32 px-4">{t("colStatus")}</Table.Head>
                  <Table.Head scope="col" className="w-36 px-4">{t("colProgress")}</Table.Head>
                  <Table.Head scope="col" className="w-44 px-4">{t("colWhen")}</Table.Head>
                  <Table.Head scope="col" className="w-14 px-4"><span className="sr-only">{t("colActions")}</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {data.leads.map((lead) => {
                  const meta = cf.leadStatus(lead.status);
                  const busy = busyId === lead.id;
                  return (
                    <Table.Row key={lead.id} aria-busy={busy || undefined} className={cn(busy && "pointer-events-none opacity-60")}>
                      <Table.Cell className="px-4">
                        <p className="truncate text-label-sm text-text-strong-950" title={lead.name ?? undefined}>{lead.name || t("unnamed")}</p>
                        <p className="mt-0.5 truncate text-paragraph-xs text-text-sub-600">{[lead.title, lead.companyName].filter(Boolean).join(" · ") || "—"}</p>
                      </Table.Cell>
                      <Table.Cell className="px-4 text-paragraph-sm tabular-nums text-text-sub-600">{lead.phone}</Table.Cell>
                      <Table.Cell className="px-4">
                        <Badge.Root size="small" variant="lighter" color={meta.color}>
                          <Badge.Dot />
                          {meta.label}
                        </Badge.Root>
                      </Table.Cell>
                      <Table.Cell className="px-4 text-paragraph-sm tabular-nums text-text-sub-600">{progressLabel(lead)}</Table.Cell>
                      <Table.Cell className="px-4">
                        <p className="text-paragraph-sm text-text-sub-600" suppressHydrationWarning>{nextOrLast(lead)}</p>
                        {lead.status === "failed" && lead.lastError && (
                          <p className="mt-0.5 line-clamp-2 text-paragraph-xs text-error-base" title={lead.lastError}>{lead.lastError}</p>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-4">
                        <div className="flex justify-end">
                          <Dropdown.Root>
                            <Dropdown.Trigger asChild>
                              <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy} aria-label={t("moreActionsFor", { name: lead.name || lead.phone })}>
                                <Button.Icon as={busy ? RiLoader4Line : RiMoreLine} className={cn(busy && "animate-spin")} />
                              </Button.Root>
                            </Dropdown.Trigger>
                            <Dropdown.Content>
                              {openStatuses.has(lead.status) && (
                                <Dropdown.Item onSelect={() => void act(lead, "stop")}>
                                  <Dropdown.ItemIcon as={RiStopCircleLine} />
                                  {t("stopSequence")}
                                </Dropdown.Item>
                              )}
                              {(lead.status === "stopped" || lead.status === "failed") && (
                                <Dropdown.Item onSelect={() => void act(lead, "resume")}>
                                  <Dropdown.ItemIcon as={RiPlayCircleLine} />
                                  {t("resumeSequence")}
                                </Dropdown.Item>
                              )}
                              {lead.chatId && (
                                <Dropdown.Item onSelect={() => router.push(`/calling/messages?chat=${encodeURIComponent(lead.chatId!)}`)}>
                                  <Dropdown.ItemIcon as={RiChat1Line} />
                                  {t("openChat")}
                                  <Dropdown.ItemIcon as={RiExternalLinkLine} className="ml-auto" />
                                </Dropdown.Item>
                              )}
                              <Dropdown.Separator />
                              <Dropdown.Item destructive onSelect={() => void remove(lead)}>
                                <Dropdown.ItemIcon as={RiDeleteBinLine} />
                                {t("removeFromCampaign")}
                              </Dropdown.Item>
                            </Dropdown.Content>
                          </Dropdown.Root>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </div>

        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-3">
            <p className="text-paragraph-xs tabular-nums text-text-sub-600">
              {t("range", { from: cf.number((data.page - 1) * data.pageSize + 1), to: cf.number(Math.min(data.page * data.pageSize, data.total)), total: cf.number(data.total) })}
            </p>
            <div className="flex items-center gap-1">
              <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label={t("previousPage")}>
                <Button.Icon as={RiArrowLeftSLine} />
              </Button.Root>
              <span className="px-2 text-paragraph-xs tabular-nums text-text-sub-600">{t("pageOf", { page: data.page, pages })}</span>
              <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={data.page >= pages} onClick={() => setPage((p) => p + 1)} aria-label={t("nextPage")}>
                <Button.Icon as={RiArrowRightSLine} />
              </Button.Root>
            </div>
          </div>
        )}
      </FramePanel>

      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)} />
      {pendingFile && (
        <CampaignCsvMappingDialog
          file={pendingFile}
          endpoint={`/api/whatsapp/campaigns/${campaignId}/upload`}
          channel="whatsapp"
          onClose={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }}
          onImported={(result) => {
            const imported = result as WhatsappCampaignImportResponse;
            setNotice(importSummary(imported));
            setPendingFile(null);
            if (fileRef.current) fileRef.current.value = "";
            refreshAll();
          }}
        />
      )}
      {showPeople && (
        <AddPeopleToCampaignModal
          campaignId={campaignId}
          channel="whatsapp"
          onClose={() => setShowPeople(false)}
          onAdded={(result) => {
            setNotice(t("peopleSummary", { added: result.added, duplicates: result.skippedDuplicate, missing: result.skippedMissingIdentity }));
            refreshAll();
          }}
        />
      )}
    </Frame>
  );
}
