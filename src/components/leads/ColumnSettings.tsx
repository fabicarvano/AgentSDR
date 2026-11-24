"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiDeleteBinLine,
  RiEyeOffLine,
  RiLayoutColumnLine,
  RiLockLine,
  RiRefreshLine,
} from "@remixicon/react";

import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import * as Badge from "@/components/alignui/badge";
import * as SegmentedControl from "@/components/alignui/segmented-control";
import * as Select from "@/components/alignui/select";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { MUTED_STRONG, STATUS } from "@/components/analytics/theme";
import { EmptyState } from "@/components/page/EmptyState";
import { Callout, Meter } from "@/components/settings/SettingsKit";
import { useDialogs } from "@/components/DialogProvider";
import { columnTypeMeta } from "@/components/grid/columnTypes";
import type { Messages } from "@/i18n/catalog";
import { CORE_COLUMN_DEFS, PG_TYPE_FOR_COLUMN_TYPE, type LeadColumn, type LeadColumnType, type LeadEntity } from "@/lib/leads/types";
import { cn } from "@/utils/cn";
import { useApiErrorText } from "@/i18n/useApiErrorText";

/**
 * Postgres allows 1600 columns per table, and DROPPED COLUMNS KEEP CONSUMING
 * SLOTS until a full table rewrite. Add/drop churn spends that budget
 * permanently, so the meter counts archived columns too — they are still
 * physically present.
 */
const PG_MAX_COLUMNS = 1600;

/** Bookkeeping columns that exist physically but are never registered. */
const BOOKKEEPING_COLUMNS: Record<LeadEntity, number> = {
  // id, raw, source, company_id, created_at, updated_at
  person: 6,
  // id, raw, source, created_at, updated_at
  company: 5,
};

/** The two tabs, in order. */
const ENTITY_TABS = ["person", "company"] as const satisfies readonly LeadEntity[];

type CoreLabels = Messages["leads"]["columnSettings"]["core"];

/**
 * Core columns are registry rows whose stored label is English. Their `key` is stable, so the key picks
 * the translated label (leads.columnSettings.core.*). Keys not listed here show the stored label.
 */
const CORE_LABEL_KEYS: { [E in LeadEntity]: ReadonlyMap<string, keyof CoreLabels[E]> } = {
  person: new Map([
    ["email", "email"],
    ["linkedin_url", "linkedinUrl"],
    ["first_name", "firstName"],
    ["last_name", "lastName"],
    ["full_name", "fullName"],
    ["title", "title"],
    ["profile_picture_url", "profilePicture"],
    ["phone", "phone"],
  ]),
  company: new Map([
    ["domain", "domain"],
    ["name", "name"],
    ["linkedin_url", "linkedinUrl"],
  ]),
};

/**
 * The type picker offers exactly what the API accepts.
 *
 * Derived from PG_TYPE_FOR_COLUMN_TYPE rather than from the grid's
 * COLUMN_TYPE_GROUPS, so the grid's runner types (enrichment, ai, waterfall)
 * cannot leak in — a lead column never executes anything — and so there is no
 * second list to keep in sync with the backend.
 */
const TYPES = Object.keys(PG_TYPE_FOR_COLUMN_TYPE) as LeadColumnType[];

type Props = { columns: LeadColumn[] };

/**
 * What a column is called on screen. A core column still carrying the label the product shipped
 * (CORE_COLUMN_DEFS) is shown in the interface language, picked by its stable key; a column the
 * person renamed, one they created, or one whose key is unknown shows its stored name as it is.
 */
function useColumnLabel() {
  const t = useTranslations("leads.columnSettings.core");
  return (column: LeadColumn): string => {
    if (!column.isCore) return column.name;
    const shipped = CORE_COLUMN_DEFS.find((def) => def.entity === column.entity && def.key === column.key)?.name;
    if (column.name !== shipped) return column.name;
    if (column.entity === "person") {
      const key = CORE_LABEL_KEYS.person.get(column.key);
      return key ? t(`person.${key}`) : column.name;
    }
    const key = CORE_LABEL_KEYS.company.get(column.key);
    return key ? t(`company.${key}`) : column.name;
  };
}

