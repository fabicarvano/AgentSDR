"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- the template is a file download from an API route, not a page */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { RiArrowDownLine, RiArrowLeftSLine, RiArrowRightSLine, RiArrowUpLine, RiDownloadLine, RiMore2Line, RiSearchLine, RiTable2, RiUpload2Line, RiUserSearchLine, RiBuilding2Line, RiUserLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as Pagination from "@/components/alignui/pagination";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { ErrorState } from "@/components/crm/CrmLayout";
import { EmptyState } from "@/components/page/EmptyState";
import { PageContainer, PageHeader } from "@/components/page/PageHeader";
import { PageTabs } from "@/components/page/PageTabs";
import { cn } from "@/utils/cn";
import { CompaniesTable } from "./CompaniesTable";
import { LeadsFilterPopover, type Subcategory } from "./LeadsFilterPopover";
import { PeopleImportModal } from "./PeopleImportModal";
import { PeopleTable } from "./PeopleTable";
import { activeFilterCount, EMPTY_FILTERS, PAGE_SIZE, SORTS, type CompanyRow, type Direction, type LeadsTab, type PeopleFilters, type PersonRow } from "./leadTypes";

type ListState<F> = { query: string; filters: F; sort: string; direction: Direction; page: number };
type Data<R> = { rows: R[]; total: number } | null;
type Props = { initialTab: LeadsTab; initialRows: PersonRow[] | CompanyRow[]; initialTotal: number };

const DEFAULT_SORT = "updated";
const DESC_FIRST = new Set(["updated", "people", "created"]);
const freshList = <F,>(filters: F): ListState<F> => ({ query: "", filters, sort: DEFAULT_SORT, direction: "desc", page: 0 });
const freshPeople = () => freshList<PeopleFilters>(EMPTY_FILTERS);
const freshCompanies = () => freshList<null>(null);

function requestUrl(tab: LeadsTab, state: ListState<PeopleFilters | null>): string {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(state.page * PAGE_SIZE), sort: state.sort, direction: state.direction });
  if (state.query.trim()) params.set("q", state.query.trim());
  const f = state.filters;
  if (tab === "people" && f) {
    if (f.campaignChannel) params.set("campaignChannel", f.campaignChannel);
    if (f.hasEmail) params.set("hasEmail", "true");
    if (f.hasLinkedin) params.set("hasLinkedin", "true");
    if (f.crmCategory) params.set("crmCategory", f.crmCategory);
    if (f.crmSubcategoryId) params.set("crmSubcategoryId", f.crmSubcategoryId);
    if (f.crmWorkflowState) params.set("crmWorkflowState", f.crmWorkflowState);
    if (f.crmAiChange) params.set("crmAiChange", "true");
  }
  return `/api/leads/${tab}?${params}`;
}

function pageItems(current: number, pages: number): Array<number | "gap-start" | "gap-end"> {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index);
  const items: Array<number | "gap-start" | "gap-end"> = [0];
  const start = Math.max(1, Math.min(current - 1, pages - 4));
  const end = Math.min(pages - 2, Math.max(current + 1, 3));
  if (start > 1) items.push("gap-start");
  for (let index = start; index <= end; index += 1) items.push(index);
  if (end < pages - 2) items.push("gap-end");
  items.push(pages - 1);
  return items;
}

