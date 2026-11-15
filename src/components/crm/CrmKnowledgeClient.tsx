"use client";
/* eslint-disable react-hooks/set-state-in-effect */

// Renders its own SettingsPage so "Add document", which opens the editor held here, sits in the section header.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  RiAddLine,
  RiArchiveLine,
  RiArrowGoBackLine,
  RiBookOpenLine,
  RiBox3Line,
  RiBuilding2Line,
  RiCalendarLine,
  RiFileTextLine,
  RiMoreLine,
  RiPencilLine,
  RiPriceTag3Line,
  RiQuestionLine,
  RiSearchLine,
  RiShieldCheckLine,
  RiTrophyLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Checkbox from "@/components/alignui/checkbox";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as SegmentedControl from "@/components/alignui/segmented-control";
import * as Select from "@/components/alignui/select";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { EmptyState } from "@/components/page/EmptyState";
import { Callout, Field } from "@/components/settings/SettingsKit";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { ListSkeleton } from "@/components/settings/SettingsSkeletons";
import { cn } from "@/utils/cn";
import type { Messages } from "@/i18n/catalog";
import { asList, asObject, crmFetch, errorMessage } from "./crm-utils";

// The two views of the screen, in tab order: `views.<key>` holds their labels.
const VIEW_KEYS = ["active", "archived"] as const;

type Document = Record<string, unknown>;
type View = "active" | "archived";

/** `value` is what the API stores and never changes; `labelKey` picks the translated label (settingsKnowledge.knowledge.kinds.*). */
const KINDS: {
  value: string;
  labelKey: keyof Messages["settingsKnowledge"]["knowledge"]["kinds"];
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "custom", labelKey: "custom", icon: RiFileTextLine },
  { value: "company", labelKey: "company", icon: RiBuilding2Line },
  { value: "product", labelKey: "product", icon: RiBox3Line },
  { value: "pricing", labelKey: "pricing", icon: RiPriceTag3Line },
  { value: "faq", labelKey: "faq", icon: RiQuestionLine },
  { value: "scheduling", labelKey: "scheduling", icon: RiCalendarLine },
  { value: "objection", labelKey: "objection", icon: RiShieldCheckLine },
  { value: "case_study", labelKey: "caseStudy", icon: RiTrophyLine },
];

function kindMeta(kind: unknown) {
  return KINDS.find((k) => k.value === kind) ?? KINDS[0];
}

function contentOf(document: Document): string {
  return String(asObject(document.latest).content ?? document.content ?? "");
}

function alwaysIncluded(document: Document): boolean {
  return Boolean(document.alwaysInclude ?? document.always_include);
}

