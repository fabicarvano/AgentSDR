"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  RiChat3Line,
  RiCheckDoubleLine,
  RiLayoutRightLine,
  RiLoader4Line,
  RiSearchLine,
  RiSmartphoneLine,
  RiUserSearchLine,
} from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Select from "@/components/alignui/select";
import { DocsLink } from "@/components/page/DocsLink";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { Skeleton } from "@/components/page/Skeletons";
import { CallButton } from "@/components/calls/CallButton";
import { titleAtCompany } from "@/components/calling/callingShared";
import { categoryToneClass } from "@/components/crm/ActionRowTools";
import { DoNotContactNotice } from "@/components/crm/InboxCrmStrip";
import {
  ChannelTag,
  ConversationRow,
  DayHeading,
  FilterField,
  FilterPopover,
  HeaderAction,
  InboxAvatar,
  InboxLayout,
  InlineError,
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
  useInboxTime,
} from "@/components/inbox/shell/InboxShell";
import { ComposerDock } from "@/components/inbox/shell/Conversation";
import { ContactDetails, DetailsPanel, useCrmRecordSummary, useDetailsPanel, useWorkflowLabel } from "@/components/inbox/shell/DetailsPanel";
import { useInboxHotkeys } from "@/components/inbox/shell/hotkeys";
import { WhatsappComposer, WhatsappMessageList } from "@/components/whatsapp/WhatsappThread";
import { useVisiblePolling, WHATSAPP_POLL_INTERVAL_MS } from "@/components/whatsapp/usePolling";
import { useCrmText } from "@/components/crm/useCrmText";
import { cn } from "@/utils/cn";
import {
  getWhatsappChat,
  listWhatsappAccounts,
  listWhatsappChats,
  markWhatsappChatRead,
  sendWhatsapp,
} from "@/lib/whatsapp/client";
import type { WhatsappAccountSummary, WhatsappChatSummary, WhatsappMessage } from "@/lib/whatsapp/contract";

type Translate = ReturnType<typeof useTranslations<"callsMain.whatsappMessages">>;

function chatTitle(chat: WhatsappChatSummary, t: Translate): string {
  return chat.person?.fullName || chat.name || chat.phone || t("unknownNumber");
}

function accountLabel(account: WhatsappAccountSummary, t: Translate): string {
  return account.name || account.phone || t("numberFallback");
}