export default function LeadsClient({ initialTab, initialRows, initialTotal }: Props) {
  const t = useTranslations("leads.client");
  const ts = useTranslations("leads.sort");
  const format = useFormatter();
  const pathname = usePathname();
  const [tab, setTab] = useState<LeadsTab>(initialTab);
  const [peopleState, setPeopleState] = useState(freshPeople);
  const [companiesState, setCompaniesState] = useState(freshCompanies);
  const [peopleData, setPeopleData] = useState<Data<PersonRow>>(initialTab === "people" ? { rows: initialRows as PersonRow[], total: initialTotal } : null);
  const [companiesData, setCompaniesData] = useState<Data<CompanyRow>>(initialTab === "companies" ? { rows: initialRows as CompanyRow[], total: initialTotal } : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const skipUrl = useRef<string | null>(requestUrl(initialTab, initialTab === "people" ? freshPeople() : freshCompanies()));

  const isPeople = tab === "people";
  const state = isPeople ? peopleState : companiesState;
  const data = isPeople ? peopleData : companiesData;
  const url = useMemo(() => requestUrl(tab, state), [tab, state]);

  useEffect(() => {
    void fetch("/api/crm/categories").then((response) => response.json()).then((body) => {
      const categories = Array.isArray(body.categories) ? body.categories : [];
      setSubcategories(categories.flatMap((category: { subcategories?: Subcategory[] }) => category.subcategories ?? []));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (skipUrl.current === url && reloadToken === 0) { skipUrl.current = null; return; }
    skipUrl.current = null;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(t("loadFailed", { tab }));
        const body = await response.json() as { people?: PersonRow[]; companies?: CompanyRow[]; total: number };
        if (tab === "people") setPeopleData({ rows: body.people ?? [], total: body.total });
        else setCompaniesData({ rows: body.companies ?? [], total: body.total });
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : t("loadFailed", { tab }));
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, state.query ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
    // `state.query` only picks the debounce; `url` already encodes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, reloadToken]);

  const switchTab = (next: string) => {
    if (next !== "people" && next !== "companies") return;
    if (next === tab) return;
    setError("");
    setLoading(false);
    if (next === "people") { setPeopleState(freshPeople()); setPeopleData(null); } else { setCompaniesState(freshCompanies()); setCompaniesData(null); }
    setTab(next);
    // Native history, which Next keeps in sync with useSearchParams: the tab
    // lives in the URL without re-running the server page for rows we fetch here.
    window.history.replaceState(null, "", `${pathname}?tab=${next}`);
  };

  // A company row opens the People tab searched to its domain.
  const openCompany = (row: CompanyRow) => {
    setError("");
    setLoading(false);
    setPeopleState({ ...freshPeople(), query: row.company.domain });
    setPeopleData(null);
    setTab("people");
    window.history.replaceState(null, "", `${pathname}?tab=people`);
  };

  const patch = useCallback((change: Partial<ListState<PeopleFilters | null>>) => {
    if (isPeople) setPeopleState((current) => ({ ...current, ...change, filters: (change.filters ?? current.filters) as PeopleFilters, page: change.page ?? 0 }));
    else setCompaniesState((current) => ({ ...current, ...change, filters: null, page: change.page ?? 0 }));
  }, [isPeople]);

  const onSort = (key: string) => {
    if (state.sort === key) patch({ direction: state.direction === "asc" ? "desc" : "asc" });
    else patch({ sort: key, direction: DESC_FIRST.has(key) ? "desc" : "asc" });
  };

  const total = data?.total ?? 0;
  const rowCount = data?.rows.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersOn = isPeople ? activeFilterCount(peopleState.filters) : 0;
  const searching = Boolean(state.query.trim());
  const from = rowCount ? state.page * PAGE_SIZE + 1 : 0;
  const to = state.page * PAGE_SIZE + rowCount;
  const showEmpty = data !== null && !rowCount && !loading && !error;
  const refetch = () => setReloadToken((value) => value + 1);

  const table = isPeople
    ? <PeopleTable rows={error ? [] : peopleData?.rows ?? null} sort={state.sort} direction={state.direction} onSort={onSort} loading={loading} />
    : <CompaniesTable rows={error ? [] : companiesData?.rows ?? null} sort={state.sort} direction={state.direction} onSort={onSort} loading={loading} onOpen={openCompany} />;

  const tabs = [
    { value: "people" as const, label: t("tabs.people"), icon: RiUserLine },
    { value: "companies" as const, label: t("tabs.companies"), icon: RiBuilding2Line },
  ];
  const matching = filtersOn > 0 || searching;
  const countLabel = (count: number) => t(`${matching ? "matchCount" : "count"}.${tab}`, { count });

  return (
    <main className="h-full w-full overflow-y-auto bg-bg-white-0">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={isPeople && <Button.Root variant="primary" mode="filled" size="small" onClick={() => setShowImport(true)}><Button.Icon as={RiUpload2Line} />{t("importPeople")}</Button.Root>}
        />

        <PageTabs className="mt-6" label={t("tabsLabel")} tabs={tabs} value={tab} onChange={switchTab} />

        <Frame className="mt-5">
          <FrameHeader
            title={t(`tabs.${tab}`)}
            description={<span aria-live="polite">{data ? countLabel(total) : t(`loading.${tab}`)}</span>}
            actions={
              <>
                <Input.Root size="small" className="w-40 sm:w-72">
                  <Input.Wrapper>
                    <Input.Icon as={RiSearchLine} />
                    <Input.Input type="search" aria-label={t(`search.${tab}.label`)} placeholder={t(`search.${tab}.placeholder`)} value={state.query} onChange={(event) => patch({ query: event.target.value })} />
                  </Input.Wrapper>
                </Input.Root>
                {isPeople && (
                  <LeadsFilterPopover
                    filters={peopleState.filters}
                    subcategories={subcategories}
                    onChange={(change) => patch({ filters: { ...peopleState.filters, ...change } })}
                    onClear={() => patch({ filters: EMPTY_FILTERS })}
                  />
                )}
                <Dropdown.Root>
                  <Dropdown.Trigger asChild>
                    <Button.Root variant="neutral" mode="stroke" size="small" aria-label={t("moreOptions")}><Button.Icon as={RiMore2Line} /></Button.Root>
                  </Dropdown.Trigger>
                  <Dropdown.Content align="end">
                    <Dropdown.Item asChild><Link href="/settings/columns"><Dropdown.ItemIcon as={RiTable2} />{t("manageColumns")}</Link></Dropdown.Item>
                    {isPeople && <Dropdown.Item asChild><a href="/api/leads/people/import/template"><Dropdown.ItemIcon as={RiDownloadLine} />{t("downloadTemplate")}</a></Dropdown.Item>}
                    <Dropdown.Separator />
                    <p className="px-2 pb-1 pt-1.5 text-label-xs text-text-soft-400">{t("sortBy")}</p>
                    {SORTS[tab].map((option) => {
                      const active = state.sort === option.key;
                      return (
                        <Dropdown.Item key={option.key} onSelect={() => onSort(option.key)} className={cn(active && "text-text-strong-950")}>
                          <span className="flex-1">{ts(option.labelKey)}</span>
                          {active && <Dropdown.ItemIcon as={state.direction === "asc" ? RiArrowUpLine : RiArrowDownLine} aria-label={state.direction === "asc" ? t("ascending") : t("descending")} className="size-4" />}
                        </Dropdown.Item>
                      );
                    })}
                  </Dropdown.Content>
                </Dropdown.Root>
              </>
            }
          />
          <FramePanel className="p-2 sm:p-2">
            {error && <div className="p-2"><ErrorState message={error} onRetry={refetch} /></div>}
            {showEmpty ? (
              <EmptyState
                icon={isPeople ? RiUserSearchLine : RiBuilding2Line}
                title={matching ? t(`empty.${filtersOn ? "noMatchFilters" : "noMatchSearch"}.${tab}`) : t(`empty.none.${tab}`)}
                description={matching ? t("empty.broaden") : t(`empty.hint.${tab}`)}
                action={
                  filtersOn > 0 || searching
                    ? <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => patch({ query: "", ...(isPeople ? { filters: EMPTY_FILTERS } : {}) })}>{filtersOn ? t("empty.clearFilters") : t("empty.clearSearch")}</Button.Root>
                    : isPeople && <Button.Root variant="primary" mode="filled" size="small" onClick={() => setShowImport(true)}><Button.Icon as={RiUpload2Line} />{t("importPeople")}</Button.Root>
                }
              />
            ) : table}
          </FramePanel>
          {(rowCount > 0 || pages > 1) && (
            <nav aria-label={t("pagination.label")} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 pb-1 pt-2.5">
              <p className="text-paragraph-sm tabular-nums text-text-sub-600">{rowCount ? t("pagination.range", { from, to, total }) : t(`count.${tab}`, { count: 0 })}</p>
              {pages > 1 && (
                <Pagination.Root variant="basic" className="gap-1">
                  <Pagination.NavButton aria-label={t("pagination.previous")} disabled={state.page === 0} onClick={() => patch({ page: state.page - 1 })} className="hover:bg-bg-white-0 disabled:text-text-disabled-300 disabled:hover:bg-transparent"><Pagination.NavIcon as={RiArrowLeftSLine} /></Pagination.NavButton>
                  <span className="hidden items-center gap-1 sm:flex">
                    {pageItems(state.page, pages).map((item) => typeof item === "number"
                      ? <Pagination.Item key={item} current={item === state.page} aria-current={item === state.page ? "page" : undefined} onClick={() => patch({ page: item })} className={cn("tabular-nums ring-0 hover:bg-bg-white-0", item === state.page && "bg-bg-white-0 shadow-regular-xs ring-1 ring-stroke-soft-200")}>{format.number(item + 1)}</Pagination.Item>
                      : <span key={item} className="px-1 text-label-sm text-text-soft-400">…</span>)}
                  </span>
                  <span className="px-2 text-paragraph-sm tabular-nums text-text-sub-600 sm:hidden">{state.page + 1} / {pages}</span>
                  <Pagination.NavButton aria-label={t("pagination.next")} disabled={state.page >= pages - 1} onClick={() => patch({ page: state.page + 1 })} className="hover:bg-bg-white-0 disabled:text-text-disabled-300 disabled:hover:bg-transparent"><Pagination.NavIcon as={RiArrowRightSLine} /></Pagination.NavButton>
                </Pagination.Root>
              )}
            </nav>
          )}
        </Frame>
        {showImport && <PeopleImportModal onClose={() => setShowImport(false)} onImported={() => { setPeopleState(freshPeople()); refetch(); }} />}
      </PageContainer>
    </main>
  );
}
