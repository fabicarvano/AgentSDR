"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCheckboxCircleLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiMoreLine,
  RiLoader4Line,
  RiPencilLine,
  RiSearchLine,
  RiTeamLine,
  RiUploadCloud2Line,
} from "@remixicon/react";
import * as Avatar from "@/components/alignui/avatar";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Checkbox from "@/components/alignui/checkbox";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as Select from "@/components/alignui/select";
import * as Table from "@/components/alignui/table";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import AddPeopleToCampaignModal from "@/components/leads/AddPeopleToCampaignModal";
import CampaignCsvMappingDialog from "@/components/leads/CampaignCsvMappingDialog";
import { LeadBulkActionBar } from "@/components/linkedin/LeadBulkActionBar";
import { LeadDetailPanel } from "@/components/linkedin/LeadDetailPanel";
import { LinkedInAccountTag } from "@/components/linkedin/LinkedInAccountTag";
import { EmptyState } from "@/components/page/EmptyState";
import { Skeleton } from "@/components/page/Skeletons";
import { downloadBase64File } from "@/lib/linkedin/downloadBase64File";
import { isMessageEditable, LEAD_MESSAGE_FIELDS } from "@/lib/linkedin/leadMessages";
import { campaignLeadTemplateFilename } from "@/lib/linkedin/leadsTemplate";
import { isAllPageSelected, isSomePageSelected, toggleAllOnPage, toggleLeadSelection } from "@/lib/linkedin/leadSelection";
import { cn } from "@/utils/cn";
import { LEAD_STATUS } from "./metrics";

type LinkedInAccount = { id: string; username: string; name: string | null; profilePictureUrl: string | null };
export type LeadsPagination = { page: number; limit: number; total: number; pages: number };

export type CampaignLead = {
  id: string;
  linkedinUrl: string;
  name: string | null;
  profilePictureUrl: string | null;
  headline: string | null;
  location: string | null;
  status: string;
  requestSentAt: string | null;
  invitationMessage: string | null;
  acceptanceMessage: string | null;
  followUp1Message: string | null;
  followUp1SentAt: string | null;
  followUp2Message: string | null;
  followUp2SentAt: string | null;
  followUp3Message: string | null;
  followUp3SentAt: string | null;
  linkedinAccountId: string | null;
  linkedInAccount: LinkedInAccount | null;
  createdAt: string;
  alsoInCampaigns?: { id: string; name: string }[];
};

export type InitialLeadsPage = { leads: CampaignLead[]; pagination: LeadsPagination };

type CrossCampaignNotice = { linkedinUrl: string; name: string | null; alsoInCampaigns: { id: string; name: string }[] };
type UploadResult = {
  ok: boolean;
  message: string;
  failedFileBase64?: string;
  failedFileName?: string;
  crossCampaignNotices?: CrossCampaignNotice[];
};

