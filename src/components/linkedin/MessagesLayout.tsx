"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Fragment, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDialogs } from "@/components/DialogProvider";
import {
  RiChatSmile3Line,
  RiCheckDoubleLine,
  RiExternalLinkLine,
  RiLayoutRightLine,
  RiLoader4Line,
  RiMessage3Line,
  RiSearchLine,
  RiUserSearchLine,
} from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Select from "@/components/alignui/select";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { CallButton } from "@/components/calls/CallButton";
import { LinkedInAccountTag } from "@/components/linkedin/LinkedInAccountTag";
import {
  CrmCategoryControl,
  CrmDraftCard,
  DoNotContactNotice,
  useInboxCrmText,
  type CrmCategoryOption,
} from "@/components/crm/InboxCrmStrip";
import { crmFetch } from "@/components/crm/crm-utils";
import { useCrmText } from "@/components/crm/useCrmText";
import { useLeadStatusLabel, useMessageTypeLabel } from "@/components/linkedin/LeadDetailPanel";
import {
  ActiveFilterChips,
  CategoryChip,
  ChannelTag,
  ConversationRow,
  DayHeading,
  DraftChip,
  FilterField,
  FilterPopover,
  HeaderAction,
  InboxAvatar,
  InboxLayout,
  ListCount,
  ListPane,
  ListSearch,
  ReadingEmpty,
  ReadingPane,
  RowBadge,
  RowMeta,
  RowsSkeleton,
  ThreadHeader,
  ThreadSkeleton,
  TriageTabs,
  dayKeyOf,
  useInboxTime,
  type BadgeTone,
  type TriageTab,
} from "@/components/inbox/shell/InboxShell";
import { Bubble, ChatComposer, ComposerDock, ComposerDraftBanner, DaySeparator, ExpandableText, MessageCaption } from "@/components/inbox/shell/Conversation";
import { ContactDetails, DetailsPanel, toLinkedinHref, useCrmRecordSummary, useDetailsPanel, useWorkflowLabel } from "@/components/inbox/shell/DetailsPanel";
import { useInboxHotkeys } from "@/components/inbox/shell/hotkeys";
import { cn } from "@/utils/cn";
import type { ConnectionItem } from "@/lib/linkedin/messages/connectionList";
import {
  ALL_LEADS_FILTER,
  CONNECTIONS_ONLY_FILTER,
  DEFAULT_MESSAGES_STATUS_FILTER,
  UNREPLIED_FILTER,
} from "@/lib/linkedin/messages/connectionList";
import type { InboxCrmContext } from "@/lib/linkedin/messages/crmContext";
import { inboxCrmStep } from "@/lib/linkedin/messages/crmContext";
import { useInboxCrmStepLabel } from "@/components/crm/useInboxCrmStepLabel";

export type { ConnectionItem };

type ThreadMessage = {
  id: string;
  type: string;
  text: string;
  seen: boolean;
  createdAt: string;
};

type FilterAccount = { id: string; username: string; name: string | null; profilePictureUrl: string | null };
type FilterCampaign = { id: string; name: string };

const SENT_TYPES = new Set(["INVITATION", "ACCEPTANCE", "FOLLOW_UP_1", "FOLLOW_UP_2", "FOLLOW_UP_3", "CUSTOM_SENT"]);

/** Lead status labels for this screen: the shared ones, except that REQUEST_SENT reads "Invited" here. */
function useMessageStatusLabel() {
  const t = useTranslations("linkedinMain.messages");
  const leadStatusLabel = useLeadStatusLabel();
  return (status: string): string => (status === "REQUEST_SENT" ? t("statusInvited") : leadStatusLabel(status));
}

/** Lead status → badge tone. Only outcomes wear a colour; the steps in between stay grey. */
const STATUS_TONE: Record<string, BadgeTone> = {
  REPLIED: "green",
  FAILED: "red",
  REQUEST_SENT: "orange",
};

/** Status scopes under which the list is CRM-tracked, so a category filter makes sense. */
const CRM_FILTERABLE_STATUSES = new Set<string>([DEFAULT_MESSAGES_STATUS_FILTER, UNREPLIED_FILTER]);

const CATEGORY_FILTER_PREFIX = "category:";

/** `category:<key>` or a bare subcategory id → the two query params. */
const splitCategoryFilter = (value: string, categories: CrmCategoryOption[]) => {
  if (!value) return { categoryKey: "", subcategoryId: "" };
  if (value.startsWith(CATEGORY_FILTER_PREFIX)) return { categoryKey: value.slice(CATEGORY_FILTER_PREFIX.length), subcategoryId: "" };
  const sub = categories.flatMap((c) => c.subcategories).find((sc) => sc.id === value);
  return { categoryKey: sub?.categoryKey ?? "", subcategoryId: value };
};