/** The label of a column type; a type this screen has no label for (a stale stored value) is shown as stored. */
function useTypeLabel() {
  const t = useTranslations("leads.columnSettings.types");
  return (type: LeadColumnType): string => (TYPES.includes(type) ? t(type) : type);
}

export default function ColumnSettings({ columns }: Props) {
  const t = useTranslations("leads.columnSettings");
  const apiErrorText = useApiErrorText();
  const format = useFormatter();
  const columnLabel = useColumnLabel();
  const typeLabel = useTypeLabel();
  const router = useRouter();
  const dialogs = useDialogs();
  const [pending, startTransition] = useTransition();

  const [entity, setEntity] = useState<LeadEntity>("person");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<LeadColumnType>("text");

  const forEntity = useMemo(
    () => columns.filter((c) => c.entity === entity).sort((a, b) => a.position - b.position),
    [columns, entity],
  );
  const active = forEntity.filter((c) => !c.archivedAt);
  const archived = forEntity.filter((c) => c.archivedAt);
  const used = forEntity.length + BOOKKEEPING_COLUMNS[entity];

  /**
   * Every mutation goes through here so the error handling is identical
   * everywhere: the API's `error` string is written for the user and is shown
   * verbatim, and a refresh only happens on success.
   */
  async function mutate(id: string | null, run: () => Promise<Response>) {
    setError(null);
    setBusyId(id ?? "new");
    try {
      const res = await run();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorText(body, t("errors.generic")));
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError(t("errors.network"));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    const ok = await mutate(null, () =>
      fetch("/api/leads/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, name, type: newType }),
      }),
    );
    if (ok) {
      setNewName("");
      setNewType("text");
    }
  }

  async function handleRename(column: LeadColumn, name: string) {
    if (name.trim() === column.name || !name.trim()) return;
    await mutate(column.id, () =>
      fetch(`/api/leads/columns/${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    );
  }

  /**
   * A type change rewrites the table and can permanently clear values that do
   * not convert. Preview first, always — a cast that silently nulls a third of
   * a column is only noticed weeks later.
   */
  async function handleRetype(column: LeadColumn, nextType: LeadColumnType) {
    if (nextType === column.type) return;
    setError(null);
    setBusyId(column.id);

    let preview: { populated: number; incompatible: number };
    try {
      const res = await fetch(`/api/leads/columns/${column.id}/type-preview?type=${nextType}`);
      const body = await res.json();
      if (!res.ok) {
        // The conversion is not offered at all — say so and stop.
        setError(apiErrorText(body, t("errors.conversionUnsupported")));
        return;
      }
      preview = body;
    } catch {
      setError(t("errors.network"));
      return;
    } finally {
      setBusyId(null);
    }

    const confirmed = await dialogs.confirm({
      title: t("retype.title", { name: columnLabel(column), type: typeLabel(nextType) }),
      description:
        preview.incompatible > 0
          ? t.rich("retype.lossy", { incompatible: preview.incompatible, populated: preview.populated, b: (chunks) => <strong>{chunks}</strong> })
          : t("retype.clean", { populated: preview.populated }),
      confirmLabel: t("retype.confirm"),
      variant: preview.incompatible > 0 ? "error" : "primary",
    });
    if (!confirmed) return;

    await mutate(column.id, () =>
      fetch(`/api/leads/columns/${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: nextType }),
      }),
    );
  }

  /** Soft: hides the column everywhere but keeps its data. Reversible. */
  async function handleArchive(column: LeadColumn, archivedNext: boolean) {
    await mutate(column.id, () =>
      fetch(`/api/leads/columns/${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: archivedNext }),
      }),
    );
  }

  /** Hard: drops the physical column. Irreversible, so it asks plainly. */
  async function handleDelete(column: LeadColumn) {
    const confirmed = await dialogs.confirm({
      title: t("delete.title", { name: columnLabel(column) }),
      description: t("delete.description"),
      confirmLabel: t("delete.confirm"),
      variant: "error",
    });
    if (!confirmed) return;

    await mutate(column.id, () =>
      fetch(`/api/leads/columns/${column.id}?permanent=true`, { method: "DELETE" }),
    );
  }

  const busy = (id: string) => busyId === id || pending;
  const counts = {
    person: columns.filter((c) => c.entity === "person" && !c.archivedAt).length,
    company: columns.filter((c) => c.entity === "company" && !c.archivedAt).length,
  };
  const nearLimit = used > PG_MAX_COLUMNS * 0.75;

  return (
    <div className="space-y-5">
      {error && <Callout tone="error">{error}</Callout>}

      <Frame>
        <header className="flex flex-col gap-3 px-4 pb-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-label-sm text-text-strong-950">{t("fieldsHeading", { entity })}</h3>
            <p className="mt-0.5 text-paragraph-xs text-text-sub-600">{t("fieldsHint")}</p>
          </div>
          <SegmentedControl.Root value={entity} onValueChange={(v) => setEntity(v as LeadEntity)}>
            <SegmentedControl.List className="w-auto auto-cols-auto">
              {ENTITY_TABS.map((e) => (
                <SegmentedControl.Trigger key={e} value={e} className="gap-1.5 px-3">
                  {t(`entity.${e}`)}
                  <span className="tabular-nums text-text-soft-400">{format.number(counts[e])}</span>
                </SegmentedControl.Trigger>
              ))}
            </SegmentedControl.List>
          </SegmentedControl.Root>
        </header>

        <FramePanel className="p-0 sm:p-0">
          {/* Add */}
          <form
            className="flex flex-col gap-2 border-b border-stroke-soft-200 p-3 sm:flex-row sm:items-start sm:p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleAdd();
            }}
          >
            <div className="min-w-0 flex-1">
              <Input.Root size="small">
                <Input.Wrapper>
                  <Input.Icon as={RiAddLine} />
                  <Input.Input
                    aria-label={t("add.nameAria", { entity })}
                    placeholder={t("add.namePlaceholder", { entity })}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </Input.Wrapper>
              </Input.Root>
            </div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
                <Select.Root size="small" value={newType} onValueChange={(v) => setNewType(v as LeadColumnType)}>
                  <Select.Trigger aria-label={t("add.typeAria")} title={t("storedAs", { pgType: PG_TYPE_FOR_COLUMN_TYPE[newType] })}>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {TYPES.map((type) => (
                      <Select.Item key={type} value={type}>{typeLabel(type)}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </div>
              <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={!newName.trim() || busyId === "new"}>
                {busyId === "new" ? t("add.adding") : t("add.submit")}
              </Button.Root>
            </div>
          </form>

          {/* Active columns */}
          {active.length ? (
            <ul className="divide-y divide-stroke-soft-200">
              {active.map((column) => (
                <ColumnRow
                  key={column.id}
                  column={column}
                  label={columnLabel(column)}
                  busy={busy(column.id)}
                  onRename={(name) => handleRename(column, name)}
                  onRetype={(type) => handleRetype(column, type)}
                  onArchive={() => handleArchive(column, true)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={RiLayoutColumnLine} title={t("empty.title")} description={t("empty.description")} />
          )}
        </FramePanel>

        {/* Column budget. Quiet until it matters. */}
        <div className="px-4 pb-2 pt-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <p className={cn("text-paragraph-xs", nearLimit ? "text-warning-dark" : "text-text-sub-600")}>
              {t("budget", { entity })}
            </p>
            <Meter value={used} max={PG_MAX_COLUMNS} color={nearLimit ? STATUS.warning : MUTED_STRONG} label={t("budget", { entity })} className="w-full sm:w-64" />
          </div>
          {nearLimit && (
            <p className="mt-1 text-paragraph-xs text-warning-dark">
              {t("budgetWarning")}
            </p>
          )}
        </div>
      </Frame>

      {/* Removed columns */}
      {archived.length > 0 && (
        <Frame>
          <button
            type="button"
            onClick={() => setShowRemoved((s) => !s)}
            aria-expanded={showRemoved}
            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition hover:bg-bg-white-0 focus-visible:ring-2 focus-visible:ring-primary-base"
          >
            <RiArrowDownSLine className={cn("mt-0.5 size-5 shrink-0 text-text-soft-400 transition-transform duration-200", !showRemoved && "-rotate-90")} aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-label-sm text-text-strong-950">{t("removed.title", { count: archived.length })}</span>
              <span className="mt-0.5 block text-paragraph-xs text-text-sub-600">
                {t("removed.hint")}
              </span>
            </span>
          </button>

          {showRemoved && (
            <FramePanel className="p-0 sm:p-0">
              <ul className="divide-y divide-stroke-soft-200">
                {archived.map((column) => (
                  <li key={column.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", busy(column.id) && "opacity-60")}>
                    <RiEyeOffLine className="size-4 shrink-0 text-text-soft-400" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-sm text-text-sub-600">{columnLabel(column)}</p>
                      <p className="truncate font-mono text-paragraph-xs text-text-soft-400">
                        {column.key} · {column.pgType}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => handleArchive(column, false)} disabled={busy(column.id)}>
                        <Button.Icon as={RiRefreshLine} />
                        {t("removed.restore")}
                      </Button.Root>
                      <Button.Root variant="error" mode="ghost" size="xsmall" onClick={() => handleDelete(column)} disabled={busy(column.id)}>
                        <Button.Icon as={RiDeleteBinLine} />
                        {t("removed.delete")}
                      </Button.Root>
                    </div>
                  </li>
                ))}
              </ul>
            </FramePanel>
          )}
        </Frame>
      )}
    </div>
  );
}

/**
 * One active column.
 *
 * Core columns render without the remove and type controls rather than with
 * disabled ones: a control that exists but always refuses is a worse
 * explanation than no control at all. They stay renameable, because the label
 * is cosmetic and renaming runs no DDL.
 */
function ColumnRow({
  column,
  label,
  busy,
  onRename,
  onRetype,
  onArchive,
}: {
  column: LeadColumn;
  /** The name to show (see useColumnLabel). */
  label: string;
  busy: boolean;
  onRename: (name: string) => void;
  onRetype: (type: LeadColumnType) => void;
  onArchive: () => void;
}) {
  const t = useTranslations("leads.columnSettings");
  const typeLabel = useTypeLabel();
  // null = untouched: the input follows the label, so a language switch cannot leave a stale draft that a blur would save as the name.
  const [draft, setDraft] = useState<string | null>(null);
  const Icon = columnTypeMeta(column.type).icon;

  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:flex-nowrap sm:px-4", busy && "opacity-60")} aria-busy={busy || undefined}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200">
        <Icon className="size-4 text-text-sub-600" />
      </span>

      <div className="min-w-36 flex-1 sm:min-w-0">
        <input
          value={draft ?? label}
          disabled={busy}
          aria-label={t("row.renameAria", { name: label })}
          title={t("row.renameHint")}
          onChange={(e) => setDraft(e.target.value)}
          // Only a change is saved: the label may be a translation, and blurring an untouched field must not write it as the name.
          onBlur={() => { if (draft !== null && draft.trim() !== label) onRename(draft); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          className="-ml-1.5 h-7 w-full max-w-xs rounded-md bg-transparent px-1.5 text-label-sm text-text-strong-950 outline-none ring-1 ring-inset ring-transparent transition hover:ring-stroke-soft-200 focus:bg-bg-white-0 focus:shadow-button-important-focus focus:ring-stroke-strong-950"
        />
        <p className="truncate font-mono text-paragraph-xs text-text-soft-400">{column.key}</p>
      </div>

      <div className="ml-11 flex items-center gap-1.5 sm:ml-0">
        {column.isCore ? (
          <Badge.Root variant="lighter" color="gray" size="medium">
            <Badge.Icon as={RiLockLine} />
            {t("row.builtIn", { type: typeLabel(column.type) })}
          </Badge.Root>
        ) : (
          <>
            <div className="w-40">
              <Select.Root size="xsmall" value={column.type} disabled={busy} onValueChange={(v) => onRetype(v as LeadColumnType)}>
                <Select.Trigger aria-label={t("row.typeAria", { name: label })}>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {TYPES.map((type) => (
                    <Select.Item key={type} value={type}>{typeLabel(type)}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
            <Button.Root variant="neutral" mode="ghost" size="xsmall" onClick={onArchive} disabled={busy} aria-label={t("row.removeAria", { name: label })} title={t("row.removeHint")}>
              <Button.Icon as={RiEyeOffLine} />
              <span className="hidden sm:inline">{t("row.remove")}</span>
            </Button.Root>
          </>
        )}
      </div>
    </li>
  );
}
