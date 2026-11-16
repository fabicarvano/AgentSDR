"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiGitBranchLine,
  RiLoopLeftLine,
  RiMoreLine,
  RiPriceTag3Line,
  RiSearchLine,
  RiSendPlaneLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as SegmentedControl from "@/components/alignui/segmented-control";
import * as Switch from "@/components/alignui/switch";
import * as Table from "@/components/alignui/table";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { useDialogs } from "@/components/DialogProvider";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { cn } from "@/utils/cn";
import { categoryToneClass } from "./ActionRowTools";
import { ErrorState, fieldClass } from "./CrmLayout";
import { RowsSkeleton } from "./CrmSkeletons";
import { asList, asObject, crmFetch } from "./crm-utils";
import { useCrmText } from "./useCrmText";
import type { Messages } from "@/i18n/catalog";

type Sequence = Record<string, unknown>;
type SubcategoryReference = { name: string; categoryKey: string };

// Stored in the database as the step's AI instructions (content for the model, not interface), so it stays English.
const DEFAULT_IMMEDIATE_GOAL = "Respond to the latest inbound message and move the conversation forward naturally.";

type Status = "published" | "draft" | "archived";
const STATUS_COLOR: Record<Status, React.ComponentProps<typeof Badge.Root>["color"]> = {
  published: "green",
  draft: "gray",
  archived: "orange",
};
// Compile-time exhaustiveness: a status without a label key fails tsc here.
const _statusCovered: Exclude<Status, keyof Messages["crmSequences"]["list"]["status"]> extends never ? true : false = true;
void _statusCovered;
const TABS = ["all", "published", "draft", "archived"] as const;
type Tab = (typeof TABS)[number];

function sequenceStatus(sequence: Sequence): Status {
  if (sequence.status === "archived") return "archived";
  return sequence.latestPublishedVersionId ?? sequence.latestPublishedVersion ? "published" : "draft";
}

