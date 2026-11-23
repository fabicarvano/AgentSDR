"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiLinkedinBoxLine,
  RiLoader4Line,
  RiMoreLine,
  RiSearchLine,
  RiUploadCloud2Line,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as AlignButton from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as Table from "@/components/alignui/table";
import { CapacityMeter } from "@/components/analytics/kit/CapacityMeter";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import { DocsLink } from "@/components/page/DocsLink";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { DAILY_SEARCH_LEAD_LIMIT, getSearchUsage } from "@/lib/linkedin/searchLeadLimit";
import {
  SearchAccountPicker,
  loadStoredRunAccountIds,
  storeRunAccountIds,
  type SearchPickerAccount,
} from "@/components/linkedin/SearchAccountPicker";
import { cn } from "@/utils/cn";
import type { SearchBatchSummary } from "@/lib/linkedin/searchBatches";
import type { SearchQueryStatus } from "@/lib/linkedin/schema";
import { STATUS_META, type BadgeColor, type StatusLabelKey } from "./searchStatus";

export type SearchAccount = SearchPickerAccount & { profilePictureUrl: string | null };

function rollupStatus(counts: Partial<Record<SearchQueryStatus, number>>): { labelKey: StatusLabelKey; color: BadgeColor } {
  if ((counts.RUNNING ?? 0) > 0) return STATUS_META.RUNNING;
  if ((counts.QUEUED ?? 0) > 0) return STATUS_META.QUEUED;
  if ((counts.PAUSED_LIMIT ?? 0) > 0) return STATUS_META.PAUSED_LIMIT;
  if ((counts.FAILED ?? 0) > 0) return STATUS_META.FAILED;
  if ((counts.COMPLETED ?? 0) > 0) return STATUS_META.COMPLETED;
  return { labelKey: "noUrls", color: "gray" };
}

/** "12 of 69 URLs done" under the status — how far a search has got, not just its state. */
function progressLabel(batch: SearchBatchSummary, t: ReturnType<typeof useTranslations<"linkedinSearch.batches">>): string | null {
  if (batch.queryCount === 0) return null;
  const c = batch.statusCounts;
  const done = (c.COMPLETED ?? 0) + (c.FAILED ?? 0) + (c.CANCELLED ?? 0);
  if (done === batch.queryCount) {
    const failed = c.FAILED ?? 0;
    return failed > 0 ? t("progressFailed", { failed, total: batch.queryCount }) : null;
  }
  return t("progressDone", { done, total: batch.queryCount });
}

const num = "text-paragraph-sm tabular-nums text-text-strong-950";

function RowMenu({ name, onOpen, onDelete, deleting }: { name: string; onOpen: () => void; onDelete: () => void; deleting: boolean }) {
  const tRow = useTranslations("linkedinSearch.batches.rowMenu");
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <AlignButton.Root variant="neutral" mode="ghost" size="xsmall" disabled={deleting} aria-label={tRow("actionsFor", { name })}>
          <AlignButton.Icon as={deleting ? RiLoader4Line : RiMoreLine} className={cn(deleting && "animate-spin")} />
        </AlignButton.Root>
      </Dropdown.Trigger>
      <Dropdown.Content align="end">
        <Dropdown.Item onSelect={onOpen}>
          <Dropdown.ItemIcon as={RiExternalLinkLine} />
          {tRow("open")}
        </Dropdown.Item>
        <Dropdown.Separator />
        <Dropdown.Item destructive onSelect={onDelete} disabled={deleting}>
          <Dropdown.ItemIcon as={RiDeleteBinLine} />
          {tRow("delete")}
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}

