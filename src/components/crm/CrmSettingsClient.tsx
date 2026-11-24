"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowGoBackLine,
  RiDeleteBinLine,
  RiEditLine,
  RiMoreLine,
  RiPriceTag3Line,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as Select from "@/components/alignui/select";
import * as Table from "@/components/alignui/table";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { CRM_CATEGORY_COLOR } from "@/components/analytics/theme";
import { EmptyState } from "@/components/page/EmptyState";
import { Callout, Field } from "@/components/settings/SettingsKit";
import { CategoriesSkeleton } from "@/components/settings/SettingsSkeletons";
import { cn } from "@/utils/cn";
import { useDialogs } from "@/components/DialogProvider";
import type { Messages } from "@/i18n/catalog";
import {
  asList,
  asObject,
  crmFetch,
  errorMessage,
} from "./crm-utils";

type Category = Record<string, unknown>;
type Sequence = Record<string, unknown>;
type CategoryKey = "interested" | "not_interested" | "customer" | "other";

const categories: readonly CategoryKey[] = [
  "interested",
  "not_interested",
  "customer",
  "other",
];

/**
 * The stored category keys never change; this maps each to its label key
 * (settingsKnowledge.leadCategories.category.*).
 */
const CATEGORY_LABEL_KEYS: Record<CategoryKey, keyof Messages["settingsKnowledge"]["leadCategories"]["category"]> = {
  interested: "interested",
  not_interested: "notInterested",
  customer: "customer",
  other: "other",
};

/** A category's label in the interface language; a key the app does not know is shown as it is. */
function useCategoryLabel() {
  const t = useTranslations("settingsKnowledge.leadCategories");
  return (key: string): string => ((categories as readonly string[]).includes(key) ? t(`category.${CATEGORY_LABEL_KEYS[key as CategoryKey]}`) : key);
}

function itemId(item: Category) {
  return String(item.id ?? "");
}

function categoryKey(item: Category) {
  return String(item.categoryKey ?? item.category_key ?? "");
}

function classificationDescription(item: Category) {
  return String(item.classificationGuidance ?? item.description ?? "");
}

function sequenceIsAssignable(sequence: Sequence) {
  return sequence.status === "active" && Boolean(
    sequence.latestPublishedVersionId ?? sequence.latest_published_version_id,
  );
}

/** What the add/edit dialog is open for. */
type Editor =
  | { mode: "add"; category: CategoryKey }
  | { mode: "edit"; item: Category };