export default function CrmSequencesClient() {
  const t = useTranslations("crmSequences.list");
  const format = useFormatter();
  const { errorMessage } = useCrmText();
  const router = useRouter();
  const dialogs = useDialogs();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [subcategoryById, setSubcategoryById] = useState<Record<string, SubcategoryReference>>({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  // Read once, so the "updated 3d ago" lines stay pure during render.
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sequenceResult, categoryResult] = await Promise.all([
        crmFetch("/sequences?includeArchived=true"),
        crmFetch("/categories"),
      ]);
      setSequences(asList(sequenceResult, ["sequences"]));
      const categories = asList<Record<string, unknown>>(asObject(categoryResult).categories);
      const references: Record<string, SubcategoryReference> = {};
      for (const category of categories) {
        for (const subcategory of asList<Record<string, unknown>>(category.subcategories)) {
          references[String(subcategory.id)] = {
            name: String(subcategory.name ?? t("errors.unnamedSubcategory")),
            categoryKey: String(subcategory.categoryKey ?? category.key ?? "other"),
          };
        }
      }
      setSubcategoryById(references);
      setLoaded(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [errorMessage, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (body: Record<string, unknown>) => {
    setBusyKey("create");
    setError("");
    try {
      const result = asObject(await crmFetch("/sequences", {
        method: "POST",
        body: JSON.stringify(body),
      }));
      const id = asObject(result.sequence).id;
      if (!id) throw new Error(t("errors.missingId"));
      router.push(`/crm/sequences/${String(id)}`);
    } catch (cause) {
      setError(errorMessage(cause));
      setShowCreate(false);
      setBusyKey("");
    }
  };

  const remove = async (sequence: Sequence) => {
    const id = String(sequence.id);
    const name = String(sequence.name ?? t("row.unnamedSequence"));
    const assignmentCount = asList<string>(sequence.assignedSubcategoryIds).length;
    const confirmed = await dialogs.confirm({
      title: t("delete.title"),
      description: assignmentCount
        ? t("delete.withAssignments", { name, count: assignmentCount })
        : t("delete.simple", { name }),
      confirmLabel: t("delete.confirm"),
      variant: "error",
    });
    if (!confirmed) return;

    setBusyKey(`delete:${id}`);
    setError("");
    try {
      await crmFetch(`/sequences/${id}`, {
        method: "DELETE",
      });
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  };

  // Not versioned: applies at once, no publish. Turning it off moves any
  // follow-ups already waiting to send into Action required (server side).
  const toggleAutoSend = async (sequence: Sequence, value: boolean) => {
    const id = String(sequence.id);
    setBusyKey(`auto:${id}`);
    setError("");
    setSequences((current) => current.map((row) => String(row.id) === id ? { ...row, autoSendFollowUps: value } : row));
    try {
      await crmFetch(`/sequences/${id}`, { method: "PATCH", body: JSON.stringify({ autoSendFollowUps: value }) });
    } catch (cause) {
      setSequences((current) => current.map((row) => String(row.id) === id ? { ...row, autoSendFollowUps: !value } : row));
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  };

  const counts = useMemo(() => {
    const byStatus: Record<Tab, number> = { all: sequences.length, published: 0, draft: 0, archived: 0 };
    for (const sequence of sequences) byStatus[sequenceStatus(sequence)] += 1;
    return byStatus;
  }, [sequences]);
  const inUse = sequences.filter((sequence) => sequence.status !== "archived" && asList(sequence.assignedSubcategoryIds).length > 0).length;
  const covered = new Set(sequences.flatMap((sequence) => asList<string>(sequence.assignedSubcategoryIds))).size;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sequences.filter((sequence) => {
      if (tab !== "all" && sequenceStatus(sequence) !== tab) return false;
      if (term && !`${String(sequence.name ?? "")} ${String(sequence.description ?? "")}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [sequences, tab, search]);
  const open = (id: string) => router.push(`/crm/sequences/${id}`);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button.Root variant="primary" mode="filled" size="small" disabled={Boolean(busyKey)} onClick={() => setShowCreate(true)}>
            <Button.Icon as={RiAddLine} />
            {t("createSequence")}
          </Button.Root>
        }
      />

      <KpiStrip className="mt-6" columns={3}>
        <KpiCell icon={RiSendPlaneLine} label={t("kpi.published")} value={loaded ? format.number(counts.published) : "—"} context={loaded ? t("kpi.publishedContext", { draft: counts.draft, archived: counts.archived }) : undefined} hint={t("kpi.publishedHint")} />
        <KpiCell icon={RiGitBranchLine} label={t("kpi.inUse")} value={loaded ? format.number(inUse) : "—"} context={loaded ? t("kpi.inUseContext", { count: covered }) : undefined} hint={t("kpi.inUseHint")} />
        <KpiCell icon={RiLoopLeftLine} label={t("kpi.notAssigned")} value={loaded ? format.number(Math.max(counts.all - counts.archived - inUse, 0)) : "—"} context={t("kpi.notAssignedContext")} />
      </KpiStrip>

      {error && <div className="mt-5"><ErrorState message={error} onRetry={() => void load()} /></div>}

      <Frame className="mt-5">
        <FrameHeader
          title={t("library.title")}
          description={t("library.description")}
          actions={<>
            <SegmentedControl.Root value={tab} onValueChange={(value) => setTab(value as Tab)} className="w-full sm:w-auto">
              <SegmentedControl.List className="w-full sm:w-auto">
                {TABS.map((value) => (
                  <SegmentedControl.Trigger key={value} value={value} className="gap-1 px-1.5 text-label-xs sm:gap-1.5 sm:px-3 sm:text-label-sm">
                    {value === "all" ? t("library.tabAll") : t(`status.${value}`)}
                    <span className="tabular-nums text-text-soft-400">{counts[value]}</span>
                  </SegmentedControl.Trigger>
                ))}
              </SegmentedControl.List>
            </SegmentedControl.Root>
            <Input.Root size="small" className="w-full sm:w-56">
              <Input.Wrapper>
                <Input.Icon as={RiSearchLine} />
                <Input.Input type="search" aria-label={t("library.searchLabel")} placeholder={t("library.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} />
              </Input.Wrapper>
            </Input.Root>
          </>}
        />
        <FramePanel className="overflow-hidden p-0 sm:p-0">
          {!loaded && loading ? <RowsSkeleton rows={5} />
            : filtered.length === 0 ? (
              sequences.length === 0
                ? <EmptyState icon={RiLoopLeftLine} title={t("library.emptyTitle")} description={t("library.emptyDescription")} action={<Button.Root variant="primary" mode="filled" size="small" onClick={() => setShowCreate(true)}><Button.Icon as={RiAddLine} />{t("createSequence")}</Button.Root>} />
                : <EmptyState icon={RiSearchLine} title={t("library.noMatchTitle")} description={t("library.noMatchDescription")} />
            ) : (
              <div aria-busy={loading || undefined} className={cn("overflow-x-auto p-2 transition-opacity", loading && "opacity-60")}>
                <Table.Root className="min-w-[980px]" style={{ tableLayout: "fixed" }}>
                  <caption className="sr-only">{t("library.caption")}</caption>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head scope="col" className="w-[27%] px-4">{t("library.colSequence")}</Table.Head>
                      <Table.Head scope="col" className="w-[18%] px-4">{t("library.colSteps")}</Table.Head>
                      <Table.Head scope="col" className="w-[25%] px-4">{t("library.colUsedFor")}</Table.Head>
                      <Table.Head scope="col" className="w-[15%] px-4" title={t("library.colAutoSendHint")}>{t("library.colAutoSend")}</Table.Head>
                      <Table.Head scope="col" className="w-[12%] px-4">{t("library.colStatus")}</Table.Head>
                      <Table.Head scope="col" className="w-14 px-2"><span className="sr-only">{t("library.colActions")}</span></Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body spacing={4}>
                    {filtered.map((sequence, index) => (
                      <SequenceRow
                        key={String(sequence.id ?? index)}
                        sequence={sequence}
                        subcategoryById={subcategoryById}
                        busy={Boolean(busyKey)}
                        now={now}
                        onOpen={open}
                        onDelete={remove}
                        onToggleAutoSend={toggleAutoSend}
                      />
                    ))}
                  </Table.Body>
                </Table.Root>
              </div>
            )}
        </FramePanel>
      </Frame>

      <CreateSequence
        open={showCreate}
        busy={busyKey === "create"}
        onOpenChange={setShowCreate}
        onCreate={create}
      />
    </>
  );
}

function SequenceRow({
  sequence,
  subcategoryById,
  busy,
  now,
  onOpen,
  onDelete,
  onToggleAutoSend,
}: {
  sequence: Sequence;
  subcategoryById: Record<string, SubcategoryReference>;
  busy: boolean;
  now: number;
  onOpen: (id: string) => void;
  onDelete: (sequence: Sequence) => Promise<void>;
  onToggleAutoSend: (sequence: Sequence, value: boolean) => Promise<void>;
}) {
  const t = useTranslations("crmSequences.list");
  const format = useFormatter();
  const { categoryLabel, timeAgo } = useCrmText();
  const id = String(sequence.id);
  const name = String(sequence.name ?? t("row.unnamedSequence"));
  const steps = Number(sequence.draftStepCount ?? sequence.stepCount ?? 0);
  const status = sequenceStatus(sequence);
  const archived = status === "archived";
  const version = sequence.latestPublishedVersion ? `v${String(sequence.latestPublishedVersion)}` : "";
  // "3d ago" for a timestamp, against a clock read once per page.
  const ago = (value: unknown) => {
    const time = new Date(String(value)).getTime();
    if (Number.isNaN(time)) return "";
    const minutes = Math.round((now - time) / 60_000);
    if (minutes < 60 * 24 * 30) return timeAgo(value);
    return format.dateTime(new Date(time), { month: "short", day: "numeric", year: "numeric" });
  };
  const updated = sequence.updatedAt ? ago(sequence.updatedAt) : "";
  const assignments = asList<string>(sequence.assignedSubcategoryIds)
    .map((subcategoryId) => subcategoryById[String(subcategoryId)])
    .filter((value): value is SubcategoryReference => Boolean(value));
  const autoSend = sequence.autoSendFollowUps === true;
  const visible = assignments.slice(0, 3);
  const hidden = assignments.slice(3);

  return (
    <Table.Row
      tabIndex={0}
      className={cn("cursor-pointer outline-none focus-visible:[&>td]:bg-bg-weak-50", archived && "[&_td]:text-text-soft-400")}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button, [role='menuitem']")) return;
        onOpen(id);
      }}
      onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === "Enter") onOpen(id); }}
    >
      <Table.Cell className="px-4 py-3">
        <div className="min-w-0">
          <Link href={`/crm/sequences/${id}`} className={cn("block truncate text-label-sm hover:text-primary-base", archived ? "text-text-sub-600" : "text-text-strong-950")} title={name}>{name}</Link>
          <p className="mt-0.5 truncate text-paragraph-xs text-text-sub-600" title={sequence.description ? String(sequence.description) : undefined}>
            {sequence.description ? String(sequence.description) : updated ? t("row.updated", { when: updated }) : t("row.noDescription")}
          </p>
        </div>
      </Table.Cell>
      <Table.Cell className="px-4 py-3">
        <StepSummary steps={steps} />
      </Table.Cell>
      <Table.Cell className="px-4 py-3">
        {assignments.length ? (
          <div className="flex flex-wrap gap-1.5">
            {visible.map((assignment) => (
              <span
                key={`${assignment.categoryKey}:${assignment.name}`}
                title={`${categoryLabel(assignment.categoryKey)} · ${assignment.name}`}
                className={cn("inline-flex h-6 max-w-full items-center rounded-md px-2 text-label-xs ring-1 ring-inset", categoryToneClass[assignment.categoryKey] ?? "bg-bg-weak-50 text-text-sub-600 ring-stroke-soft-200")}
              >
                <span className="truncate">{assignment.name}</span>
              </span>
            ))}
            {hidden.length > 0 && (
              <span title={hidden.map((item) => `${categoryLabel(item.categoryKey)} · ${item.name}`).join("\n")} className="inline-flex h-6 items-center rounded-md bg-bg-weak-50 px-2 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">
                {t("row.more", { count: hidden.length })}
              </span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-paragraph-xs text-text-soft-400"><RiPriceTag3Line className="size-3.5" aria-hidden="true" />{t("row.notAssigned")}</span>
        )}
      </Table.Cell>
      <Table.Cell className="px-4 py-3" onKeyDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Switch.Root
            checked={autoSend}
            disabled={busy || archived}
            onCheckedChange={(value) => void onToggleAutoSend(sequence, value)}
            aria-label={t("row.autoSendLabel", { name })}
          />
          <span className={cn("text-label-sm", autoSend ? "text-text-strong-950" : "text-text-sub-600")}>{autoSend ? t("row.on") : t("row.off")}</span>
        </div>
        <p className="mt-1 truncate text-paragraph-xs text-text-sub-600">
          {archived ? t("row.archived") : steps <= 1 ? t("row.noFollowUps") : autoSend ? t("row.sendsOnItsOwn") : t("row.waitsForYou")}
        </p>
      </Table.Cell>
      <Table.Cell className="px-4 py-3">
        <Badge.Root variant="lighter" size="medium" color={STATUS_COLOR[status]}>
          <Badge.Dot />{t(`status.${status}`)}
        </Badge.Root>
        <p className="mt-1 truncate text-paragraph-xs text-text-sub-600">{status === "published" ? (version ? t("row.liveVersion", { version }) : t("row.liveLatest")) : status === "draft" ? t("row.notPublished") : updated ? t("row.archivedUpdated", { when: updated }) : t("row.archived")}</p>
      </Table.Cell>
      <Table.Cell className="px-2 py-3" onKeyDown={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy} aria-label={t("row.actionsFor", { name })}>
                <Button.Icon as={RiMoreLine} />
              </Button.Root>
            </Dropdown.Trigger>
            <Dropdown.Content align="end" className="min-w-[160px]">
              <Dropdown.Item asChild>
                <Link href={`/crm/sequences/${id}`}>
                  <Dropdown.ItemIcon as={RiEditLine} />
                  {t("row.edit")}
                </Link>
              </Dropdown.Item>
              <Dropdown.Separator />
              <Dropdown.Item destructive onSelect={() => void onDelete(sequence)}>
                <Dropdown.ItemIcon as={RiDeleteBinLine} />
                {t("row.delete")}
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Root>
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

/**
 * The shape of the sequence at a glance: the immediate reply, then one tick
 * per follow-up, with the count spelled out — "Reply + 3 follow-ups".
 */
function StepSummary({ steps }: { steps: number }) {
  const t = useTranslations("crmSequences.list");
  if (steps === 0) return <span className="text-paragraph-xs text-text-soft-400">{t("steps.none")}</span>;
  const followUps = Math.max(steps - 1, 0);
  return (
    <div className="min-w-0">
      <p className="text-label-sm tabular-nums text-text-strong-950">{t("steps.count", { count: steps })}</p>
      <div className="mt-1 flex items-center gap-2">
        <span aria-hidden="true" className="flex shrink-0 gap-0.5">
          <span className="h-1.5 w-4 rounded-full bg-primary-base" />
          {Array.from({ length: Math.min(followUps, 8) }, (_, index) => <span key={index} className="h-1.5 w-2.5 rounded-full bg-bg-soft-200" />)}
        </span>
        <span className="truncate text-paragraph-xs text-text-sub-600">{followUps ? t("steps.replyPlus", { count: followUps }) : t("steps.replyOnly")}</span>
      </div>
    </div>
  );
}

function CreateSequence({
  open,
  busy,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const t = useTranslations("crmSequences.list");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => { if (!open) { setName(""); setDescription(""); } }, [open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    void onCreate({
      name: name.trim(),
      description: description.trim() || null,
      steps: [{
        name: "Immediate reply", // stored step name (data, not interface): stays English
        delayMinutes: 0,
        subjectTemplate: null,
        bodyTemplate: null,
        aiInstructions: DEFAULT_IMMEDIATE_GOAL,
        knowledgeTags: [],
      }],
    });
  };

  return (
    <Modal.Root open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <Modal.Content size="max-w-lg">
        <form onSubmit={submit}>
          <Modal.Header icon={RiLoopLeftLine}>
            <Modal.Title>{t("create.title")}</Modal.Title>
            <Modal.Description>{t("create.description")}</Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-label-xs text-text-sub-600">{t("create.nameLabel")}</span>
              <input
                autoFocus
                required
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={cn(fieldClass, "h-10")}
                placeholder={t("create.namePlaceholder")}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-label-xs text-text-sub-600">
                {t.rich("create.descriptionLabel", { soft: (chunks) => <span className="font-normal text-text-soft-400">{chunks}</span> })}
              </span>
              <textarea
                maxLength={4000}
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={cn(fieldClass, "resize-y")}
                placeholder={t("create.descriptionPlaceholder")}
              />
            </label>
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close asChild>
              <Button.Root type="button" variant="neutral" mode="stroke" size="small" disabled={busy}>{t("create.cancel")}</Button.Root>
            </Modal.Close>
            <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={busy || !name.trim()}>
              {busy ? t("create.creating") : t("create.submit")}
            </Button.Root>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