const ALL_STATUSES = ["PENDING", "REQUEST_SENT", "ACCEPT_MESSAGE_SENT", "FOLLOW_UP_1_SENT", "FOLLOW_UP_2_SENT", "FOLLOW_UP_3_SENT", "COMPLETED", "REPLIED", "FAILED"];

/** The period select stores the number of days as its value; the label comes from the catalog. */
const TIME_PERIODS = [
  { value: "7", days: 7, labelKey: "period7" },
  { value: "30", days: 30, labelKey: "period30" },
  { value: "90", days: 90, labelKey: "period90" },
] as const;

const filtersKeyFrom = (filters: {
  search: string;
  campaignId: string;
  accountId: string;
  status: string;
  periodDays: number | null;
  categoryKey: string;
  subcategoryId: string;
}) =>
  JSON.stringify({
    search: filters.search,
    campaignId: filters.campaignId,
    accountId: filters.accountId,
    status: filters.status,
    periodDays: filters.periodDays,
    categoryKey: filters.categoryKey,
    subcategoryId: filters.subcategoryId,
  });

const DEFAULT_FILTERS_KEY = filtersKeyFrom({
  search: "",
  campaignId: "",
  accountId: "",
  status: DEFAULT_MESSAGES_STATUS_FILTER,
  periodDays: null,
  categoryKey: "",
  subcategoryId: "",
});

type InitialList = {
  connections: ConnectionItem[];
  totalCount: number;
  hasMore: boolean;
};

/** Row-level status: the CRM category when the thread is CRM-tracked, else the lead status. */
function RowStatus({ conn }: { conn: ConnectionItem }) {
  const { categoryLabel } = useInboxCrmText();
  const statusLabel = useMessageStatusLabel();
  if (conn.crm) return <CategoryChip categoryKey={conn.crm.categoryKey} label={categoryLabel(conn.crm)} />;
  if (!conn.leadStatus) return null;
  return <RowBadge tone={STATUS_TONE[conn.leadStatus] ?? "gray"}>{statusLabel(conn.leadStatus)}</RowBadge>;
}