/** Label above an AlignUI input, for the New search modal. */
function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-label-sm text-text-strong-950">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextField({ id, value, onChange, placeholder, autoFocus, mono }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; mono?: boolean }) {
  return (
    <Input.Root size="small">
      <Input.Wrapper>
        <Input.Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className={cn(mono && "font-mono text-paragraph-xs")} />
      </Input.Wrapper>
    </Input.Root>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-center gap-1.5 text-paragraph-sm text-error-base">
      <RiErrorWarningLine className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/**
 * Today's search quota per connected account, as meters: each account can pull
 * DAILY_SEARCH_LEAD_LIMIT leads a day, and a full account is skipped by runs.
 */
function CapacityCard({ accounts }: { accounts: SearchAccount[] }) {
  const tCap = useTranslations("linkedinSearch.batches.capacity");
  const used = accounts.reduce((sum, a) => sum + Math.min(a.searchLeadsToday, a.searchLimit), 0);
  const total = accounts.reduce((sum, a) => sum + a.searchLimit, 0);
  const full = accounts.filter((a) => getSearchUsage(a.searchLeadsToday, a.searchLimit).limitReached).length;
  const perAccount = accounts[0]?.searchLimit ?? DAILY_SEARCH_LEAD_LIMIT;
  return (
    <Frame>
      <FrameHeader
        title={tCap("title")}
        description={
          accounts.length === 0
            ? tCap("noAccountsDescription")
            : tCap(full > 0 ? "summaryAtLimit" : "summary", { used, total, accounts: accounts.length, full, perAccount })
        }
      />
      <FramePanel>
        {accounts.length === 0 ? (
          <EmptyState
            compact
            icon={RiLinkedinBoxLine}
            title={tCap("emptyTitle")}
            description={tCap("emptyDescription")}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <AlignButton.Root variant="neutral" mode="stroke" size="xsmall" asChild>
                  <Link href="/settings/linkedin-accounts">{tCap("accountsLink")}</Link>
                </AlignButton.Root>
                <DocsLink page="linkedin/accounts#add-a-linkedin-account" size="xsmall" />
              </div>
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-x-5 gap-y-5 sm:gap-x-8 lg:grid-cols-4">
            {accounts.map((a) => (
              <li key={a.id} className="min-w-0">
                <CapacityMeter label={a.name ?? `@${a.username}`} detail={a.name ? `@${a.username}` : undefined} used={a.searchLeadsToday} limit={a.searchLimit} />
              </li>
            ))}
          </ul>
        )}
      </FramePanel>
    </Frame>
  );
}

type NewSearchKind = "SINGLE" | "BULK" | null;

export function SearchBatchesClient({
  initialBatches,
  accounts: initialAccounts,
}: {
  initialBatches: SearchBatchSummary[];
  accounts: SearchAccount[];
}) {
  const dialogs = useDialogs();
  const router = useRouter();
  const t = useTranslations("linkedinSearch.batches");
  const tStatus = useTranslations("linkedinSearch.status");
  const format = useFormatter();
  const formatDate = (iso: string) => format.dateTime(new Date(iso), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const [batches, setBatches] = useState(initialBatches);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const [batchesRes, accountsRes] = await Promise.all([
      fetch("/api/linkedin/search/batches"),
      fetch("/api/linkedin/accounts"),
    ]);
    const batchesData = await batchesRes.json();
    if (batchesData.ok) setBatches(batchesData.batches);
    const accountsData = await accountsRes.json();
    if (accountsData.accounts) {
      setAccounts(
        accountsData.accounts
          .filter((a: { status: string }) => a.status === "CONNECTED")
          .map((a: SearchAccount) => ({
            id: a.id,
            username: a.username,
            name: a.name,
            profilePictureUrl: a.profilePictureUrl,
            searchLeadsToday: a.searchLeadsToday,
          })),
      );
    }
  }, []);

  const hasActive = useMemo(
    () => batches.some((b) => (b.statusCounts.QUEUED ?? 0) > 0 || (b.statusCounts.RUNNING ?? 0) > 0),
    [batches],
  );

  useEffect(() => {
    if (!hasActive) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      refresh();
    }, 3000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasActive, refresh]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return batches;
    return batches.filter((b) => b.name.toLowerCase().includes(term));
  }, [batches, search]);

  const handleDelete = async (batch: SearchBatchSummary) => {
    if (deletingId) return;
    const ok = await dialogs.confirm({
      title: t("delete.confirmTitle"),
      description: t("delete.confirmDescription"),
      confirmLabel: t("delete.confirm"),
      variant: "error",
    });
    if (!ok) return;
    setDeletingId(batch.id);
    try {
      const res = await fetch(`/api/linkedin/search/batches/${batch.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        await dialogs.alert({
          title: t("delete.errorTitle"),
          description: typeof data.error === "string" ? data.error : t("delete.errorFallback"),
          variant: "error",
        });
        return;
      }
      setBatches((prev) => prev.filter((b) => b.id !== batch.id));
    } finally {
      setDeletingId(null);
    }
  };

  /* -------------------------------------------------------------------
   * New search dialog
   * ---------------------------------------------------------------- */
  const [newOpen, setNewOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [kind, setKind] = useState<NewSearchKind>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [singleName, setSingleName] = useState("");
  const [singleUrl, setSingleUrl] = useState("");
  const [singleCompany, setSingleCompany] = useState("");
  const [singleAccountId, setSingleAccountId] = useState<string | null>(null);

  const [csvName, setCsvName] = useState("");
  // An ordered list, not a Set: the order is the order the accounts get used in.
  const [csvAccountOrder, setCsvAccountOrder] = useState<string[]>([]);
  const csvAccountIds = useMemo(() => new Set(csvAccountOrder), [csvAccountOrder]);
  const csvFileRef = useRef<HTMLInputElement>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  const resetNewDialog = () => {
    setStep(1);
    setKind(null);
    setCreateError(null);
    setSingleName("");
    setSingleUrl("");
    setSingleCompany("");
    setSingleAccountId(null);
    setCsvName("");
    setCsvAccountOrder([]);
    setCsvFileName(null);
    if (csvFileRef.current) csvFileRef.current.value = "";
  };

  const openNew = () => {
    resetNewDialog();
    setNewOpen(true);
  };

  const chooseKind = (k: Exclude<NewSearchKind, null>) => {
    setKind(k);
    setCreateError(null);
    if (k === "BULK") {
      // The remembered list is already in the user's chosen order; keep it.
      const stored = loadStoredRunAccountIds();
      const connectedIds = accounts.map((a) => a.id);
      const remembered = stored?.filter((id) => connectedIds.includes(id)) ?? [];
      setCsvAccountOrder(remembered.length > 0 ? remembered : connectedIds);
    }
    setStep(2);
  };

  const handleCreateSingle = async () => {
    if (!singleName.trim() || !singleUrl.trim() || !singleAccountId) {
      setCreateError(t("dialog.errorSingleRequired"));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/linkedin/search/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: singleName.trim(),
          kind: "SINGLE",
          urls: [{ url: singleUrl.trim(), companyName: singleCompany.trim() || undefined }],
          accountIds: [singleAccountId],
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setCreateError(typeof data.error === "string" ? data.error : t("dialog.errorCreateFailed"));
        return;
      }
      setNewOpen(false);
      // Nothing is running yet — the search opens with its URLs queued, ready for Run.
      router.push(`/linkedin/search/${data.id}`);
    } catch {
      setCreateError(t("dialog.errorNetwork"));
    } finally {
      setCreating(false);
    }
  };

  const handleCreateCsv = async () => {
    if (!csvName.trim()) {
      setCreateError(t("dialog.errorNameRequired"));
      return;
    }
    const file = csvFileRef.current?.files?.[0];
    if (!file) {
      setCreateError(t("dialog.errorChooseFile"));
      return;
    }
    const ids = csvAccountOrder;
    setCreating(true);
    setCreateError(null);
    try {
      storeRunAccountIds(ids);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", csvName.trim());
      formData.append("accountIds", JSON.stringify(ids));
      const res = await fetch("/api/linkedin/search/batches/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.ok) {
        setCreateError(typeof data.error === "string" ? data.error : t("dialog.errorCreateFailed"));
        return;
      }
      setNewOpen(false);
      router.push(`/linkedin/search/${data.id}`);
    } catch {
      setCreateError(t("dialog.errorNetwork"));
    } finally {
      setCreating(false);
    }
  };

  const toggleCsvAccount = (id: string) => {
    // Newly checked accounts go to the end of the order, so checking them in the
    // order you want them used does the obvious thing without any dragging.
    setCsvAccountOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const open = (id: string) => {
    if (deletingId !== id) router.push(`/linkedin/search/${id}`);
  };

  const newSearchButton = (
    <AlignButton.Root variant="primary" mode="filled" size="small" onClick={openNew}>
      <AlignButton.Icon as={RiAddLine} />
      {t("newSearch")}
    </AlignButton.Root>
  );

  const kindCard = (k: Exclude<NewSearchKind, null>, title: string, body: string, Icon: typeof RiSearchLine) => (
    <button
      type="button"
      onClick={() => chooseKind(k)}
      className="flex gap-3 rounded-xl p-4 text-left ring-1 ring-inset ring-stroke-soft-200 outline-none transition hover:bg-bg-weak-50 hover:ring-primary-base focus-visible:ring-2 focus-visible:ring-primary-base"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200">
        <Icon className="size-4 text-text-sub-600" />
      </span>
      <span>
        <span className="block text-label-sm text-text-strong-950">{title}</span>
        <span className="mt-1 block text-paragraph-xs text-text-sub-600">{body}</span>
      </span>
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader title={t("title")} description={t("description")} actions={newSearchButton} />

      <div className="mt-6">
        <CapacityCard accounts={accounts} />
      </div>

      <Frame className="mt-5">
        <FrameHeader
          title={t("list.title")}
          description={batches.length === 0 ? t("list.emptyDescription") : t(hasActive ? "list.summaryLive" : "list.summary", { count: batches.length })}
          actions={
            batches.length > 0 && (
              <Input.Root size="small" className="w-44 sm:w-64">
                <Input.Wrapper>
                  <Input.Icon as={RiSearchLine} />
                  <Input.Input type="search" aria-label={t("list.searchLabel")} placeholder={t("list.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
                </Input.Wrapper>
              </Input.Root>
            )
          }
        />
        <FramePanel className="overflow-x-auto p-2 sm:p-2">
          {filtered.length === 0 ? (
            batches.length === 0 ? (
              <EmptyState icon={RiSearchLine} title={t("list.noneTitle")} description={t("list.noneDescription")} action={newSearchButton} />
            ) : (
              <EmptyState
                icon={RiSearchLine}
                title={t("list.noMatchTitle")}
                description={t("list.noMatchDescription", { term: search.trim() })}
                action={
                  <AlignButton.Root variant="neutral" mode="stroke" size="small" onClick={() => setSearch("")}>
                    {t("list.clearSearch")}
                  </AlignButton.Root>
                }
              />
            )
          ) : (
            <Table.Root className="[&>table]:min-w-[820px]">
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col" className="px-4">{t("table.search")}</Table.Head>
                  <Table.Head scope="col" className="w-56 px-4">{t("table.status")}</Table.Head>
                  <Table.Head scope="col" className="w-24 px-4 text-right">{t("table.urls")}</Table.Head>
                  <Table.Head scope="col" className="w-24 px-4 text-right">{t("table.leads")}</Table.Head>
                  <Table.Head scope="col" className="w-44 px-4">{t("table.created")}</Table.Head>
                  <Table.Head scope="col" className="w-16 px-4"><span className="sr-only">{t("table.actions")}</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {filtered.map((b) => {
                  const status = rollupStatus(b.statusCounts);
                  const progress = progressLabel(b, t);
                  const isDeleting = deletingId === b.id;
                  const KindIcon = b.kind === "SINGLE" ? RiSearchLine : RiFileList3Line;
                  return (
                    <Table.Row
                      key={b.id}
                      tabIndex={0}
                      onClick={() => open(b.id)}
                      onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === "Enter") open(b.id); }}
                      aria-busy={isDeleting}
                      className={cn("cursor-pointer outline-none focus-visible:[&>td]:bg-bg-weak-50", isDeleting && "pointer-events-none opacity-60")}
                    >
                      <Table.Cell className="h-16 px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200">
                            <KindIcon className="size-4 text-text-sub-600" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-label-sm text-text-strong-950" title={b.name}>{b.name}</p>
                            <p className="mt-0.5 truncate text-paragraph-xs text-text-sub-600">
                              {isDeleting ? t("row.deleting") : b.kind === "SINGLE" ? t("row.kindSingle") : t("row.kindCsv")}
                            </p>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="px-4">
                        <Badge.Root size="medium" variant="lighter" color={status.color}>
                          <Badge.Dot />
                          {tStatus(status.labelKey)}
                        </Badge.Root>
                        {progress && <p className="mt-1 text-paragraph-xs tabular-nums text-text-sub-600">{progress}</p>}
                      </Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{format.number(b.queryCount)}</Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{format.number(b.leadCount)}</Table.Cell>
                      <Table.Cell className="whitespace-nowrap px-4 text-paragraph-sm text-text-sub-600" suppressHydrationWarning>
                        {formatDate(b.createdAt)}
                      </Table.Cell>
                      <Table.Cell className="px-4" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <RowMenu name={b.name} onOpen={() => router.push(`/linkedin/search/${b.id}`)} onDelete={() => handleDelete(b)} deleting={isDeleting} />
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

      <Modal.Root
        open={newOpen}
        onOpenChange={(o) => {
          setNewOpen(o);
          if (!o) resetNewDialog();
        }}
      >
        <Modal.Content size="max-w-lg">
          <Modal.Header>
            <Modal.Title>{step === 1 ? t("dialog.titleStart") : kind === "SINGLE" ? t("dialog.titleSingle") : t("dialog.titleCsv")}</Modal.Title>
            <Modal.Description>
              {step === 1
                ? t("dialog.descriptionStart")
                : kind === "SINGLE"
                  ? t("dialog.descriptionSingle")
                  : t("dialog.descriptionCsv")}
            </Modal.Description>
          </Modal.Header>

          {step === 1 && (
            <Modal.Body className="grid gap-3 sm:grid-cols-2">
              {kindCard("SINGLE", t("dialog.singleTitle"), t("dialog.singleBody"), RiSearchLine)}
              {kindCard("BULK", t("dialog.csvTitle"), t("dialog.csvBody"), RiFileList3Line)}
            </Modal.Body>
          )}

          {step === 2 && kind === "SINGLE" && (
            <Modal.Body className="space-y-4">
              <Field label={t("dialog.name")} htmlFor="single-name">
                <TextField id="single-name" value={singleName} onChange={setSingleName} placeholder={t("dialog.namePlaceholderSingle")} autoFocus />
              </Field>
              <Field label={t("dialog.searchUrl")} htmlFor="single-url">
                <TextField id="single-url" value={singleUrl} onChange={setSingleUrl} // Example URL, not translatable.
                placeholder="https://www.linkedin.com/search/results/people/?keywords=..." mono />
              </Field>
              <Field label={t("dialog.companyOptional")} htmlFor="single-company">
                <TextField id="single-company" value={singleCompany} onChange={setSingleCompany} />
              </Field>
              <Field label={t("dialog.account")}>
                <SearchAccountPicker
                  accounts={accounts}
                  selected={singleAccountId ? new Set([singleAccountId]) : new Set()}
                  onToggle={(id) => setSingleAccountId(id)}
                  mode="single"
                />
              </Field>
              {createError && <FormError message={createError} />}
            </Modal.Body>
          )}

          {step === 2 && kind === "BULK" && (
            <Modal.Body className="space-y-4">
              <Field label={t("dialog.name")} htmlFor="csv-name">
                <TextField id="csv-name" value={csvName} onChange={setCsvName} placeholder={t("dialog.namePlaceholderCsv")} autoFocus />
              </Field>
              <Field label={t("dialog.sheet")}>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={csvFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => setCsvFileName(e.target.files?.[0]?.name ?? null)}
                  />
                  <AlignButton.Root type="button" variant="neutral" mode="stroke" size="xsmall" onClick={() => csvFileRef.current?.click()} className="max-w-full">
                    <AlignButton.Icon as={RiUploadCloud2Line} />
                    <span className="truncate">{csvFileName ?? t("dialog.chooseFile")}</span>
                  </AlignButton.Root>
                  <AlignButton.Root variant="neutral" mode="ghost" size="xsmall" asChild>
                    <a href="/api/linkedin/search/queue/template" download="search-queue-template.xlsx">
                      <AlignButton.Icon as={RiDownloadLine} />
                      {t("dialog.downloadTemplate")}
                    </a>
                  </AlignButton.Root>
                </div>
              </Field>
              <Field label={t("dialog.accounts")}>
                <div className="rounded-xl p-2 ring-1 ring-inset ring-stroke-soft-200">
                  <SearchAccountPicker
                    accounts={accounts}
                    selected={csvAccountIds}
                    onToggle={toggleCsvAccount}
                    mode="multi"
                    order={csvAccountOrder}
                    onReorder={setCsvAccountOrder}
                    onSelectAll={() => setCsvAccountOrder(accounts.map((a) => a.id))}
                    onClear={() => setCsvAccountOrder([])}
                  />
                </div>
              </Field>
              {createError && <FormError message={createError} />}
            </Modal.Body>
          )}

          {step === 2 && (
            <Modal.Footer className="justify-between">
              <AlignButton.Root variant="neutral" mode="ghost" size="small" onClick={() => setStep(1)}>
                <AlignButton.Icon as={RiArrowLeftSLine} />
                {t("dialog.back")}
              </AlignButton.Root>
              <div className="flex gap-2">
                <AlignButton.Root variant="neutral" mode="stroke" size="small" onClick={() => setNewOpen(false)}>
                  {t("dialog.cancel")}
                </AlignButton.Root>
                <AlignButton.Root
                  variant="primary"
                  mode="filled"
                  size="small"
                  onClick={kind === "SINGLE" ? handleCreateSingle : handleCreateCsv}
                  disabled={creating || (kind === "BULK" && csvAccountIds.size === 0)}
                >
                  <AlignButton.Icon as={creating ? RiLoader4Line : RiCheckLine} className={cn(creating && "animate-spin")} />
                  {t("dialog.create")}
                </AlignButton.Root>
              </div>
            </Modal.Footer>
          )}
        </Modal.Content>
      </Modal.Root>
    </div>
  );
}