/** `initialChatId` opens that chat on arrival (Messages?chat=…, e.g. from a campaign lead). */
export function WhatsappMessagesClient({ initialChatId = null }: { initialChatId?: string | null } = {}) {
  const t = useTranslations("callsMain.whatsappMessages");
  const { errorMessage, categoryLabel } = useCrmText();
  const { fullTime, rowTime, withRecencyBreaks } = useInboxTime();
  const workflowLabel = useWorkflowLabel();
  const [accounts, setAccounts] = useState<WhatsappAccountSummary[]>([]);
  const [accountFilter, setAccountFilter] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [chats, setChats] = useState<WhatsappChatSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(initialChatId);
  const [thread, setThread] = useState<{ chat: WhatsappChatSummary; messages: WhatsappMessage[] } | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    void listWhatsappAccounts().then((response) => setAccounts(response.accounts)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // --- list ---------------------------------------------------------------
  const listRequest = useRef(0);
  const loadList = useCallback(
    async (background = false) => {
      const request = ++listRequest.current;
      if (!background) setLoadingList(true);
      try {
        const response = await listWhatsappChats({ accountId: accountFilter || undefined, search: search || undefined, unread: unreadOnly });
        if (request !== listRequest.current) return;
        setListError("");
        setChats((current) => {
          if (!background) return response.chats;
          // A background refresh replaces page one and keeps any older pages already loaded.
          const fresh = new Set(response.chats.map((chat) => chat.id));
          const firstAge = response.chats.at(-1)?.lastMessageAt ?? "";
          const older = current.filter((chat) => !fresh.has(chat.id) && (chat.lastMessageAt ?? "") < firstAge);
          return [...response.chats, ...older];
        });
        if (!background) setNextCursor(response.nextCursor);
      } catch (cause) {
        if (request === listRequest.current && !background) setListError(errorMessage(cause));
      } finally {
        if (request === listRequest.current) setLoadingList(false);
      }
    },
    [accountFilter, search, unreadOnly, errorMessage],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await listWhatsappChats({ accountId: accountFilter || undefined, search: search || undefined, unread: unreadOnly, cursor: nextCursor });
      setChats((current) => {
        const seen = new Set(current.map((chat) => chat.id));
        return [...current, ...response.chats.filter((chat) => !seen.has(chat.id))];
      });
      setNextCursor(response.nextCursor);
    } catch (cause) {
      setListError(errorMessage(cause));
    } finally {
      setLoadingMore(false);
    }
  };

  // --- thread -------------------------------------------------------------
  const threadRequest = useRef(0);
  const loadThread = useCallback(async (id: string, background = false) => {
    const request = ++threadRequest.current;
    if (!background) setLoadingThread(true);
    try {
      const response = await getWhatsappChat(id);
      if (request !== threadRequest.current) return;
      setThread({ chat: response.chat, messages: response.messages });
      setThreadError("");
      if (response.chat.unreadCount > 0) {
        void markWhatsappChatRead(id).catch(() => undefined);
        setChats((current) => current.map((chat) => (chat.id === id ? { ...chat, unreadCount: 0 } : chat)));
      }
    } catch (cause) {
      if (request === threadRequest.current && !background) setThreadError(errorMessage(cause));
    } finally {
      if (request === threadRequest.current) setLoadingThread(false);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (initialChatId) void loadThread(initialChatId);
  }, [initialChatId, loadThread]);

  const openChat = (chat: WhatsappChatSummary) => {
    if (chat.id === selectedId) return;
    setSelectedId(chat.id);
    setThread(null);
    setDraft("");
    setChats((current) => current.map((item) => (item.id === chat.id ? { ...item, unreadCount: 0 } : item)));
    void loadThread(chat.id);
  };

  useVisiblePolling(() => {
    void loadList(true);
    if (selectedId) void loadThread(selectedId, true);
  }, WHATSAPP_POLL_INTERVAL_MS);

  const send = async (text: string) => {
    if (!thread) return;
    const response = await sendWhatsapp({ chatId: thread.chat.id, text });
    setDraft("");
    setThread((current) => (current ? { chat: response.chat, messages: [...current.messages, response.message] } : current));
    setChats((current) => [response.chat, ...current.filter((chat) => chat.id !== response.chat.id)]);
  };

  const accountOptions = useMemo(
    () => accounts.map((account) => ({ value: account.id, label: accountLabel(account, t), sublabel: account.phone && account.name ? account.phone : undefined })),
    [accounts, t],
  );
  const filtersActive = Boolean(search || unreadOnly || accountFilter);
  const selected = thread?.chat ?? chats.find((chat) => chat.id === selectedId) ?? null;
  const grouped = useMemo(() => withRecencyBreaks(chats, (chat) => (chat.lastMessageAt ? new Date(chat.lastMessageAt) : null)), [chats, withRecencyBreaks]);
  const selectedAccount = selected ? accounts.find((item) => item.id === selected.accountId) : undefined;
  const clearFilters = () => {
    setSearchInput("");
    setUnreadOnly(false);
    setAccountFilter("");
  };
  const closeChat = useCallback(() => {
    setSelectedId(null);
    setThread(null);
  }, []);
  const listRef = useRef<HTMLDivElement>(null);
  useInboxHotkeys({ listRef, onClose: selectedId ? closeChat : null });
  const details = useDetailsPanel(selectedId);
  const recordId = selected?.person?.crmRecordId ?? null;
  // The header's category chip needs the record whether or not the details are open.
  const { summary: record, loading: recordLoading } = useCrmRecordSummary(recordId);
  // Unread across the chats loaded so far; with more pages to load it is a floor.
  const unreadLoaded = chats.filter((chat) => chat.unreadCount > 0).length;

  const name = selected ? chatTitle(selected, t) : "";
  const recordCategoryLabel = record ? (record.subcategory ?? categoryLabel(record.categoryKey)) : "";
  const person = selected?.person ?? null;
  const detailsPanel = selected ? (
    <DetailsPanel open={details.open} wide={details.wide} onClose={() => details.setOpen(false)}>
      <ContactDetails
        name={name}
        avatarSrc={person?.profilePictureUrl ?? record?.profilePictureUrl}
        headline={person?.title ?? record?.title}
        company={record?.company ?? (person?.companyName ? { name: person.companyName } : null)}
        channel="whatsapp"
        links={{ recordId, phone: selected.phone ?? record?.phone, email: record?.email, linkedinUrl: record?.linkedinUrl }}
        crm={
          record
            ? {
                recordId,
                categoryKey: record.categoryKey,
                categoryLabel: recordCategoryLabel,
                stage: workflowLabel(record.workflowState),
                sequence: record.sequence,
                nextActionAt: record.nextActionAt,
                lastInboundAt: record.lastInboundAt,
                lastOutboundAt: record.lastOutboundAt,
                doNotContact: record.doNotContact,
              }
            : null
        }
        crmLoading={Boolean(recordId) && recordLoading}
        facts={[
          ...(selectedAccount ? [{ label: t("factNumber"), value: accountLabel(selectedAccount, t), title: selectedAccount.phone ?? undefined }] : []),
          ...(selected.lastMessageAt ? [{ label: t("factLastMessage"), value: rowTime(new Date(selected.lastMessageAt)), title: fullTime(new Date(selected.lastMessageAt)) }] : []),
          ...(!person ? [{ label: t("factInAgentSdr"), value: t("factNotYet") }] : []),
        ]}
      />
    </DetailsPanel>
  ) : undefined;

  return (
    <InboxLayout
      threadOpen={selectedId !== null}
      header={
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <Button.Root variant="neutral" mode="stroke" size="small" asChild>
              <Link href="/settings/whatsapp-accounts">
                <Button.Icon as={RiSmartphoneLine} />
                {t("numbers")}
              </Link>
            </Button.Root>
          }
        />
      }
    >
      <ListPane
        label={t("listLabel")}
        hidden={selectedId !== null}
        busy={loadingList && chats.length > 0}
        scrollRef={listRef}
        toolbar={
          <div className="flex items-center gap-2">
            <ListSearch value={searchInput} onChange={setSearchInput} placeholder={t("searchPlaceholder")} label={t("searchLabel")} />
            {accounts.length > 1 && (
              <FilterPopover count={accountFilter ? 1 : 0} onClear={() => setAccountFilter("")}>
                <FilterField label={t("filterNumber")}>
                  <Select.Root size="small" value={accountFilter} onValueChange={setAccountFilter}>
                    <Select.Trigger aria-label={t("filterNumber")}>
                      <Select.Value placeholder={t("allNumbers")} />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="">{t("allNumbers")}</Select.Item>
                      {accountOptions.map((option) => (
                        <Select.Item key={option.value} value={option.value}>
                          {option.label}
                          {option.sublabel && <span className="ml-1.5 text-text-soft-400">{option.sublabel}</span>}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </FilterField>
              </FilterPopover>
            )}
          </div>
        }
        tabs={
          <TriageTabs
            label={t("filterTabs")}
            value={unreadOnly ? "unread" : "all"}
            onChange={(value) => setUnreadOnly(value === "unread")}
            tabs={[
              { key: "all", label: t("tabAll") },
              { key: "unread", label: t("tabUnread"), count: unreadLoaded || null, countTitle: t("unreadTitle", { count: unreadLoaded, plus: nextCursor ? "+" : "" }) },
            ]}
          />
        }
        footer={<ListCount shown={chats.length} total={nextCursor ? null : chats.length} noun={t("chatNoun", { count: chats.length })} loading={loadingList} />}
      >
        {listError && (
          <InlineError className="m-3" onRetry={() => void loadList()}>
            {listError}
          </InlineError>
        )}
        {loadingList && chats.length === 0 ? (
          <RowsSkeleton />
        ) : chats.length === 0 && !listError ? (
          filtersActive ? (
            <EmptyState
              compact
              icon={unreadOnly && !search ? RiCheckDoubleLine : RiSearchLine}
              title={unreadOnly && !search ? t("caughtUpTitle") : t("noMatchTitle")}
              description={unreadOnly && !search ? t("caughtUpBody") : t("noMatchBody")}
              action={
                <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={clearFilters}>
                  {t("showAll")}
                </Button.Root>
              }
            />
          ) : (
            <EmptyState
              compact
              icon={RiChat3Line}
              title={t("emptyTitle")}
              description={
                accounts.length === 0 ? t("emptyNoAccounts") : t("emptyWithAccounts")
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button.Root variant="neutral" mode="stroke" size="xsmall" asChild>
                    <Link href="/settings/whatsapp-accounts">{accounts.length === 0 ? t("linkNumber") : t("whatsappNumbers")}</Link>
                  </Button.Root>
                  {accounts.length === 0 && <DocsLink page="whatsapp/accounts#link-a-number" size="xsmall" />}
                </div>
              }
            />
          )
        ) : (
          grouped.map(({ row: chat, heading }) => {
            const rowName = chatTitle(chat, t);
            const unread = chat.unreadCount > 0;
            const account = accounts.length > 1 ? accounts.find((item) => item.id === chat.accountId) : undefined;
            const last = chat.lastMessageAt ? new Date(chat.lastMessageAt) : null;
            return (
              <div key={chat.id}>
                {heading && <DayHeading>{heading}</DayHeading>}
                <ConversationRow
                  selected={chat.id === selectedId}
                  unread={unread}
                  unreadCount={chat.unreadCount}
                  onSelect={() => openChat(chat)}
                  avatar={<InboxAvatar name={rowName} src={chat.person?.profilePictureUrl} />}
                  title={rowName}
                  subtitle={chat.person?.companyName ?? undefined}
                  time={rowTime(last)}
                  timeTitle={fullTime(last)}
                  hint={chat.person ? titleAtCompany(chat.person) ?? undefined : chat.phone ?? undefined}
                  snippet={
                    chat.lastMessagePreview ? (
                      <>
                        {chat.lastDirection === "outbound" && <span className="text-text-soft-400">{t("youPrefix")}</span>}
                        {chat.lastMessagePreview}
                      </>
                    ) : (
                      <span className="italic text-text-soft-400">{t("noMessagesRow")}</span>
                    )
                  }
                  meta={
                    !chat.person || account ? (
                      <>
                        {!chat.person && <RowBadge dot={false}>{t("notInAgentSdr")}</RowBadge>}
                        {account && <RowMeta icon={RiSmartphoneLine}>{accountLabel(account, t)}</RowMeta>}
                      </>
                    ) : undefined
                  }
                />
              </div>
            );
          })
        )}
        {nextCursor && !loadingList && (
          <div className="flex justify-center py-3">
            <Button.Root variant="neutral" mode="ghost" size="xsmall" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore && <Button.Icon as={RiLoader4Line} className="animate-spin" />}
              {t("loadMore")}
            </Button.Root>
          </div>
        )}
      </ListPane>

      <ReadingPane shown={selectedId !== null} aside={detailsPanel}>
        {!selected ? (
          <ReadingEmpty icon={RiChat3Line} description={t("pickChat")} />
        ) : (
          <>
            <ThreadHeader
              onBack={closeChat}
              backLabel={t("backToChats")}
              avatar={<InboxAvatar name={name} src={person?.profilePictureUrl} />}
              title={name}
              badges={
                person ? (
                  recordId ? (
                    record ? (
                      <CategoryBadge categoryKey={record.categoryKey} label={recordCategoryLabel} />
                    ) : (
                      <Skeleton className="h-6 w-20 rounded-md" />
                    )
                  ) : (
                    <RowBadge dot={false}>{t("notInCrm")}</RowBadge>
                  )
                ) : (
                  <RowBadge dot={false}>{t("notInAgentSdr")}</RowBadge>
                )
              }
              channel="whatsapp"
              subtitle={[person ? titleAtCompany(person) : null, selected.phone && selected.phone !== name ? selected.phone : null].filter(Boolean).join(" · ") || undefined}
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
                  {person && <CallButton personId={person.id} crmRecordId={recordId} phone={selected.phone} numberMenu={false} />}
                  <HeaderAction icon={RiLayoutRightLine} label={details.open ? t("hideDetails") : t("showDetails")} onClick={details.toggle} pressed={details.open} iconOnly />
                </>
              }
            />

            {threadError && (
              <InlineError className="m-3" onRetry={() => void loadThread(selected.id)}>
                {threadError}
              </InlineError>
            )}
            {loadingThread && !thread ? (
              <ThreadSkeleton />
            ) : (
              <WhatsappMessageList
                messages={thread?.messages ?? []}
                threadKey={selected.id}
                leadName={name}
                className="px-4 py-5 sm:px-6"
                emptyText={t("threadEmpty")}
              />
            )}

            <ComposerDock>
              {record?.doNotContact ? (
                <DoNotContactNotice />
              ) : (
                <WhatsappComposer
                  value={draft}
                  onChange={setDraft}
                  onSend={send}
                  disabled={!thread}
                  placeholder={t("composePlaceholder", { name: name.split(" ")[0] || t("them") })}
                  meta={
                    <span
                      title={selectedAccount?.unipileAccountId.startsWith("station:") ? t("metaStation") : t("metaUnipile")}
                    >
                      <ChannelTag channel="whatsapp" label={selectedAccount ? t("fromNumber", { name: accountLabel(selectedAccount, t) }) : "WhatsApp" /* brand name, stays English */} />
                    </span>
                  }
                />
              )}
            </ComposerDock>
          </>
        )}
      </ReadingPane>
    </InboxLayout>
  );
}

/** The record's CRM category, tinted in its identity colour (read-only: WhatsApp has no reclassify route of its own). */
function CategoryBadge({ categoryKey, label }: { categoryKey: string | null; label: string }) {
  const t = useTranslations("callsMain.whatsappMessages");
  return (
    <span
      title={t("categoryTitle", { label })}
      className={cn(
        "inline-flex h-6 min-w-0 max-w-[11rem] items-center rounded-md px-2 text-label-xs ring-1 ring-inset",
        categoryToneClass[categoryKey ?? ""] ?? "bg-bg-weak-50 text-text-sub-600 ring-stroke-soft-200",
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