export function MessagesLayout({
  campaigns,
  accounts,
  initialList,
}: {
  campaigns: FilterCampaign[];
  accounts: FilterAccount[];
  initialList: InitialList;
}) {
  const t = useTranslations("linkedinMain.messages");
  const format = useFormatter();
  const dialogs = useDialogs();
  const { errorMessage, categoryLabel: crmKeyLabel } = useCrmText();
  const { categoryLabel: crmCategoryLabel } = useInboxCrmText();
  const { fullTime, rowTime, withRecencyBreaks } = useInboxTime();
  const workflowLabel = useWorkflowLabel();
  const crmStepLabel = useInboxCrmStepLabel();
  const messageTypeLabel = useMessageTypeLabel();
  const statusLabel = useMessageStatusLabel();
  const [connections, setConnections] = useState(initialList.connections);
  const [totalCount, setTotalCount] = useState(initialList.totalCount);
  const [hasMore, setHasMore] = useState(initialList.hasMore);
  const [listPage, setListPage] = useState(1);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastLoadedFiltersKeyRef = useRef(DEFAULT_FILTERS_KEY);
  const [selected, setSelected] = useState<ConnectionItem | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [crmContext, setCrmContext] = useState<InboxCrmContext | null>(null);
  /** The CRM draft the operator chose to send as; resolved against the live context below. */
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  /** While set, the CRM context is polled for the regenerated draft until this time (ms). */
  const [draftWatchUntil, setDraftWatchUntil] = useState<number | null>(null);
  /** Draft that reclassification superseded — seeing it again does not end the watch. */
  const supersededDraftIdRef = useRef<string | null>(null);
  const [crmCategories, setCrmCategories] = useState<CrmCategoryOption[]>([]);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadAbortRef = useRef<AbortController | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const listSentinelRef = useRef<HTMLDivElement>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(DEFAULT_MESSAGES_STATUS_FILTER);
  const [periodFilter, setPeriodFilter] = useState("");
  /** `category:<key>` or a subcategory id; only meaningful under a CRM-tracked status scope. */
  const [categoryFilter, setCategoryFilter] = useState("");

  const periodDays = periodFilter
    ? (TIME_PERIODS.find((p) => p.value === periodFilter)?.days ?? null)
    : null;

  const showCategoryFilter = CRM_FILTERABLE_STATUSES.has(statusFilter);
  const { categoryKey: categoryKeyFilter, subcategoryId: subcategoryIdFilter } = splitCategoryFilter(
    showCategoryFilter ? categoryFilter : "",
    crmCategories
  );

  useEffect(() => {
    let cancelled = false;
    crmFetch<{ categories?: CrmCategoryOption[] }>("/categories")
      .then((data) => {
        if (!cancelled) setCrmCategories(Array.isArray(data?.categories) ? data.categories : []);
      })
      .catch(() => {
        /* no CRM taxonomy: the filter and picker stay empty */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const buildConnectionsQuery = useCallback(
    (page: number) => {
      const q = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) q.set("search", debouncedSearch);
      if (campaignFilter) q.set("campaignId", campaignFilter);
      if (accountFilter) q.set("accountId", accountFilter);
      q.set("status", statusFilter);
      if (periodDays) q.set("periodDays", String(periodDays));
      if (categoryKeyFilter) q.set("categoryKey", categoryKeyFilter);
      if (subcategoryIdFilter) q.set("subcategoryId", subcategoryIdFilter);
      return q;
    },
    [debouncedSearch, campaignFilter, accountFilter, statusFilter, periodDays, categoryKeyFilter, subcategoryIdFilter]
  );

  const fetchConnectionsPage = useCallback(
    async (page: number) => {
      const res = await fetch(`/api/linkedin/messages/connections?${buildConnectionsQuery(page)}`);
      const data = await res.json();
      if (!data.ok) return null;
      return data as {
        connections: ConnectionItem[];
        totalCount: number;
        hasMore: boolean;
        page: number;
      };
    },
    [buildConnectionsQuery]
  );

  useEffect(() => {
    const filtersKey = filtersKeyFrom({
      search: debouncedSearch,
      campaignId: campaignFilter,
      accountId: accountFilter,
      status: statusFilter,
      periodDays: periodDays ?? null,
      categoryKey: categoryKeyFilter,
      subcategoryId: subcategoryIdFilter,
    });

    if (filtersKey === lastLoadedFiltersKeyRef.current) return;

    let cancelled = false;
    setLoadingList(true);
    setListPage(1);

    (async () => {
      const data = await fetchConnectionsPage(1);
      if (cancelled || !data) {
        if (!cancelled) setLoadingList(false);
        return;
      }
      setConnections(data.connections);
      setTotalCount(data.totalCount);
      setHasMore(data.hasMore);
      setListPage(data.page);
      lastLoadedFiltersKeyRef.current = filtersKey;
      setLoadingList(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchConnectionsPage, debouncedSearch, campaignFilter, accountFilter, statusFilter, periodDays, categoryKeyFilter, subcategoryIdFilter]);

  const loadMoreConnections = useCallback(async () => {
    if (loadingMore || loadingList || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = listPage + 1;
      const data = await fetchConnectionsPage(nextPage);
      if (!data) return;
      setConnections((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        const added = data.connections.filter((c) => !seen.has(c.id));
        return [...prev, ...added];
      });
      setTotalCount(data.totalCount);
      setHasMore(data.hasMore);
      setListPage(data.page);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchConnectionsPage, hasMore, listPage, loadingList, loadingMore]);

  useEffect(() => {
    const root = listScrollRef.current;
    const target = listSentinelRef.current;
    if (!root || !target || !hasMore || loadingList || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreConnections();
      },
      { root, rootMargin: "80px", threshold: 0 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMoreConnections, connections.length, loadingList, loadingMore]);

  // Only the thread's own scroller moves; the page never does.
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const scroller = threadScrollRef.current;
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => () => threadAbortRef.current?.abort(), []);

  /**
   * CRM state for the open thread. Anything but `{ context }` (route missing,
   * 404, 500, non-CRM thread) reads as "no strip"; a stale response for a
   * thread that is no longer open is dropped.
   */
  const loadCrmContext = useCallback(async (connId: string) => {
    try {
      const res = await fetch(`/api/linkedin/messages/crm-context?connectionId=${connId}`);
      const data = res.ok ? await res.json() : null;
      if (activeThreadIdRef.current !== connId) return;
      const context = (data?.context as InboxCrmContext | undefined) ?? null;
      setCrmContext(context);
      // A new draft that is no longer generating ends the post-classification watch.
      const draft = context?.draft;
      if (draft && draft.status !== "generating" && draft.id !== supersededDraftIdRef.current) setDraftWatchUntil(null);
    } catch {
      /* network error: keep whatever the strip already shows */
    }
  }, []);

  /**
   * "Use draft" only holds while the server still offers that draft for
   * review; a regenerated, discarded or already-sent draft drops the reply
   * back to a plain LinkedIn send. A revision bump is followed automatically.
   */
  const activeDraft = useMemo(() => {
    const draft = crmContext?.draft;
    if (!activeDraftId || !draft || draft.id !== activeDraftId || draft.status !== "awaiting_review") return null;
    return { id: draft.id, revision: draft.revision };
  }, [activeDraftId, crmContext?.draft]);

  const reloadThread = useCallback(async (connId: string) => {
    const res = await fetch(`/api/linkedin/messages/thread?connectionId=${connId}`);
    const data = await res.json();
    if (activeThreadIdRef.current !== connId) return;
    const next: ThreadMessage[] = data.messages ?? [];
    setMessages((prev) => {
      if (
        prev.length === next.length &&
        prev[prev.length - 1]?.id === next[next.length - 1]?.id
      ) {
        return prev;
      }
      return next;
    });
    setConnections((prev) =>
      prev.map((c) => (c.id === connId ? { ...c, unseenCount: 0 } : c))
    );
  }, []);

  // Refresh open thread so inbound webhook messages appear without re-opening.
  useEffect(() => {
    const connId = selected?.id;
    if (!connId) return;

    const refreshThread = async () => {
      if (activeThreadIdRef.current !== connId || sending) return;
      try {
        await Promise.all([reloadThread(connId), loadCrmContext(connId)]);
      } catch {
        /* ignore poll errors */
      }
    };

    const interval = setInterval(refreshThread, 10_000);
    return () => clearInterval(interval);
  }, [selected?.id, sending, reloadThread, loadCrmContext]);

  // After a reclassification the CRM regenerates the draft asynchronously:
  // poll every 3s until loadCrmContext sees a finished draft, for at most ~45s.
  useEffect(() => {
    const connId = selected?.id;
    if (!draftWatchUntil || !connId) return;
    const interval = setInterval(() => {
      if (Date.now() > draftWatchUntil) setDraftWatchUntil(null);
      else void loadCrmContext(connId);
    }, 3_000);
    return () => clearInterval(interval);
  }, [draftWatchUntil, selected?.id, loadCrmContext]);

  const openThread = async (conn: ConnectionItem) => {
    threadAbortRef.current?.abort();
    const controller = new AbortController();
    threadAbortRef.current = controller;
    // A CRM draft belongs to the thread it was drafted for: never carry it over.
    if (activeDraftId && activeThreadIdRef.current !== conn.id) setText("");
    activeThreadIdRef.current = conn.id;

    setSelected(conn);
    setMessages([]);
    setCrmContext(null);
    setActiveDraftId(null);
    setDraftWatchUntil(null);
    supersededDraftIdRef.current = null;
    setLoadingThread(true);
    void loadCrmContext(conn.id);
    try {
      const res = await fetch(`/api/linkedin/messages/thread?connectionId=${conn.id}`, {
        signal: controller.signal,
      });
      if (activeThreadIdRef.current !== conn.id) return;
      const data = await res.json();
      if (activeThreadIdRef.current !== conn.id) return;
      setMessages(data.messages ?? []);
      setConnections((prev) => prev.map((c) => (c.id === conn.id ? { ...c, unseenCount: 0 } : c)));
      window.dispatchEvent(new CustomEvent("messages-unread-changed"));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      throw err;
    } finally {
      if (!controller.signal.aborted && activeThreadIdRef.current === conn.id) {
        setLoadingThread(false);
        setTimeout(() => scrollToBottom("instant"), 50);
      }
    }
  };

  const sendViaCrmDraft = async (draft: { id: string; revision: number }, body: string) => {
    if (!selected) return;
    const connId = selected.id;
    try {
      await crmFetch(`/drafts/${draft.id}/send`, {
        method: "POST",
        body: JSON.stringify({ revision: draft.revision, body }),
      });
      setActiveDraftId(null);
      // The CRM mirrors the sent message into the LinkedIn thread.
      await Promise.all([reloadThread(connId).catch(() => undefined), loadCrmContext(connId)]);
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connId ? { ...c, lastMessage: { text: body, type: "CUSTOM_SENT", createdAt: new Date().toISOString() } } : c
        )
      );
    } catch (err) {
      // 409 (stale revision / step no longer pending) and anything else: keep
      // the text, show the API's message, and resync the strip.
      setText(body);
      void dialogs.alert({ title: t("sendDraftFailed"), description: errorMessage(err), variant: "error" });
      void loadCrmContext(connId);
    }
  };

  const handleSend = async () => {
    if (!selected || !text.trim() || sending || crmContext?.doNotContact) return;
    const body = text.trim();
    setText("");
    setSending(true);
    if (activeDraft) {
      try {
        await sendViaCrmDraft(activeDraft, body);
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
      return;
    }
    try {
      const res = await fetch("/api/linkedin/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ connectionId: selected.id, text: body }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
        setConnections((prev) =>
          prev.map((c) =>
            c.id === selected.id
              ? { ...c, lastMessage: { text: body, type: "CUSTOM_SENT", createdAt: data.message.createdAt } }
              : c
          )
        );
      } else {
        setText(body);
        void dialogs.alert({ title: t("sendMessageFailed"), description: data.error, variant: "error" });
      }
    } catch {
      setText(body);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const renderMessages = () => {
    if (messages.length === 0) {
      return <EmptyState icon={RiMessage3Line} title={t("noMessagesTitle")} description={t("noMessagesDescription")} />;
    }
    const theirName = (selected?.name ?? "").trim().split(/\s+/)[0] || t("them");
    const lastId = messages[messages.length - 1]?.id;

    return messages.map((msg, i) => {
      const isSent = SENT_TYPES.has(msg.type);
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const date = new Date(msg.createdAt);
      const sameRun = (other: ThreadMessage | undefined) =>
        Boolean(other) &&
        dayKeyOf(new Date(other!.createdAt)) === dayKeyOf(date) &&
        SENT_TYPES.has(other!.type) === isSent &&
        (!isSent || other!.type === msg.type);
      const newDay = !prev || dayKeyOf(new Date(prev.createdAt)) !== dayKeyOf(date);
      const isFirst = !sameRun(prev);
      const isLast = !sameRun(next);
      const stepLabel = isSent && msg.type !== "CUSTOM_SENT" ? messageTypeLabel(msg.type) : null;

      return (
        <Fragment key={msg.id}>
          {newDay && <DaySeparator date={date} />}
          <div className={cn("flex flex-col", isSent ? "items-end" : "items-start", isFirst ? "mt-4 first:mt-0" : "mt-1")}>
            {isFirst && (
              <MessageCaption
                outbound={isSent}
                who={isSent ? t("you") : theirName}
                detail={stepLabel}
                time={format.dateTime(date, { hour: "numeric", minute: "2-digit" })}
                timeTitle={fullTime(date)}
              />
            )}
            <Bubble outbound={isSent} first={isFirst} last={isLast} title={fullTime(date)}>
              <ExpandableText text={msg.text} collapsed={msg.id !== lastId} />
            </Bubble>
          </div>
        </Fragment>
      );
    });
  };

  const displayName = (conn: ConnectionItem) => conn.name ?? conn.linkedinUrl ?? t("unknown");

  const clearFilters = () => {
    setSearch("");
    setCampaignFilter("");
    setAccountFilter("");
    setStatusFilter(DEFAULT_MESSAGES_STATUS_FILTER);
    setPeriodFilter("");
    setCategoryFilter("");
  };
  // The category filter only applies to CRM-tracked scopes; leaving one
  // clears it in the same render so the list does not fetch twice.
  const changeStatusFilter = (value: string) => {
    setStatusFilter(value);
    if (!CRM_FILTERABLE_STATUSES.has(value)) setCategoryFilter("");
  };

  const categoryLabel = useMemo(() => {
    if (!categoryFilter) return "";
    if (categoryFilter.startsWith(CATEGORY_FILTER_PREFIX)) {
      const key = categoryFilter.slice(CATEGORY_FILTER_PREFIX.length);
      const category = crmCategories.find((c) => c.key === key);
      return t("allOfCategory", { name: category?.label ?? crmKeyLabel(key) });
    }
    return crmCategories.flatMap((c) => c.subcategories).find((sc) => sc.id === categoryFilter)?.name ?? t("categoryFallback");
  }, [categoryFilter, crmCategories, t, crmKeyLabel]);

  // The popover's filters; search and the scope tabs live in the toolbar itself.
  const popoverFilterCount = [campaignFilter, accountFilter, periodFilter, showCategoryFilter ? categoryFilter : ""].filter(Boolean).length;
  const clearPopoverFilters = () => {
    setCampaignFilter("");
    setAccountFilter("");
    setPeriodFilter("");
    setCategoryFilter("");
  };
  const accountName = (id: string) => {
    const account = accounts.find((a) => a.id === id);
    return account ? account.name ?? `@${account.username}` : t("senderFallback");
  };
  const periodLabel = (value: string) => {
    const period = TIME_PERIODS.find((p) => p.value === value);
    return period ? t(period.labelKey) : value;
  };
  const chips = [
    campaignFilter && { key: "campaign", label: campaigns.find((c) => c.id === campaignFilter)?.name ?? t("campaignFallback"), onRemove: () => setCampaignFilter("") },
    accountFilter && { key: "account", label: t("fromSender", { name: accountName(accountFilter) }), onRemove: () => setAccountFilter("") },
    periodFilter && { key: "period", label: periodLabel(periodFilter), onRemove: () => setPeriodFilter("") },
    showCategoryFilter && categoryFilter && { key: "category", label: categoryLabel, onRemove: () => setCategoryFilter("") },
  ].filter((chip): chip is { key: string; label: string; onRemove: () => void } => Boolean(chip));

  const closeThread = useCallback(() => {
    activeThreadIdRef.current = null;
    setSelected(null);
    setCrmContext(null);
    setActiveDraftId(null);
    setDraftWatchUntil(null);
  }, []);

  // Scopes first, then the lead statuses, as two groups in the scope select.
  const scopeLabels: Record<string, string> = {
    [ALL_LEADS_FILTER]: t("scopeAll"),
    [UNREPLIED_FILTER]: t("scopeNeedsReply"),
    [CONNECTIONS_ONLY_FILTER]: t("scopeConnectionsOnly"),
  };
  const messageStatusOptions = ALL_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }));
  const scopeLabel = scopeLabels[statusFilter] ?? (ALL_STATUSES.includes(statusFilter) ? statusLabel(statusFilter) : t("conversationsFallback"));

  useInboxHotkeys({ listRef: listScrollRef, onClose: selected ? closeThread : null });
  const details = useDetailsPanel(selected?.id ?? null);
  const recordId = crmContext?.recordId ?? selected?.crm?.recordId ?? null;
  const { summary: record, loading: recordLoading } = useCrmRecordSummary(recordId, details.open);
  const crmSummary = crmContext ?? selected?.crm ?? null;

  // The scopes as tabs; only the open scope's total is known.
  const scopeTab = (value: string, label: string, title?: string): TriageTab => ({
    key: value,
    label,
    title,
    count: value === statusFilter && !loadingList ? totalCount : null,
    countTitle: value === statusFilter ? t("conversationCountTitle", { count: totalCount }) : undefined,
  });
  const triage = (
    <TriageTabs
      label={t("triageLabel")}
      value={statusFilter}
      onChange={changeStatusFilter}
      tabs={[
        scopeTab(DEFAULT_MESSAGES_STATUS_FILTER, t("tabReplied"), t("tabRepliedTitle")),
        scopeTab(UNREPLIED_FILTER, t("scopeNeedsReply"), t("needsReplyHint")),
        scopeTab(ALL_LEADS_FILTER, t("tabAll"), t("tabAllTitle")),
      ]}
      moreGroups={[
        { label: t("groupShow"), tabs: [scopeTab(CONNECTIONS_ONLY_FILTER, t("scopeConnectionsOnly"), t("connectionsOnlyTitle"))] },
        {
          label: t("groupLeadStatus"),
          tabs: messageStatusOptions.filter((o) => o.value !== DEFAULT_MESSAGES_STATUS_FILTER).map((o) => scopeTab(o.value, o.label)),
        },
      ]}
    />
  );

  const selectedName = selected ? displayName(selected) : "";
  const senderLabel = selected?.linkedInAccountName ?? (selected?.linkedInAccountUsername ? `@${selected.linkedInAccountUsername}` : null);

  const detailsPanel = selected ? (
    <DetailsPanel open={details.open} wide={details.wide} onClose={() => details.setOpen(false)}>
      <ContactDetails
        name={selectedName}
        avatarSrc={selected.profilePictureUrl ?? record?.profilePictureUrl}
        headline={selected.headline ?? record?.title}
        company={record?.company}
        channel="linkedin"
        links={{ recordId, linkedinUrl: selected.linkedinUrl ?? record?.linkedinUrl, email: record?.email, phone: record?.phone }}
        crm={
          crmSummary
            ? {
                recordId,
                categoryKey: crmSummary.categoryKey,
                categoryLabel: crmCategoryLabel(crmSummary),
                stage: workflowLabel(crmSummary.workflowState),
                sequence: crmSummary.sequenceName,
                step: crmStepLabel(crmSummary),
                nextActionAt: crmSummary.nextActionAt,
                lastInboundAt: record?.lastInboundAt,
                lastOutboundAt: record?.lastOutboundAt,
                doNotContact: crmContext?.doNotContact ?? record?.doNotContact,
              }
            : null
        }
        crmLoading={Boolean(recordId) && recordLoading && !crmSummary}
        facts={[
          ...(selected.campaignName ? [{ label: t("factCampaign"), value: selected.campaignName, title: selected.campaignName }] : []),
          ...(selected.linkedInAccountUsername
            ? [
                {
                  label: t("factSentFrom"),
                  value: (
                    <LinkedInAccountTag
                      account={{ username: selected.linkedInAccountUsername, name: selected.linkedInAccountName, profilePictureUrl: selected.linkedInAccountPicture }}
                      size="sm"
                    />
                  ),
                },
              ]
            : []),
          ...(selected.leadStatus ? [{ label: t("factLeadStatus"), value: statusLabel(selected.leadStatus) }] : []),
          ...(selected.connectedAt ? [{ label: t("factConnected"), value: format.dateTime(new Date(selected.connectedAt), { day: "numeric", month: "short", year: "numeric" }) }] : []),
        ]}
        actions={record?.personId && record.phone ? <CallButton personId={record.personId} crmRecordId={recordId} phone={record.phone} numberMenu={false} /> : undefined}
      />
    </DetailsPanel>
  ) : undefined;

  return (
    <InboxLayout
      threadOpen={selected !== null}
      header={
        <PageHeader
          title={t("title")}
          description={t("description")}
        />
      }
    >
      <ListPane
        label={t("listLabel")}
        hidden={selected !== null}
        busy={loadingList && connections.length > 0}
        scrollRef={listScrollRef}
        toolbar={
          <>
            <div className="flex items-center gap-2">
              <ListSearch value={search} onChange={setSearch} placeholder={t("searchPlaceholder")} label={t("searchLabel")} />
              <FilterPopover count={popoverFilterCount} onClear={clearPopoverFilters}>
                <FilterField label={t("filterCampaign")}>
                  <Select.Root size="small" value={campaignFilter} onValueChange={setCampaignFilter}>
                    <Select.Trigger aria-label={t("campaignFilterAria")}>
                      <Select.Value placeholder={t("allCampaigns")} />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="">{t("allCampaigns")}</Select.Item>
                      {campaigns.map((c) => (
                        <Select.Item key={c.id} value={c.id}>
                          {c.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </FilterField>
                <FilterField label={t("filterSender")}>
                  <Select.Root size="small" value={accountFilter} onValueChange={setAccountFilter}>
                    <Select.Trigger aria-label={t("senderFilterAria")}>
                      <Select.Value placeholder={t("allSenders")} />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="">{t("allSenders")}</Select.Item>
                      {accounts.map((a) => (
                        <Select.Item key={a.id} value={a.id}>
                          <span className="flex min-w-0 items-center gap-2">
                            <InboxAvatar name={a.name ?? a.username} src={a.profilePictureUrl} size="xs" className="size-5 text-[9px]" />
                            <span className="truncate">{a.name ?? `@${a.username}`}</span>
                            {a.name && <span className="truncate text-text-soft-400">@{a.username}</span>}
                          </span>
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </FilterField>
                <FilterField label={t("filterLastActivity")}>
                  <Select.Root size="small" value={periodFilter} onValueChange={setPeriodFilter}>
                    <Select.Trigger aria-label={t("periodFilterAria")}>
                      <Select.Value placeholder={t("allTime")} />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="">{t("allTime")}</Select.Item>
                      {TIME_PERIODS.map((p) => (
                        <Select.Item key={p.value} value={p.value}>
                          {t(p.labelKey)}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </FilterField>
                <FilterField label={t("filterCrmCategory")} hint={showCategoryFilter ? undefined : t("crmCategoryHint")}>
                  <Select.Root size="small" value={showCategoryFilter ? categoryFilter : ""} onValueChange={setCategoryFilter} disabled={!showCategoryFilter || crmCategories.length === 0}>
                    <Select.Trigger aria-label={t("crmCategoryFilterAria")}>
                      <Select.Value placeholder={t("allCategories")} />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="">{t("allCategories")}</Select.Item>
                      {crmCategories.map((category) => {
                        const label = category.label ?? crmKeyLabel(category.key);
                        return (
                          <Select.Group key={category.key}>
                            <Select.Separator />
                            <Select.GroupLabel>{label}</Select.GroupLabel>
                            <Select.Item value={`${CATEGORY_FILTER_PREFIX}${category.key}`}>{t("allOfCategory", { name: label })}</Select.Item>
                            {category.subcategories
                              .filter((sc) => sc.active !== false)
                              .map((sc) => (
                                <Select.Item key={sc.id} value={sc.id}>
                                  {sc.name}
                                </Select.Item>
                              ))}
                          </Select.Group>
                        );
                      })}
                    </Select.Content>
                  </Select.Root>
                </FilterField>
              </FilterPopover>
            </div>
            <ActiveFilterChips chips={chips} onClearAll={clearPopoverFilters} />
          </>
        }
        tabs={triage}
        footer={<ListCount shown={connections.length} total={totalCount} noun={t("conversationNoun", { count: totalCount })} loading={loadingList} />}
      >
        {loadingList && connections.length === 0 ? (
          <RowsSkeleton />
        ) : connections.length === 0 ? (
          search || popoverFilterCount > 0 ? (
            <EmptyState
              compact
              icon={RiSearchLine}
              title={t("noMatchTitle")}
              description={t("noMatchDescription", { scope: scopeLabel })}
              action={
                <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={clearFilters}>
                  {t("clearFilters")}
                </Button.Root>
              }
            />
          ) : statusFilter === UNREPLIED_FILTER ? (
            <EmptyState compact icon={RiCheckDoubleLine} title={t("caughtUpTitle")} description={t("caughtUpDescription")} />
          ) : (
            <EmptyState
              compact
              icon={RiChatSmile3Line}
              title={statusFilter === DEFAULT_MESSAGES_STATUS_FILTER ? t("noRepliesTitle") : t("nothingInScope", { scope: scopeLabel })}
              description={
                statusFilter === DEFAULT_MESSAGES_STATUS_FILTER
                  ? t("noRepliesDescription")
                  : t("noConnectionsDescription")
              }
            />
          )
        ) : (
          withRecencyBreaks(connections, (conn) => (conn.lastMessage ? new Date(conn.lastMessage.createdAt) : null)).map(({ row: conn, heading }) => {
            const name = displayName(conn);
            const hasUnseen = conn.unseenCount > 0;
            const last = conn.lastMessage ? new Date(conn.lastMessage.createdAt) : null;
            const drafted = conn.crm?.hasDraft === true;
            const step = conn.crm && inboxCrmStep(conn.crm).kind !== "none" ? crmStepLabel(conn.crm) : null;
            return (
              <Fragment key={conn.id}>
                {heading && <DayHeading>{heading}</DayHeading>}
                <ConversationRow
                  selected={selected?.id === conn.id}
                  unread={hasUnseen}
                  unreadCount={conn.unseenCount}
                  onSelect={() => openThread(conn)}
                  avatar={<InboxAvatar name={name} src={conn.profilePictureUrl} />}
                  title={name}
                  time={rowTime(last)}
                  timeTitle={fullTime(last)}
                  snippet={
                    conn.lastMessage ? (
                      <>
                        {SENT_TYPES.has(conn.lastMessage.type) && <span className="text-text-soft-400">{t("youPrefix")} </span>}
                        {conn.lastMessage.text}
                      </>
                    ) : (
                      <span className="italic text-text-soft-400">{t("noMessagesYet")}</span>
                    )
                  }
                  hint={conn.headline ?? undefined}
                  meta={
                    <>
                      {drafted && <DraftChip />}
                      <RowStatus conn={conn} />
                      {!drafted && step && <RowMeta keep>{step}</RowMeta>}
                    </>
                  }
                />
              </Fragment>
            );
          })
        )}
        {!loadingList && connections.length > 0 && (
          <div ref={listSentinelRef} className="flex min-h-8 justify-center py-3">
            {loadingMore && <RiLoader4Line className="size-5 animate-spin text-text-soft-400" aria-label={t("loadingMore")} />}
          </div>
        )}
      </ListPane>

      <ReadingPane shown={selected !== null} aside={detailsPanel}>
        {!selected ? (
          <ReadingEmpty icon={RiMessage3Line} description={t("pickConversation")} />
        ) : (
          <>
            <ThreadHeader
              onBack={closeThread}
              avatar={<InboxAvatar name={selectedName} src={selected.profilePictureUrl} />}
              title={selectedName}
              badges={
                crmContext ? (
                  <CrmCategoryControl
                    context={crmContext}
                    categories={crmCategories}
                    disabled={sending}
                    onClassified={() => {
                      supersededDraftIdRef.current = crmContext.draft?.id ?? null;
                      setActiveDraftId(null);
                      setDraftWatchUntil(Date.now() + 45_000);
                      void loadCrmContext(selected.id);
                    }}
                  />
                ) : (
                  <RowStatus conn={selected} />
                )
              }
              channel="linkedin"
              subtitle={selected.headline ?? undefined}
              actions={
                <>
                  {recordId && (
                    <Button.Root variant="neutral" mode="stroke" size="xsmall" asChild className="@max-3xl:w-8 @max-3xl:px-0" title={t("openRecord")}>
                      <Link href={`/crm/records/${recordId}`} aria-label={t("openRecord")}>
                        <Button.Icon as={RiUserSearchLine} />
                        <span className="hidden @3xl:inline">{t("record")}</span>
                      </Link>
                    </Button.Root>
                  )}
                  {selected.linkedinUrl && (
                    <HeaderAction icon={RiExternalLinkLine} label={t("linkedinProfile")} href={toLinkedinHref(selected.linkedinUrl)} external iconOnly />
                  )}
                  <HeaderAction icon={RiLayoutRightLine} label={details.open ? t("hideDetails") : t("showDetails")} onClick={details.toggle} pressed={details.open} iconOnly />
                </>
              }
            />

            {loadingThread ? (
              <ThreadSkeleton />
            ) : (
              <div ref={threadScrollRef} className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-5 sm:px-6">{renderMessages()}</div>
              </div>
            )}

            <ComposerDock>
              {crmContext?.doNotContact ? (
                <DoNotContactNotice />
              ) : !selected.chatId ? (
                <p className="py-1 text-center text-paragraph-xs text-text-soft-400">
                  {t("noChatYet")}
                </p>
              ) : (
                <>
                  {crmContext?.draft && (
                    <CrmDraftCard
                      draft={crmContext.draft}
                      active={activeDraft?.id === crmContext.draft.id}
                      disabled={sending}
                      onUse={() => {
                        const draft = crmContext.draft!;
                        setText(draft.body);
                        setActiveDraftId(draft.id);
                        textareaRef.current?.focus();
                      }}
                    />
                  )}
                  <ChatComposer
                    value={text}
                    onChange={(value) => {
                      setText(value);
                      if (!value.trim()) setActiveDraftId(null);
                    }}
                    onSubmit={() => void handleSend()}
                    sending={sending}
                    textareaRef={textareaRef}
                    tone={activeDraft ? "draft" : "default"}
                    banner={
                      activeDraft ? (
                        <ComposerDraftBanner
                          onClear={() => {
                            setActiveDraftId(null);
                            setText("");
                          }}
                        />
                      ) : undefined
                    }
                    submitLabel={activeDraft ? t("approveAndSend") : t("send")}
                    placeholder={t("messagePlaceholder", { name: selectedName.split(" ")[0] || t("themLower") })}
                    meta={<ChannelTag channel="linkedin" label={senderLabel ? t("sentAs", { sender: senderLabel }) : "LinkedIn"} />}
                  />
                </>
              )}
            </ComposerDock>
          </>
        )}
      </ReadingPane>
    </InboxLayout>
  );
}