/** The first words of a markdown document as plain text, for the list. */
function snippet(content: string): string {
  return content
    .replace(/[#>*_`|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function CrmKnowledgeClient() {
  const t = useTranslations("settingsKnowledge.knowledge");
  const format = useFormatter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Document | null>(null);
  const [view, setView] = useState<View>("active");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      setDocuments(asList(await crmFetch("/knowledge?includeArchived=true"), ["documents", "knowledge"]));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Returns an error message for the editor to show, or null once saved. */
  const save = async (document: Document): Promise<string | null> => {
    try {
      const id = document.id ? `/${String(document.id)}` : "";
      const payload = {
        title: document.title,
        kind: document.kind ?? "custom",
        tags: document.tags ?? [],
        alwaysInclude: Boolean(document.alwaysInclude),
        content: document.content ?? "",
      };
      await crmFetch(`/knowledge${id}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setEditor(null);
      await load(false);
      return null;
    } catch (cause) {
      return errorMessage(cause);
    }
  };

  const archive = async (document: Document) => {
    setBusyId(String(document.id));
    try {
      await crmFetch(`/knowledge/${String(document.id)}`, { method: "PATCH", body: JSON.stringify({ active: !document.active }) });
      await load(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  const openEditor = (document: Document) =>
    setEditor({
      ...document,
      content: contentOf(document),
      tags: Array.isArray(document.tags) ? document.tags.join(", ") : document.tags,
    });

  const counts = useMemo(
    () => ({
      active: documents.filter((d) => d.active !== false).length,
      archived: documents.filter((d) => d.active === false).length,
    }),
    [documents],
  );

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((d) => {
      if ((view === "archived") !== (d.active === false)) return false;
      if (!term) return true;
      const tags = Array.isArray(d.tags) ? d.tags.join(" ") : "";
      return `${String(d.title ?? "")} ${tags} ${t(`kinds.${kindMeta(d.kind).labelKey}`)}`.toLowerCase().includes(term);
    });
  }, [documents, view, search, t]);

  /** Same as crm-utils' formatDate, but in the interface language rather than the browser's. */
  const formatUpdated = (value: unknown): string => {
    if (!value) return "—";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "—";
    return format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });
  };

  const addDocument = () => setEditor({ title: "", kind: "custom", content: "", tags: [], alwaysInclude: false });
  const addButton = (
    <Button.Root variant="primary" mode="filled" size="small" onClick={addDocument}>
      <Button.Icon as={RiAddLine} />
      {t("addDocument")}
    </Button.Root>
  );

  return (
    <SettingsPage
      title={t("title")}
      description={t("description")}
      actions={addButton}
    >
      <div className="space-y-5">
        {error && (
          <Callout
            tone="error"
            action={<Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => void load()}>{t("tryAgain")}</Button.Root>}
          >
            {error}
          </Callout>
        )}

        {loading ? (
          <ListSkeleton rows={4} />
        ) : documents.length === 0 && error ? null : documents.length === 0 ? (
          <Frame>
            <FramePanel>
              <EmptyState
                icon={RiBookOpenLine}
                title={t("empty.title")}
                description={t("empty.description")}
                action={addButton}
              />
            </FramePanel>
          </Frame>
        ) : (
          <Frame>
            <header className="flex flex-col gap-3 px-4 pb-3 pt-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h3 className="text-label-sm text-text-strong-950">{t("list.heading")}</h3>
                <p className="mt-0.5 text-paragraph-xs text-text-sub-600">{t("list.hint")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:flex-nowrap">
                <SegmentedControl.Root value={view} onValueChange={(v) => setView(v as View)}>
                  <SegmentedControl.List className="w-auto auto-cols-auto">
                    {VIEW_KEYS.map((v) => (
                      <SegmentedControl.Trigger key={v} value={v} className="gap-1.5 px-3">
                        {v === "active" ? t("views.active") : t("views.archived")}
                        <span className="tabular-nums text-text-soft-400">{counts[v]}</span>
                      </SegmentedControl.Trigger>
                    ))}
                  </SegmentedControl.List>
                </SegmentedControl.Root>
                <Input.Root size="small" className="w-full sm:w-48">
                  <Input.Wrapper>
                    <Input.Icon as={RiSearchLine} />
                    <Input.Input type="search" aria-label={t("search.label")} placeholder={t("search.placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
                  </Input.Wrapper>
                </Input.Root>
              </div>
            </header>
            <FramePanel className="p-0 sm:p-0">
              {shown.length === 0 ? (
                <EmptyState
                  compact
                  icon={search.trim() ? RiSearchLine : RiArchiveLine}
                  title={search.trim() ? t("noMatch.title") : view === "archived" ? t("noneArchived.title") : t("noneActive.title")}
                  description={search.trim() ? t("noMatch.description") : view === "archived" ? t("noneArchived.description") : t("noneActive.description")}
                />
              ) : (
                <ul className="divide-y divide-stroke-soft-200">
                  {shown.map((document, index) => {
                    const kind = kindMeta(document.kind);
                    const text = snippet(contentOf(document));
                    const tags = Array.isArray(document.tags) ? (document.tags as unknown[]).map(String) : [];
                    const archived = document.active === false;
                    const title = String(document.title ?? t("row.untitled"));
                    const busy = busyId === String(document.id);
                    return (
                      <li
                        key={String(document.id ?? index)}
                        tabIndex={0}
                        aria-busy={busy || undefined}
                        onClick={() => openEditor(document)}
                        onKeyDown={(e) => {
                          if (e.target === e.currentTarget && e.key === "Enter") openEditor(document);
                        }}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 px-4 py-3.5 outline-none transition first:rounded-t-xl last:rounded-b-xl hover:bg-bg-weak-50 focus-visible:bg-bg-weak-50 sm:px-5",
                          busy && "opacity-60",
                        )}
                      >
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200">
                          <kind.icon className="size-4 text-text-sub-600" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <p className={cn("min-w-0 truncate text-label-sm", archived ? "text-text-sub-600" : "text-text-strong-950")} title={title}>{title}</p>
                            {alwaysIncluded(document) && !archived && (
                              <Badge.Root size="small" variant="lighter" color="blue">{t("row.alwaysIncluded")}</Badge.Root>
                            )}
                            {archived && <Badge.Root size="small" variant="lighter" color="gray">{t("row.archived")}</Badge.Root>}
                          </div>
                          <p className="mt-1 line-clamp-2 text-paragraph-sm text-text-sub-600">{text || t("row.noContent")}</p>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-paragraph-xs text-text-soft-400" suppressHydrationWarning>
                            <span className="text-text-sub-600">{t(`kinds.${kind.labelKey}`)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{t("row.updated", { date: formatUpdated(document.updatedAt ?? document.updated_at) })}</span>
                            {tags.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{tags.map((tag) => `#${tag}`).join(" ")}</span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <Dropdown.Root>
                            <Dropdown.Trigger asChild>
                              <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy} aria-label={t("row.actionsFor", { title })}>
                                <Button.Icon as={RiMoreLine} />
                              </Button.Root>
                            </Dropdown.Trigger>
                            <Dropdown.Content align="end">
                              <Dropdown.Item onSelect={() => openEditor(document)}>
                                <Dropdown.ItemIcon as={RiPencilLine} />
                                {t("row.edit")}
                              </Dropdown.Item>
                              <Dropdown.Item onSelect={() => void archive(document)}>
                                <Dropdown.ItemIcon as={archived ? RiArrowGoBackLine : RiArchiveLine} />
                                {archived ? t("row.restore") : t("row.archive")}
                              </Dropdown.Item>
                            </Dropdown.Content>
                          </Dropdown.Root>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </FramePanel>
          </Frame>
        )}
      </div>

      {editor && <KnowledgeEditor document={editor} onCancel={() => setEditor(null)} onSave={save} />}
    </SettingsPage>
  );
}

function KnowledgeEditor({
  document,
  onCancel,
  onSave,
}: {
  document: Document;
  onCancel: () => void;
  onSave: (document: Document) => Promise<string | null>;
}) {
  const t = useTranslations("settingsKnowledge.knowledge");
  const [title, setTitle] = useState(String(document.title ?? ""));
  const [kind, setKind] = useState(String(document.kind ?? "custom"));
  const [content, setContent] = useState(String(document.content ?? ""));
  const [tags, setTags] = useState(Array.isArray(document.tags) ? document.tags.join(", ") : String(document.tags ?? ""));
  const [alwaysInclude, setAlwaysInclude] = useState(alwaysIncluded(document));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const missingTitle = touched && !title.trim();
  const missingContent = touched && !content.trim();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    setError(null);
    const problem = await onSave({
      ...document,
      title,
      kind,
      content,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      alwaysInclude,
    });
    setSaving(false);
    if (problem) setError(problem);
  };

  return (
    <Modal.Root open onOpenChange={(open) => !open && !saving && onCancel()}>
      <Modal.Content size="max-w-2xl" className="max-h-[calc(100dvh-2rem)]">
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <Modal.Header icon={RiBookOpenLine}>
            <Modal.Title>{document.id ? t("editor.titleEdit") : t("editor.titleNew")}</Modal.Title>
            <Modal.Description>{t("editor.description")}</Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <Field label={t("editor.titleLabel")} htmlFor="knowledge-title" required error={missingTitle ? t("editor.titleMissing") : undefined}>
                <Input.Root size="small" hasError={missingTitle}>
                  <Input.Wrapper>
                    <Input.Input id="knowledge-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("editor.titlePlaceholder")} />
                  </Input.Wrapper>
                </Input.Root>
              </Field>
              <Field label={t("editor.kind")}>
                <Select.Root size="small" value={kind} onValueChange={setKind}>
                  <Select.Trigger aria-label={t("editor.kind")}>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {KINDS.map((k) => (
                      <Select.Item key={k.value} value={k.value}>{t(`kinds.${k.labelKey}`)}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Field>
            </div>
            <Field
              label={t("editor.content")}
              htmlFor="knowledge-content"
              required
              description={t("editor.contentHint")}
              error={missingContent ? t("editor.contentMissing") : undefined}
            >
              <Textarea.Root
                id="knowledge-content"
                simple
                hasError={missingContent}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={12}
                className="min-h-48 resize-y font-mono text-paragraph-xs"
                placeholder={t("editor.contentPlaceholder")}
              />
            </Field>
            <Field label={t("editor.tags")} htmlFor="knowledge-tags" optional description={t("editor.tagsHint")}>
              <Input.Root size="small">
                <Input.Wrapper>
                  <Input.Input id="knowledge-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t("editor.tagsPlaceholder")} />
                </Input.Wrapper>
              </Input.Root>
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-inset ring-stroke-soft-200">
              <Checkbox.Root className="mt-0.5" checked={alwaysInclude} onCheckedChange={(checked) => setAlwaysInclude(checked === true)} />
              <span>
                <span className="block text-label-sm text-text-strong-950">{t("editor.alwaysInclude")}</span>
                <span className="mt-0.5 block text-paragraph-xs text-text-sub-600">{t("editor.alwaysIncludeHint")}</span>
              </span>
            </label>
            {error && <Callout tone="error">{error}</Callout>}
          </Modal.Body>
          <Modal.Footer>
            <Button.Root type="button" variant="neutral" mode="stroke" size="small" disabled={saving} onClick={onCancel}>
              {t("editor.cancel")}
            </Button.Root>
            <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={saving}>
              {saving ? t("editor.saving") : t("editor.save")}
            </Button.Root>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