export default function CrmSettingsClient() {
  const t = useTranslations("settingsKnowledge.leadCategories");
  const dialogs = useDialogs();
  const [items, setItems] = useState<Category[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [pipelineId, setPipelineId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  // Each category is a collapsed section until clicked, so the page reads as
  // four rows rather than one long table.
  const [openCategories, setOpenCategories] = useState<ReadonlySet<CategoryKey>>(() => new Set());
  const toggleCategory = (category: CategoryKey) =>
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  const [busyKey, setBusyKey] = useState("");

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [categoryResult, sequenceResult] = await Promise.all([
        crmFetch("/categories"),
        crmFetch("/sequences?includeArchived=true"),
      ]);
      const config = asObject(categoryResult);
      setPipelineId(String(config.pipelineId ?? ""));
      setItems(
        asList<Category>(config.categories).flatMap((category) =>
          asList<Category>(category.subcategories).map((item) => ({
            ...item,
            categoryKey: item.categoryKey ?? category.key,
          })),
        ),
      );
      setSequences(asList(sequenceResult, ["sequences"]));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = (category: CategoryKey) => {
    setOpenCategories((current) => new Set(current).add(category));
    setEditor({ mode: "add", category });
    setError("");
  };

  /**
   * Creates or updates a subcategory. Returns an error for the dialog to show,
   * or null once saved. Empty stage means "not a funnel stage" (stageRank:
   * null), the same as a subcategory like Out of Office that the AI should
   * never treat as forward progress.
   */
  const submit = async (values: { name: string; description: string; stageRank: string }): Promise<string | null> => {
    if (!editor) return null;
    const description = values.description.trim() || null;
    const stageRank = values.stageRank.trim() ? Number(values.stageRank) : null;
    try {
      if (editor.mode === "add") {
        if (!pipelineId) return t("errors.noPipeline");
        setBusyKey(`create:${editor.category}`);
        await crmFetch("/subcategories", {
          method: "POST",
          body: JSON.stringify({
            pipelineId,
            categoryKey: editor.category,
            name: values.name.trim(),
            description,
            classificationGuidance: description,
            reviewRequired: false,
            sortOrder: 0,
            stageRank,
          }),
        });
      } else {
        const id = itemId(editor.item);
        setBusyKey(`edit:${id}`);
        await crmFetch(`/subcategories/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: values.name.trim(),
            classificationGuidance: description,
            stageRank,
          }),
        });
      }
      setEditor(null);
      await load(false);
      return null;
    } catch (cause) {
      return errorMessage(cause);
    } finally {
      setBusyKey("");
    }
  };

  const setActive = async (item: Category, active: boolean) => {
    const id = itemId(item);
    setBusyKey(`active:${id}`);
    setError("");
    try {
      await crmFetch(`/subcategories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      });
      await load(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  };

  const remove = async (item: Category) => {
    const id = itemId(item);
    if (!id) return;
    const name = String(item.name ?? t("confirmDelete.fallbackName"));
    const confirmed = await dialogs.confirm({
      title: t("confirmDelete.title"),
      description: t("confirmDelete.description", { name }),
      confirmLabel: t("confirmDelete.confirm"),
      variant: "error",
    });
    if (!confirmed) return;
    setBusyKey(`delete:${id}`);
    setError("");
    try {
      await crmFetch(`/subcategories/${id}`, { method: "DELETE" });
      await load(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  };

  const assign = async (item: Category, sequenceId: string) => {
    const id = itemId(item);
    setBusyKey(`sequence:${id}`);
    setError("");
    try {
      await crmFetch(`/subcategories/${id}/sequence`, {
        method: "PUT",
        body: JSON.stringify({ sequenceId: sequenceId || null }),
      });
      setItems((current) => current.map((entry) =>
        itemId(entry) === id ? { ...entry, sequenceId: sequenceId || null } : entry,
      ));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  };

  const allOpen = categories.every((c) => openCategories.has(c));

  return (
    <div className="space-y-4">
      {error && (
        <Callout
          tone="error"
          action={<Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => void load()}>{t("tryAgain")}</Button.Root>}
        >
          {error}
        </Callout>
      )}
      {!pipelineId && !loading && !error && (
        <Callout tone="warning" title={t("noPipeline.title")}>
          {t("noPipeline.body")}
        </Callout>
      )}

      {loading ? (
        <CategoriesSkeleton />
      ) : error && items.length === 0 ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-paragraph-xs text-text-sub-600">
              {t("summary", { active: items.filter((i) => i.active !== false).length, categories: categories.length })}
            </p>
            <Button.Root
              variant="neutral"
              mode="ghost"
              size="xsmall"
              onClick={() => setOpenCategories(allOpen ? new Set() : new Set(categories))}
            >
              {allOpen ? t("collapseAll") : t("expandAll")}
            </Button.Root>
          </div>
          {categories.map((category) => (
            <CategorySection
              key={category}
              category={category}
              items={items.filter((item) => categoryKey(item) === category)}
              sequences={sequences}
              pipelineReady={Boolean(pipelineId)}
              open={openCategories.has(category)}
              onToggle={() => toggleCategory(category)}
              busyKey={busyKey}
              onAdd={() => openAdd(category)}
              onEdit={(item) => setEditor({ mode: "edit", item })}
              onSetActive={setActive}
              onDelete={remove}
              onAssign={assign}
            />
          ))}
        </>
      )}

      {editor && (
        <SubcategoryDialog
          key={editor.mode === "add" ? `add:${editor.category}` : `edit:${itemId(editor.item)}`}
          editor={editor}
          busy={Boolean(busyKey)}
          onClose={() => setEditor(null)}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function CategorySection({
  category,
  items,
  sequences,
  pipelineReady,
  open,
  onToggle,
  busyKey,
  onAdd,
  onEdit,
  onSetActive,
  onDelete,
  onAssign,
}: {
  category: CategoryKey;
  items: Category[];
  sequences: Sequence[];
  pipelineReady: boolean;
  open: boolean;
  onToggle: () => void;
  busyKey: string;
  onAdd: () => void;
  onEdit: (item: Category) => void;
  onSetActive: (item: Category, active: boolean) => Promise<void>;
  onDelete: (item: Category) => Promise<void>;
  onAssign: (item: Category, sequenceId: string) => Promise<void>;
}) {
  const t = useTranslations("settingsKnowledge.leadCategories");
  const categoryLabel = useCategoryLabel();
  const activeCount = items.filter((item) => item.active !== false).length;
  const archivedCount = items.length - activeCount;
  const withSequence = items.filter((item) => item.active !== false && (item.sequenceId ?? item.sequence_id)).length;
  const panelId = `crm-category-${category}`;

  return (
    <Frame>
      <div className="flex items-center gap-2 py-1 pl-1 pr-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition hover:bg-bg-white-0 focus-visible:ring-2 focus-visible:ring-primary-base"
        >
          <RiArrowDownSLine
            aria-hidden="true"
            className={cn("size-5 shrink-0 text-text-soft-400 transition-transform duration-200", !open && "-rotate-90")}
          />
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: CRM_CATEGORY_COLOR[category] }} />
          <span className="min-w-0">
            <span className="block text-label-sm text-text-strong-950">{categoryLabel(category)}</span>
            <span className="block truncate text-paragraph-xs text-text-sub-600">
              {t("section.count", { active: activeCount, withSequence, archived: archivedCount })}
            </span>
          </span>
        </button>
        <Button.Root
          variant="neutral"
          mode="stroke"
          size="xsmall"
          className="shrink-0"
          disabled={!pipelineReady || Boolean(busyKey)}
          onClick={onAdd}
          aria-label={t("section.addAria", { category: categoryLabel(category) })}
        >
          <Button.Icon as={RiAddLine} />
          <span className="hidden sm:inline">{t("section.addLong")}</span>
          <span className="sm:hidden">{t("section.addShort")}</span>
        </Button.Root>
      </div>

      {open && (
        <FramePanel id={panelId} className="overflow-x-auto p-2 sm:p-2">
          {items.length === 0 ? (
            <EmptyState
              compact
              icon={RiPriceTag3Line}
              title={t("section.emptyTitle", { category: categoryLabel(category).toLowerCase() })}
              description={t("section.emptyDescription")}
            />
          ) : (
            <Table.Root className="min-w-180 [&>table]:table-fixed">
              <caption className="sr-only">{t("section.caption", { category: categoryLabel(category) })}</caption>
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col" className="w-[28%] px-4">{t("section.headSubcategory")}</Table.Head>
                  <Table.Head scope="col" className="px-4">{t("section.headDescription")}</Table.Head>
                  <Table.Head scope="col" className="w-60 px-4">{t("section.headSequence")}</Table.Head>
                  <Table.Head scope="col" className="w-14 px-4"><span className="sr-only">{t("section.headActions")}</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {items.map((item) => (
                  <SubcategoryRow
                    key={itemId(item)}
                    item={item}
                    sequences={sequences}
                    busyKey={busyKey}
                    onEdit={onEdit}
                    onSetActive={onSetActive}
                    onDelete={onDelete}
                    onAssign={onAssign}
                  />
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </FramePanel>
      )}
    </Frame>
  );
}

function SubcategoryRow({
  item,
  sequences,
  busyKey,
  onEdit,
  onSetActive,
  onDelete,
  onAssign,
}: {
  item: Category;
  sequences: Sequence[];
  busyKey: string;
  onEdit: (item: Category) => void;
  onSetActive: (item: Category, active: boolean) => Promise<void>;
  onDelete: (item: Category) => Promise<void>;
  onAssign: (item: Category, sequenceId: string) => Promise<void>;
}) {
  const t = useTranslations("settingsKnowledge.leadCategories");
  const id = itemId(item);
  const archived = item.active === false;
  const sequenceId = String(item.sequenceId ?? item.sequence_id ?? "");
  const stageRank = item.stageRank == null ? null : Number(item.stageRank);
  const description = classificationDescription(item);
  const name = String(item.name ?? t("row.unnamed"));
  const records = Number(item.activeRecordCount ?? item.recordCount ?? 0);
  const busy = busyKey.endsWith(`:${id}`);

  return (
    <Table.Row className={cn(busy && "opacity-60")} aria-busy={busy || undefined}>
      <Table.Cell className="px-4 py-3 align-top">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={cn("truncate text-label-sm", archived ? "text-text-sub-600" : "text-text-strong-950")} title={name}>{name}</span>
          {archived && <Badge.Root size="small" variant="lighter" color="gray">{t("row.archived")}</Badge.Root>}
        </div>
        <p className="mt-1 text-paragraph-xs text-text-sub-600">
          {t("row.meta", { records, stage: stageRank != null ? "set" : "none", rank: stageRank ?? 0 })}
        </p>
      </Table.Cell>
      <Table.Cell className="px-4 py-3 align-top">
        {description ? (
          <p className="line-clamp-2 text-paragraph-sm text-text-sub-600" title={description}>{description}</p>
        ) : (
          <button
            type="button"
            onClick={() => onEdit(item)}
            disabled={Boolean(busyKey)}
            className="rounded text-paragraph-sm text-text-soft-400 underline decoration-dotted underline-offset-2 outline-none transition hover:text-text-sub-600 focus-visible:ring-2 focus-visible:ring-primary-base"
          >
            {t("row.addDescription")}
          </button>
        )}
      </Table.Cell>
      <Table.Cell className="px-4 py-3 align-top">
        <SequenceDropdown
          value={sequenceId}
          sequences={sequences}
          disabled={archived || Boolean(busyKey)}
          onChange={(value) => void onAssign(item, value)}
        />
      </Table.Cell>
      <Table.Cell className="px-4 py-3 align-top">
        <div className="flex justify-end">
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={Boolean(busyKey)} aria-label={t("row.actionsFor", { name })}>
                <Button.Icon as={RiMoreLine} />
              </Button.Root>
            </Dropdown.Trigger>
            <Dropdown.Content align="end" className="min-w-40">
              <Dropdown.Item onSelect={() => onEdit(item)}>
                <Dropdown.ItemIcon as={RiEditLine} />
                {t("row.edit")}
              </Dropdown.Item>
              {/* Archiving is gone, but rows archived before it was removed
                  would otherwise have no way back. */}
              {archived && (
                <Dropdown.Item onSelect={() => void onSetActive(item, true)}>
                  <Dropdown.ItemIcon as={RiArrowGoBackLine} />
                  {t("row.restore")}
                </Dropdown.Item>
              )}
              <Dropdown.Separator />
              <Dropdown.Item destructive onSelect={() => void onDelete(item)}>
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

function SequenceDropdown({
  value,
  sequences,
  disabled,
  onChange,
}: {
  value: string;
  sequences: Sequence[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("settingsKnowledge.leadCategories");
  const options = useMemo(() => {
    if (value && !sequences.some((sequence) => String(sequence.id) === value)) {
      return [{ id: value, name: t("sequence.unavailable"), status: "archived" }, ...sequences];
    }
    return sequences;
  }, [sequences, value, t]);

  return (
    <Select.Root size="xsmall" value={value} disabled={disabled} onValueChange={onChange}>
      <Select.Trigger aria-label={t("sequence.aria")} className="w-full"><Select.Value /></Select.Trigger>
      <Select.Content>
        <Select.Item value="">{t("sequence.none")}</Select.Item>
        {options.map((sequence) => {
          const assignable = sequenceIsAssignable(sequence);
          const name = String(sequence.name ?? t("sequence.unnamed"));
          const label = sequence.status !== "active"
            ? t("sequence.optionArchived", { name })
            : assignable
              ? name
              : t("sequence.optionPublishFirst", { name });
          return (
            <Select.Item
              key={String(sequence.id)}
              value={String(sequence.id)}
              disabled={!assignable && String(sequence.id) !== value}
            >
              {label}
            </Select.Item>
          );
        })}
      </Select.Content>
    </Select.Root>
  );
}

/** Add or edit one subcategory: its name, when the AI should use it, and its funnel stage. */
function SubcategoryDialog({
  editor,
  busy,
  onClose,
  onSubmit,
}: {
  editor: Editor;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; description: string; stageRank: string }) => Promise<string | null>;
}) {
  const t = useTranslations("settingsKnowledge.leadCategories");
  const categoryLabel = useCategoryLabel();
  const item = editor.mode === "edit" ? editor.item : null;
  const category = (editor.mode === "add" ? editor.category : categoryKey(editor.item)) as CategoryKey;
  const [name, setName] = useState(item ? String(item.name ?? "") : "");
  const [description, setDescription] = useState(item ? classificationDescription(item) : "");
  const [stageRank, setStageRank] = useState(item && item.stageRank != null ? String(item.stageRank) : "");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const nameMissing = touched && !name.trim();
  const stageInvalid = stageRank.trim() !== "" && (!Number.isInteger(Number(stageRank)) || Number(stageRank) < 1);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!name.trim() || stageInvalid) return;
    setError(null);
    const problem = await onSubmit({ name, description, stageRank });
    if (problem) setError(problem);
  };

  return (
    <Modal.Root open onOpenChange={(open) => !open && !busy && onClose()}>
      <Modal.Content size="max-w-lg">
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <Modal.Header icon={RiPriceTag3Line}>
            <Modal.Title>{item ? t("dialog.titleEdit") : t("dialog.titleAdd")}</Modal.Title>
            <Modal.Description>
              {t.rich("dialog.description", {
                category: categoryLabel(category),
                b: (chunks) => <span className="text-text-strong-950">{chunks}</span>,
              })}
            </Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <Field label={t("dialog.nameLabel")} htmlFor="subcategory-name" required error={nameMissing ? t("dialog.nameMissing") : undefined}>
              <Input.Root size="small" hasError={nameMissing}>
                <Input.Wrapper>
                  <Input.Input id="subcategory-name" autoFocus maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("dialog.namePlaceholder")} />
                </Input.Wrapper>
              </Input.Root>
            </Field>
            <Field
              label={t("dialog.descriptionLabel")}
              htmlFor="subcategory-description"
              optional
              description={t("dialog.descriptionHint")}
            >
              <Textarea.Root
                id="subcategory-description"
                simple
                maxLength={2000}
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("dialog.descriptionPlaceholder")}
                className="resize-y"
              />
            </Field>
            <Field
              label={t("dialog.stageLabel")}
              htmlFor="subcategory-stage"
              optional
              error={stageInvalid ? t("dialog.stageInvalid") : undefined}
              description={t("dialog.stageHint")}
            >
              <Input.Root size="small" className="w-32" hasError={stageInvalid}>
                <Input.Wrapper>
                  <Input.Input id="subcategory-stage" type="number" min={1} step={1} value={stageRank} onChange={(event) => setStageRank(event.target.value)} placeholder={t("dialog.stagePlaceholder")} />
                </Input.Wrapper>
              </Input.Root>
            </Field>
            {error && <Callout tone="error">{error}</Callout>}
          </Modal.Body>
          <Modal.Footer>
            <Button.Root type="button" variant="neutral" mode="stroke" size="small" disabled={busy} onClick={onClose}>
              {t("dialog.cancel")}
            </Button.Root>
            <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={busy}>
              {busy ? (item ? t("dialog.saving") : t("dialog.adding")) : item ? t("dialog.saveChanges") : t("dialog.add")}
            </Button.Root>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