// Every lead status the pipeline knows (the label is the catalog's, the colour is metrics' LEAD_STATUS). A status
// the code does not list falls back to its raw value.
const LEAD_STATUS_LABEL_KEY = {
  PENDING: "pending",
  REQUEST_SENT: "requestSent",
  CONNECTED: "connected",
  ACCEPT_MESSAGE_SENT: "acceptMessageSent",
  FOLLOW_UP_1_SENT: "followUp1Sent",
  FOLLOW_UP_2_SENT: "followUp2Sent",
  FOLLOW_UP_3_SENT: "followUp3Sent",
  COMPLETED: "completed",
  REPLIED: "replied",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;
type KnownLeadStatus = keyof typeof LEAD_STATUS_LABEL_KEY;
const isKnownLeadStatus = (status: string): status is KnownLeadStatus => Object.prototype.hasOwnProperty.call(LEAD_STATUS_LABEL_KEY, status);

/** Radix Select can't hold an empty value, so "no filter" is this sentinel. */
const ALL = "__all";
const MESSAGE_FIELDS = LEAD_MESSAGE_FIELDS.map(({ key }) => key);

function LeadAvatar({ src, name }: { src: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const initials = name.split(/[\s/]/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  if (src && !err) {
    return (
      <Avatar.Root size="32" className="shrink-0">
        <Avatar.Image
          src={src}
          alt=""
          onError={() => setErr(true)}
          // A server-rendered <img> can fail before hydration attaches onError.
          ref={(img) => { if (img?.complete && img.naturalWidth === 0) setErr(true); }}
        />
      </Avatar.Root>
    );
  }
  return (
    <Avatar.Root size="32" color="blue" className="shrink-0">
      {initials || "?"}
    </Avatar.Root>
  );
}

/**
 * The Leads tab of a LinkedIn campaign: import (file picker, drag-and-drop,
 * or People), filter by status / search / sender, select and bulk-delete,
 * and open a lead's detail panel. Owns its page of leads; tells the parent
 * when a lead is removed so the campaign's counts stay right.
 */
export function CampaignLeadsTab({
  campaignId,
  campaignName,
  totalLeads,
  statusCounts,
  senderOptions,
  initialLeadsPage,
  onLeadRemoved,
  onChanged,
}: {
  campaignId: string;
  campaignName: string;
  totalLeads: number;
  statusCounts: Record<string, number>;
  senderOptions: LinkedInAccount[];
  initialLeadsPage: InitialLeadsPage;
  onLeadRemoved: (status: string) => void;
  /** Leads were added or removed server-side; refresh the campaign's figures. */
  onChanged: () => void;
}) {
  const t = useTranslations("linkedinCampaigns.leadsTab");
  const format = useFormatter();
  const dialogs = useDialogs();
  const statusLabel = (status: string, fallback?: string) => (isKnownLeadStatus(status) ? t(`status.${LEAD_STATUS_LABEL_KEY[status]}`) : (fallback ?? status));
  const [leads, setLeads] = useState(initialLeadsPage.leads);
  const [pagination, setPagination] = useState<LeadsPagination>(initialLeadsPage.pagination);
  const [loading, setLoading] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterAccountId, setFilterAccountId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragDepthRef = useRef(0);

  const hasLeadFilters = Boolean(filterStatus || filterSearch || filterAccountId);

  const fetchLeads = useCallback(
    async (page: number, opts?: { status?: string; search?: string; accountId?: string }) => {
      setLoading(true);
      try {
        const s = opts?.status ?? filterStatus;
        const q = opts?.search ?? filterSearch;
        const a = opts?.accountId ?? filterAccountId;
        const params = new URLSearchParams({ page: String(page), limit: "20", campaignId });
        if (s) params.set("status", s);
        if (q.trim()) params.set("search", q.trim());
        if (a) params.set("accountId", a);
        const res = await fetch(`/api/linkedin/leads?${params}`);
        const data = await res.json();
        if (!data.ok) return;
        setLeads(data.leads ?? []);
        setPagination(data.pagination);
      } finally {
        setLoading(false);
      }
    },
    [campaignId, filterStatus, filterSearch, filterAccountId],
  );

  const clearSelection = () => {
    setSelectedIds(new Set());
    setAllMatchingSelected(false);
  };

  const applyLeadFilters = (next: { status?: string; search?: string; accountId?: string }) => {
    clearSelection();
    const s = next.status !== undefined ? next.status : filterStatus;
    const q = next.search !== undefined ? next.search : filterSearch;
    const a = next.accountId !== undefined ? next.accountId : filterAccountId;
    if (next.status !== undefined) setFilterStatus(next.status);
    if (next.search !== undefined) setFilterSearch(next.search);
    if (next.accountId !== undefined) setFilterAccountId(next.accountId);
    void fetchLeads(1, { status: s, search: q, accountId: a });
  };

  useEffect(() => () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); }, []);

  const uploadFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      setUploadResult({ ok: false, message: t("invalidFile") });
      return;
    }
    setUploadResult(null);
    setPendingImportFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pendingImportFile) return;
    dragDepthRef.current += 1;
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (pendingImportFile) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDeleteLead = async (lead: CampaignLead) => {
    const ok = await dialogs.confirm({
      title: t("removeTitle"),
      description: t("removeDescription", { name: lead.name ?? lead.linkedinUrl }),
      confirmLabel: t("removeConfirm"),
      variant: "error",
    });
    if (!ok) return;
    setDeletingId(lead.id);
    try {
      await fetch(`/api/linkedin/leads/${lead.id}`, { method: "DELETE" });
      onLeadRemoved(lead.status);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(lead.id); return next; });
      if (selectedLeadId === lead.id) setSelectedLeadId(null);
      void fetchLeads(leads.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page);
      onChanged();
    } finally {
      setDeletingId(null);
    }
  };

  const pageIds = leads.map((l) => l.id);
  const allPageSelected = isAllPageSelected(selectedIds, pageIds);
  const somePageSelected = isSomePageSelected(selectedIds, pageIds);

  const handleSelectAllMatching = async () => {
    setSelectingAll(true);
    try {
      const params = new URLSearchParams({ campaignId });
      if (filterStatus) params.set("status", filterStatus);
      if (filterSearch.trim()) params.set("search", filterSearch.trim());
      if (filterAccountId) params.set("accountId", filterAccountId);
      const res = await fetch(`/api/linkedin/leads/ids?${params}`);
      const data = await res.json();
      if (!data.ok) return;
      setSelectedIds(new Set(data.ids as string[]));
      setAllMatchingSelected(true);
    } finally {
      setSelectingAll(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!allMatchingSelected && selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/linkedin/leads/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          allMatchingSelected
            ? {
                matchFilters: true,
                filters: {
                  campaignId,
                  ...(filterStatus ? { status: filterStatus } : {}),
                  ...(filterSearch.trim() ? { search: filterSearch.trim() } : {}),
                  ...(filterAccountId ? { accountId: filterAccountId } : {}),
                },
              }
            : { ids: [...selectedIds] },
        ),
      });
      const data = await res.json();
      if (!data.ok) return;
      if (selectedLeadId && (allMatchingSelected || selectedIds.has(selectedLeadId))) setSelectedLeadId(null);
      clearSelection();
      onChanged();
      if (allMatchingSelected) void fetchLeads(1);
      else if (leads.length <= selectedIds.size && pagination.page > 1) void fetchLeads(pagination.page - 1);
      else void fetchLeads(pagination.page);
    } finally {
      setBulkDeleting(false);
    }
  };

  const selectedCount = allMatchingSelected ? pagination.total : selectedIds.size;

  const statusOptions = useMemo(
    () => Object.entries(LEAD_STATUS).filter(([key]) => (statusCounts[key] ?? 0) > 0 || key === filterStatus),
    [statusCounts, filterStatus],
  );

  const openPicker = () => { if (!pendingImportFile) fileRef.current?.click(); };

  return (
    <>
      <Frame
        className={cn("relative transition", isDragging && "ring-2 ring-primary-base")}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-bg-white-0/85 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2 text-primary-base">
              <RiUploadCloud2Line className="size-9" />
              <p className="text-label-sm">{t("dropToImport")}</p>
            </div>
          </div>
        )}
        <FrameHeader
          title={t("title")}
          description={
            hasLeadFilters
              ? t("descriptionFiltered", { shown: pagination.total, total: totalLeads })
              : t("descriptionAll", { total: totalLeads })
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button.Root variant="neutral" mode="ghost" size="xsmall" asChild>
                <a href={`/api/linkedin/campaigns/${campaignId}/template`} download={campaignLeadTemplateFilename(campaignName)} aria-label={t("templateLabel")} title={t("templateLabel")}>
                  <Button.Icon as={RiDownloadLine} />
                  <span className="hidden sm:inline">{t("template")}</span>
                </a>
              </Button.Root>
              <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => setShowPeople(true)}>
                <Button.Icon as={RiAddLine} />
                {t("addFromPeople")}
              </Button.Root>
              <Button.Root variant="primary" mode="filled" size="xsmall" onClick={openPicker} disabled={!!pendingImportFile}>
                <Button.Icon as={RiUploadCloud2Line} />
                {t("import")}
              </Button.Root>
            </div>
          }
        />
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file); }} />

        <FramePanel className="p-2 sm:p-3">
          {uploadResult && (
            <div
              role={uploadResult.ok ? "status" : "alert"}
              className={cn(
                "mb-3 flex flex-col gap-2 rounded-xl px-3 py-2.5 text-paragraph-sm sm:flex-row sm:items-center sm:justify-between",
                uploadResult.ok ? "bg-success-lighter text-success-dark" : "bg-error-lighter text-error-dark",
              )}
            >
              <span className="flex items-center gap-2">
                {uploadResult.ok ? <RiCheckboxCircleLine className="size-4 shrink-0" /> : <RiErrorWarningLine className="size-4 shrink-0" />}
                {uploadResult.message}
              </span>
              <div className="flex items-center gap-2">
                {uploadResult.failedFileBase64 && uploadResult.failedFileName && (
                  <Button.Root
                    variant="neutral"
                    mode="stroke"
                    size="xxsmall"
                    onClick={() =>
                      downloadBase64File(uploadResult.failedFileBase64!, uploadResult.failedFileName!, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    }
                  >
                    <Button.Icon as={RiDownloadLine} />
                    {t("downloadFailedRows")}
                  </Button.Root>
                )}
                <Button.Root variant="neutral" mode="ghost" size="xxsmall" onClick={() => setUploadResult(null)}>{t("dismiss")}</Button.Root>
              </div>
            </div>
          )}
          {uploadResult?.crossCampaignNotices && uploadResult.crossCampaignNotices.length > 0 && (
            <p className="mb-3 rounded-xl bg-warning-lighter px-3 py-2.5 text-paragraph-xs text-warning-dark">
              {t("crossNotice", { count: uploadResult.crossCampaignNotices.length })}{" "}
              {uploadResult.crossCampaignNotices.slice(0, 5).map((n, i) => (
                <span key={n.linkedinUrl}>
                  {i > 0 && ", "}
                  <span className="font-medium">{n.name ?? n.linkedinUrl}</span> {t("alsoIn", { campaigns: n.alsoInCampaigns.map((c) => c.name).join(", ") })}
                </span>
              ))}
              {uploadResult.crossCampaignNotices.length > 5 && ` ${t("andMore", { count: uploadResult.crossCampaignNotices.length - 5 })}`}
            </p>
          )}

          {totalLeads === 0 ? (
            <EmptyState
              icon={RiTeamLine}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => setShowPeople(true)}>
                    <Button.Icon as={RiAddLine} />
                    {t("addFromPeople")}
                  </Button.Root>
                  <Button.Root variant="primary" mode="filled" size="small" onClick={openPicker} disabled={!!pendingImportFile}>
                    <Button.Icon as={RiUploadCloud2Line} />
                    {t("importSpreadsheet")}
                  </Button.Root>
                </div>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
                <Select.Root size="small" value={filterStatus || ALL} onValueChange={(v) => applyLeadFilters({ status: v === ALL ? "" : v })}>
                  <Select.Trigger className="w-full sm:w-48" aria-label={t("filterStatusLabel")}>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>{t("allStatuses")}</Select.Item>
                    {statusOptions.map(([key, meta]) => (
                      <Select.Item key={key} value={key}>
                        {statusLabel(key, meta.label)} <span className="tabular-nums text-text-soft-400">{format.number(statusCounts[key] ?? 0)}</span>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>

                {senderOptions.length > 0 && (
                  <Select.Root size="small" value={filterAccountId || ALL} onValueChange={(v) => applyLeadFilters({ accountId: v === ALL ? "" : v })}>
                    <Select.Trigger className="w-full sm:w-52" aria-label={t("filterSenderLabel")}>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value={ALL}>{t("allSenders")}</Select.Item>
                      {senderOptions.map((a) => (
                        <Select.Item key={a.id} value={a.id}>{a.name ?? `@${a.username}`}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}

                <Input.Root size="small" className="w-full sm:ml-auto sm:w-72">
                  <Input.Wrapper>
                    <Input.Icon as={RiSearchLine} />
                    <Input.Input
                      type="search"
                      aria-label={t("searchLabel")}
                      placeholder={t("searchPlaceholder")}
                      value={filterSearch}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFilterSearch(v);
                        if (searchTimeout.current) clearTimeout(searchTimeout.current);
                        searchTimeout.current = setTimeout(() => applyLeadFilters({ search: v }), 300);
                      }}
                    />
                  </Input.Wrapper>
                </Input.Root>

                {hasLeadFilters && (
                  <Button.Root variant="neutral" mode="ghost" size="xsmall" onClick={() => applyLeadFilters({ status: "", search: "", accountId: "" })}>
                    {t("clearFilters")}
                  </Button.Root>
                )}
              </div>

              {pagination.total === 0 && !loading ? (
                <EmptyState
                  icon={RiSearchLine}
                  title={t("noMatchTitle")}
                  description={t("noMatchDescription")}
                  action={
                    <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => applyLeadFilters({ status: "", search: "", accountId: "" })}>
                      {t("clearFilters")}
                    </Button.Root>
                  }
                />
              ) : (
                <>
                  <div className="px-1">
                    <LeadBulkActionBar
                      selectedCount={selectedCount}
                      pageCount={pageIds.length}
                      totalCount={pagination.total}
                      allPageSelected={allPageSelected}
                      allMatchingSelected={allMatchingSelected}
                      onSelectAllMatching={handleSelectAllMatching}
                      onClear={clearSelection}
                      onDelete={handleBulkDelete}
                      deleting={bulkDeleting}
                      selectingAll={selectingAll}
                    />
                  </div>
                  <div aria-busy={loading || undefined} className={cn("overflow-x-auto transition-opacity duration-200", loading && "opacity-60")}>
                    <Table.Root className="min-w-[900px]">
                      <Table.Header>
                        <Table.Row>
                          <Table.Head scope="col" className="w-12 px-4">
                            <Checkbox.Root
                              aria-label={t("selectAllLabel")}
                              checked={allMatchingSelected || allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                              onCheckedChange={(checked) => {
                                if (checked !== true) { clearSelection(); return; }
                                setSelectedIds((prev) => toggleAllOnPage(prev, pageIds, true));
                              }}
                            />
                          </Table.Head>
                          <Table.Head scope="col" className="px-4">{t("colLead")}</Table.Head>
                          <Table.Head scope="col" className="w-36 px-4">{t("colStatus")}</Table.Head>
                          <Table.Head scope="col" className="w-48 px-4">{t("colSender")}</Table.Head>
                          <Table.Head scope="col" className="w-36 px-4" title={t("colMessagesTitle")}>{t("colMessages")}</Table.Head>
                          <Table.Head scope="col" className="w-14 px-4"><span className="sr-only">{t("colActions")}</span></Table.Head>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body spacing={4}>
                        {leads.length === 0 && loading
                          ? Array.from({ length: 6 }, (_, i) => (
                              <Table.Row key={i}>
                                <Table.Cell colSpan={6} className="h-14 px-4">
                                  <div className="flex items-center gap-3">
                                    <Skeleton className="size-8 rounded-full" />
                                    <div className="flex-1 space-y-1.5">
                                      <Skeleton className="h-3.5 w-48" />
                                      <Skeleton className="h-3 w-72 max-w-full" />
                                    </div>
                                  </div>
                                </Table.Cell>
                              </Table.Row>
                            ))
                          : leads.map((lead) => {
                              const displayName = lead.name ?? lead.linkedinUrl;
                              const editableCount = MESSAGE_FIELDS.filter((k) => isMessageEditable(k, lead.status)).length;
                              const status = LEAD_STATUS[lead.status];
                              const selected = selectedIds.has(lead.id);
                              return (
                                <Table.Row
                                  key={lead.id}
                                  tabIndex={0}
                                  aria-selected={selected}
                                  onClick={() => setSelectedLeadId(lead.id)}
                                  onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === "Enter") setSelectedLeadId(lead.id); }}
                                  className={cn(
                                    "cursor-pointer outline-none focus-visible:[&>td]:bg-bg-weak-50",
                                    (selectedLeadId === lead.id || selected) && "[&>td]:bg-bg-weak-50",
                                    deletingId === lead.id && "pointer-events-none opacity-60",
                                  )}
                                >
                                  <Table.Cell className="h-14 px-4" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                    <Checkbox.Root
                                      aria-label={t("selectLead", { name: displayName })}
                                      checked={selected}
                                      onCheckedChange={(checked) => {
                                        const on = checked === true;
                                        if (!on) setAllMatchingSelected(false);
                                        setSelectedIds((prev) => toggleLeadSelection(prev, lead.id, on));
                                      }}
                                    />
                                  </Table.Cell>
                                  <Table.Cell className="px-4 py-2">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <LeadAvatar src={lead.profilePictureUrl} name={displayName} />
                                      <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                          <span className="truncate text-label-sm text-text-strong-950" title={displayName}>{displayName}</span>
                                          <a
                                            href={`https://www.linkedin.com/in/${lead.linkedinUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            aria-label={t("openLeadOnLinkedIn", { name: displayName })}
                                            title={t("openOnLinkedIn")}
                                            className="shrink-0 rounded text-text-soft-400 outline-none transition hover:text-text-strong-950 focus-visible:ring-2 focus-visible:ring-primary-base"
                                          >
                                            <RiExternalLinkLine className="size-3.5" />
                                          </a>
                                        </div>
                                        {(lead.headline || (lead.alsoInCampaigns && lead.alsoInCampaigns.length > 0)) && (
                                          <div className="flex min-w-0 items-center gap-2">
                                            {lead.headline && (
                                              <p className="min-w-0 max-w-md truncate text-paragraph-xs text-text-sub-600" title={lead.headline}>{lead.headline}</p>
                                            )}
                                            {lead.alsoInCampaigns && lead.alsoInCampaigns.length > 0 && (
                                              <Badge.Root
                                                size="small"
                                                variant="lighter"
                                                color="orange"
                                                className="max-w-56 shrink-0"
                                                title={t("alsoInTitle", { names: lead.alsoInCampaigns.map((c) => c.name).join(", ") })}
                                              >
                                                <span className="truncate">
                                                  {t("alsoInBadge", { name: lead.alsoInCampaigns[0]!.name, more: lead.alsoInCampaigns.length - 1 })}
                                                </span>
                                              </Badge.Root>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </Table.Cell>
                                  <Table.Cell className="px-4">
                                    <Badge.Root size="medium" variant="lighter" color={status?.color ?? "gray"}>
                                      <Badge.Dot />
                                      {statusLabel(lead.status, status?.label)}
                                    </Badge.Root>
                                  </Table.Cell>
                                  <Table.Cell className="px-4">
                                    {lead.linkedInAccount ? (
                                      <LinkedInAccountTag account={lead.linkedInAccount} />
                                    ) : (
                                      <span className="text-paragraph-sm text-text-soft-400">—</span>
                                    )}
                                  </Table.Cell>
                                  <Table.Cell className="px-4">
                                    {editableCount > 0 ? (
                                      <span className="inline-flex items-center gap-1 text-paragraph-sm text-text-sub-600">
                                        <RiPencilLine className="size-3.5 text-text-soft-400" />
                                        {t("editable", { count: editableCount })}
                                      </span>
                                    ) : (
                                      <span className="text-paragraph-sm text-text-soft-400">{t("allSent")}</span>
                                    )}
                                  </Table.Cell>
                                  <Table.Cell className="px-4" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                    <div className="flex justify-end">
                                      <Dropdown.Root>
                                        <Dropdown.Trigger asChild>
                                          <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={deletingId === lead.id} aria-label={t("moreActions", { name: displayName })}>
                                            <Button.Icon as={deletingId === lead.id ? RiLoader4Line : RiMoreLine} className={cn(deletingId === lead.id && "animate-spin")} />
                                          </Button.Root>
                                        </Dropdown.Trigger>
                                        <Dropdown.Content>
                                          <Dropdown.Item onSelect={() => setSelectedLeadId(lead.id)}>
                                            <Dropdown.ItemIcon as={RiPencilLine} />
                                            {t("viewEdit")}
                                          </Dropdown.Item>
                                          <Dropdown.Item onSelect={() => window.open(`https://www.linkedin.com/in/${lead.linkedinUrl}`, "_blank", "noopener,noreferrer")}>
                                            <Dropdown.ItemIcon as={RiExternalLinkLine} />
                                            {t("openOnLinkedIn")}
                                          </Dropdown.Item>
                                          <Dropdown.Separator />
                                          <Dropdown.Item destructive onSelect={() => void handleDeleteLead(lead)}>
                                            <Dropdown.ItemIcon as={RiDeleteBinLine} />
                                            {t("removeLead")}
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
                  </div>

                  {pagination.pages > 1 && (
                    <div className="mt-2 flex items-center justify-between gap-3 border-t border-stroke-soft-200 px-1 pt-3">
                      <p className="text-paragraph-xs text-text-sub-600">
                        {t("pageInfo", { page: pagination.page, pages: pagination.pages, total: pagination.total })}
                      </p>
                      <div className="flex gap-2">
                        <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={pagination.page <= 1 || loading} onClick={() => { clearSelection(); void fetchLeads(pagination.page - 1); }}>
                          <Button.Icon as={RiArrowLeftSLine} />
                          {t("prev")}
                        </Button.Root>
                        <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={pagination.page >= pagination.pages || loading} onClick={() => { clearSelection(); void fetchLeads(pagination.page + 1); }}>
                          {t("next")}
                          <Button.Icon as={RiArrowRightSLine} />
                        </Button.Root>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </FramePanel>
      </Frame>

      <LeadDetailPanel
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onMessagesSaved={(id, updates) => setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))}
      />

      {showPeople && (
        <AddPeopleToCampaignModal campaignId={campaignId} channel="linkedin" onClose={() => setShowPeople(false)} onAdded={onChanged} />
      )}

      {pendingImportFile && (
        <CampaignCsvMappingDialog
          file={pendingImportFile}
          endpoint={`/api/linkedin/campaigns/${campaignId}/upload`}
          channel="linkedin"
          onClose={() => {
            setPendingImportFile(null);
            if (fileRef.current) fileRef.current.value = "";
          }}
          onImported={(data) => {
            const created = Number(data.created ?? 0);
            const attached = Number(data.attached ?? 0);
            const failed = Number(data.failed ?? 0);
            setUploadResult({
              ok: true,
              message: t("importSummary", { created, attached, failed }),
              ...(typeof data.failedFileBase64 === "string" && typeof data.failedFileName === "string"
                ? { failedFileBase64: data.failedFileBase64, failedFileName: data.failedFileName }
                : {}),
              ...(Array.isArray(data.crossCampaignNotices) ? { crossCampaignNotices: data.crossCampaignNotices as CrossCampaignNotice[] } : {}),
            });
            setPendingImportFile(null);
            if (fileRef.current) fileRef.current.value = "";
            onChanged();
            void fetchLeads(1);
          }}
        />
      )}
    </>
  );
}
